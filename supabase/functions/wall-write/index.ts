// The one door for writing to the wall. docs/the-wall.md sections 4 to 6
// and section 12.
//
// Every submission and every boost from the app comes through here, and
// nothing else does. The function checks App Attest, which cannot be checked
// in SQL, and then calls wall_submit_story or wall_cast_boost as the caller,
// with the caller's own token, so the database still sees who is writing
// and still enforces the budget, the ten a day and the address key itself.
// What this function adds is one row in wall_attest_grants, written with the
// service role after the device has proved itself, which the database
// function consumes. A call to the database function that did not come
// through here finds no grant and is refused.
//
// Three requests, one body shape, a `kind` field:
//
//   challenge   -> { challenge }                    a fresh nonce for this account
//   attest      -> { key_id, attestation, challenge }
//   write       -> { key_id, assertion, challenge, payload }
//
// payload is the request as a JSON string, exactly the bytes the device
// hashed after the challenge, so the signature covers what is being asked
// as well as who is asking. It carries { action: "submit", url, wall_date },
// { action: "boost", story_id, units, request_id }, or
// { action: "unboost", story_id } to take a buzz back inside its window.
//
// Reading needs none of this and never comes here.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { concat, fromBase64, toBase64, utf8, verifyAssertion, verifyAttestation } from "./attest.ts";

const JSON_HEADERS = { "Content-Type": "application/json" };

/** How long a challenge and a grant live. A device is quick; a replay is not. */
const CHALLENGE_SECONDS = 120;
const GRANT_SECONDS = 60;

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

interface Body {
  kind?: string;
  key_id?: string;
  attestation?: string;
  assertion?: string;
  challenge?: string;
  payload?: string;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return reply(405, { error: "method not allowed" });

  const authorization = request.headers.get("Authorization");
  if (!authorization) return reply(401, { error: "missing authorization" });

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const appId = Deno.env.get("APP_ATTEST_APP_ID");
  const rootPem = Deno.env.get("APP_ATTEST_ROOT_PEM") || undefined;
  if (!url || !anonKey || !serviceRoleKey || !appId) {
    return reply(500, { error: "function is misconfigured" });
  }

