// FR-014. Deletes the caller's account and everything stored with it.
//
// This has to be a function rather than a client call, for two reasons.
// Removing a row from auth.users needs the service role, and row level
// security correctly stops a client doing that. And two tables do not cascade
// on their own, so they are handled explicitly here. docs/specs/SDS.md section 13.
//
// The caller is identified from their own token, never from the request body,
// so nobody can delete somebody else's account by guessing an identifier.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const JSON_HEADERS = { "Content-Type": "application/json" };

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: JSON_HEADERS,
    });
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return new Response(JSON.stringify({ error: "missing authorization" }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "function is misconfigured" }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }

  // Who is asking, according to their own token and nothing else.
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: identity, error: identityError } = await caller.auth.getUser();
  const user = identity?.user;
  if (identityError || !user) {
    return new Response(JSON.stringify({ error: "not signed in" }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }

  const admin = createClient(url, serviceRoleKey);

  // events.profile_id carries no foreign key, so nothing happens to it
  // automatically. It is nulled rather than deleted because an event is not
  // personal once it has no identifier on it. The table may not exist yet, in
  // which case there is nothing to do and the error is not interesting.
  try {
    await admin.from("events").update({ profile_id: null }).eq("profile_id", user.id);
  } catch (_) {
    // no events table yet
  }

  // problem_reports.profile_id is ON DELETE SET NULL by design, so the report
  // survives the account without carrying anything identifying. profiles,
  // user_offer_states and claims all cascade from auth.users.
  const { error: deletionError } = await admin.auth.admin.deleteUser(user.id);
  if (deletionError) {
    return new Response(JSON.stringify({ error: deletionError.message }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }

  return new Response(JSON.stringify({ deleted: true }), {
    status: 200,
    headers: JSON_HEADERS,
  });
});