  // Who is asking, according to their own token and nothing else.
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: identity, error: identityError } = await caller.auth.getUser();
  const user = identity?.user;
  if (identityError || !user) return reply(401, { error: "not signed in" });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return reply(400, { error: "the body is not JSON" });
  }

  const admin = createClient(url, serviceRoleKey);

  // -------------------------------------------------------------------------
  // A challenge
  // -------------------------------------------------------------------------

  if (body.kind === "challenge") {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const expires = new Date(Date.now() + CHALLENGE_SECONDS * 1000).toISOString();
    const { error } = await admin.from("wall_attest_challenges").insert({
      profile_id: user.id, challenge: toBase64(challenge), expires_at: expires,
    });
    if (error) {
      // A profiles row may not exist yet for an account that has never
      // pushed one. Make the minimum and try once more.
      await admin.from("profiles").upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });
      const again = await admin.from("wall_attest_challenges").insert({
        profile_id: user.id, challenge: toBase64(challenge), expires_at: expires,
      });
      if (again.error) return reply(500, { error: "could not issue a challenge" });
    }
    return reply(200, { challenge: toBase64(challenge), expires_at: expires });
  }

  // -------------------------------------------------------------------------
  // The challenge the device says it used, taken once
  // -------------------------------------------------------------------------

  if (!body.challenge) return reply(400, { error: "a challenge is required" });
  const challengeBytes = fromBase64(body.challenge);
  if (challengeBytes.length !== 32) return reply(400, { error: "that is not a challenge" });
  const challengeText = toBase64(challengeBytes);
  const { data: taken, error: takeError } = await admin
    .from("wall_attest_challenges")
    .update({ used_at: new Date().toISOString() })
    .eq("profile_id", user.id)
    .eq("challenge", challengeText)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id");
  if (takeError || !taken || taken.length === 0) {
    return reply(403, { error: "that challenge is not yours, was used, or has expired" });
  }

  // -------------------------------------------------------------------------
  // Attesting a key, once per install
  // -------------------------------------------------------------------------

  if (body.kind === "attest") {
    if (!body.key_id || !body.attestation) return reply(400, { error: "key_id and attestation are required" });
    try {
      const result = await verifyAttestation({
        attestation: body.attestation, keyId: body.key_id, clientData: challengeBytes, appId, rootPem,
      });
      const { error } = await admin.from("wall_attest_keys").upsert({
        profile_id: user.id, key_id: body.key_id, public_key: result.publicKey, counter: result.counter,
        environment: result.environment, created_at: new Date().toISOString(), last_used_at: null,
      }, { onConflict: "profile_id" });
      if (error) return reply(500, { error: "could not keep the key" });
      return reply(200, { attested: true, environment: result.environment });
    } catch (error: unknown) {
      console.warn(`wall-write attest refused for ${user.id}: ${error instanceof Error ? error.message : error}`);
      return reply(403, { error: "this device could not be verified" });
    }
  }

  // -------------------------------------------------------------------------
  // A write: assert, grant, then call the database as the caller
  // -------------------------------------------------------------------------

  if (body.kind !== "write") return reply(400, { error: "kind is challenge, attest or write" });
  if (!body.key_id || !body.assertion || typeof body.payload !== "string") {
    return reply(400, { error: "key_id, assertion and payload are required" });
  }

  const { data: key } = await admin
    .from("wall_attest_keys")
    .select("key_id, public_key, counter")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!key || key.key_id !== body.key_id) return reply(403, { error: "this device has not been attested" });

  let counter: number;
  try {
    const result = await verifyAssertion({
      assertion: body.assertion, publicKey: key.public_key,
      clientData: concat(challengeBytes, utf8(body.payload)), appId, previousCounter: Number(key.counter),
    });
    counter = result.counter;
  } catch (error: unknown) {
    console.warn(`wall-write assertion refused for ${user.id}: ${error instanceof Error ? error.message : error}`);
    return reply(403, { error: "this device could not be verified" });
  }

  // The counter rises before anything is written, so the same assertion can
  // never be accepted twice even if what follows fails.
  const { error: counterError } = await admin
    .from("wall_attest_keys")
    .update({ counter, last_used_at: new Date().toISOString() })
    .eq("profile_id", user.id)
    .eq("counter", key.counter);
  if (counterError) return reply(500, { error: "could not record the assertion" });

  let action: { action?: string; url?: string; wall_date?: string; story_id?: string; units?: number; request_id?: string };
  try {
    action = JSON.parse(body.payload);
  } catch {
    return reply(400, { error: "payload is not JSON" });
  }

  const { error: grantError } = await admin.from("wall_attest_grants").insert({
    profile_id: user.id, expires_at: new Date(Date.now() + GRANT_SECONDS * 1000).toISOString(),
  });
  if (grantError) return reply(500, { error: "could not grant the write" });

  // As the caller. The database function reads auth.uid() from this token,
  // consumes the grant just written, and applies every rule itself.
  let name: string;
  let args: Record<string, unknown>;
  if (action.action === "submit") {
    name = "wall_submit_story";
    args = { url_in: action.url, wall_date_in: action.wall_date ?? null };
  } else if (action.action === "boost") {
    name = "wall_cast_boost";
    args = { story_id_in: action.story_id, units_in: action.units, request_id_in: action.request_id };
  } else if (action.action === "unboost") {
    // Taking a buzz back inside its thirty second window. docs/the-wall.md,
    // the last entry in section 16. It goes through here rather than being
    // called directly so the app has one write path, and the token is null
    // because the caller is the account: wall_forget_boost refuses a token
    // from an authenticated caller rather than obeying it.
    name = "wall_forget_boost";
    args = { story_id_in: action.story_id, voter_token_in: null };
  } else {
    return reply(400, { error: "action is submit, boost or unboost" });
  }

  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: anonKey, Authorization: authorization, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(args),
  });
  const text = await response.text();
  if (!response.ok) {
    // The database's own sentence, which is plain by design: "wall: 0 left
    // on 2026-09-09 today, not 1". Nothing else from the error is passed on.
    let message = "the wall refused that";
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (typeof parsed.message === "string" && parsed.message.startsWith("wall")) message = parsed.message;
    } catch {
      // keep the plain message
    }
    return reply(response.status >= 500 ? 502 : 409, { error: message });
  }
  return new Response(text, { status: 200, headers: JSON_HEADERS });
});
