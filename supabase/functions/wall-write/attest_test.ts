// Tests for attest.ts. Runs under Node, which has the same Web Crypto the
// Edge Function uses:
//
//   node --experimental-strip-types --test supabase/functions/wall-write/attest_test.ts
//
// The attestation test builds a whole certificate chain of its own, root,
// intermediate and credential, with keys made here, so the full path Apple
// describes is exercised without a device. Apple's real root is checked by
// verifying its own signature with its own key, which is the one thing a
// pinned certificate can prove about itself.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  APPLE_APP_ATTEST_ROOT_PEM, concat, decodeCbor, decodeOid, derSignatureToRaw, fromBase64, parseCertificate, pemToDer,
  sha256, toBase64, utf8, verifyAssertion, verifyAttestation, verifyCertificate,
} from "./attest.ts";

// ---------------------------------------------------------------------------
// Encoders the tests need and the function does not
// ---------------------------------------------------------------------------

function der(tag: number, content: Uint8Array): Uint8Array {
  let header: number[];
  const n = content.length;
  if (n < 128) header = [tag, n];
  else if (n < 256) header = [tag, 0x81, n];
  else header = [tag, 0x82, n >> 8, n & 0xff];
  return concat(new Uint8Array(header), content);
}
const seq = (...parts: Uint8Array[]): Uint8Array => der(0x30, concat(...parts));
const set = (...parts: Uint8Array[]): Uint8Array => der(0x31, concat(...parts));
const octets = (b: Uint8Array): Uint8Array => der(0x04, b);
const bits = (b: Uint8Array): Uint8Array => der(0x03, concat(new Uint8Array([0]), b));
const integer = (b: Uint8Array): Uint8Array => der(0x02, b[0]! & 0x80 ? concat(new Uint8Array([0]), b) : b);
const utf8String = (s: string): Uint8Array => der(0x0c, utf8(s));
const utcTime = (iso: string): Uint8Array => der(0x17, utf8(iso.replace(/[-:T]/g, "").slice(2, 14) + "Z"));
const explicit = (n: number, b: Uint8Array): Uint8Array => der(0xa0 | n, b);
const boolTrue = (): Uint8Array => der(0x01, new Uint8Array([0xff]));

function oid(text: string): Uint8Array {
  const parts = text.split(".").map(Number);
  const bytes: number[] = [parts[0]! * 40 + parts[1]!];
  for (const p of parts.slice(2)) {
    const stack: number[] = [];
    let v = p;
    do { stack.unshift(v & 0x7f); v = Math.floor(v / 128); } while (v > 0);
    for (let i = 0; i < stack.length - 1; i++) stack[i]! |= 0x80;
    bytes.push(...stack);
  }
  return der(0x06, new Uint8Array(bytes));
}

/** Raw r || s to the DER an Apple signature is. */
function rawSignatureToDer(raw: Uint8Array): Uint8Array {
  const half = raw.length / 2;
  const trim = (b: Uint8Array): Uint8Array => {
    let v = b;
    while (v.length > 1 && v[0] === 0 && (v[1]! & 0x80) === 0) v = v.slice(1);
    return v;
  };
  return seq(integer(trim(raw.slice(0, half))), integer(trim(raw.slice(half))));
}

function encodeCbor(value: unknown): Uint8Array {
  const head = (major: number, n: number): Uint8Array => {
    if (n < 24) return new Uint8Array([(major << 5) | n]);
    if (n < 256) return new Uint8Array([(major << 5) | 24, n]);
    return new Uint8Array([(major << 5) | 25, n >> 8, n & 0xff]);
  };
  if (typeof value === "number") return head(0, value);
  if (typeof value === "string") { const b = utf8(value); return concat(head(3, b.length), b); }
  if (value instanceof Uint8Array) return concat(head(2, value.length), value);
  if (Array.isArray(value)) return concat(head(4, value.length), ...value.map(encodeCbor));
  if (value === true) return new Uint8Array([0xf5]);
  if (value === false) return new Uint8Array([0xf4]);
  if (value === null) return new Uint8Array([0xf6]);
  const entries = Object.entries(value as Record<string, unknown>);
  return concat(head(5, entries.length), ...entries.flatMap(([k, v]) => [encodeCbor(k), encodeCbor(v)]));
}

// ---------------------------------------------------------------------------
// Keys and certificates made here
// ---------------------------------------------------------------------------

interface TestKey { pair: CryptoKeyPair; spki: Uint8Array; curve: "P-256" | "P-384" }

async function makeKey(curve: "P-256" | "P-384"): Promise<TestKey> {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: curve }, true, ["sign", "verify"]);
  return { pair, spki: new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey)), curve };
}

type Hash = "SHA-256" | "SHA-384";

/** The hash a key signs with unless told otherwise: its curve's own. */
function ownHash(key: TestKey): Hash {
  return key.curve === "P-256" ? "SHA-256" : "SHA-384";
}

async function sign(key: TestKey, message: Uint8Array, hash: Hash = ownHash(key)): Promise<Uint8Array> {
  const raw = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash }, key.pair.privateKey, message));
  return rawSignatureToDer(raw);
}

function name(cn: string): Uint8Array {
  return seq(set(seq(oid("2.5.4.3"), utf8String(cn))));
}

/**
 * A certificate for `subject`'s key, signed by `issuer`'s, with optional
 * extensions. `hash` is the issuer's own unless given: Apple signs the
 * device certificate with a P-384 key over SHA-256, and that pairing is
 * the one the Supabase runtime cannot verify, so the fixture below makes it
 * the way Apple does.
 */
async function certificate(
  subjectName: string, subject: TestKey, issuerName: string, issuer: TestKey,
  extensions: Uint8Array[] = [], validity: [string, string] = ["2026-01-01T00:00:00Z", "2036-01-01T00:00:00Z"],
  hash: Hash = ownHash(issuer),
): Promise<Uint8Array> {
  const algorithm = seq(oid(hash === "SHA-256" ? "1.2.840.10045.4.3.2" : "1.2.840.10045.4.3.3"));
  const tbs = seq(
    explicit(0, integer(new Uint8Array([2]))),
    integer(new Uint8Array([1, 2, 3])),
    algorithm,
    name(issuerName),
    seq(utcTime(validity[0]), utcTime(validity[1])),
    name(subjectName),
    subject.spki,
    ...(extensions.length > 0 ? [explicit(3, seq(...extensions))] : []),
  );
  return seq(tbs, algorithm, bits(await sign(issuer, tbs, hash)));
}

function pem(derBytes: Uint8Array): string {
  return `-----BEGIN CERTIFICATE-----\n${toBase64(derBytes)}\n-----END CERTIFICATE-----`;
}

const APP_ID = "ABCDE12345.app.birthed.ios";

function be32(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}

async function authenticatorData(counter: number, appId: string = APP_ID, attested?: { aaguid: string; credentialId: Uint8Array }): Promise<Uint8Array> {
  const rp = await sha256(utf8(appId));
  const flags = new Uint8Array([attested ? 0x40 : 0x00]);
  if (!attested) return concat(rp, flags, be32(counter));
  const aaguid = new Uint8Array(16);
  aaguid.set(utf8(attested.aaguid));
  const length = new Uint8Array([attested.credentialId.length >> 8, attested.credentialId.length & 0xff]);
  return concat(rp, flags, be32(counter), aaguid, length, attested.credentialId);
}

// ---------------------------------------------------------------------------
// The pieces
// ---------------------------------------------------------------------------

test("Apple's pinned root parses, names itself, and verifies its own signature with its own key", async () => {
  const root = parseCertificate(pemToDer(APPLE_APP_ATTEST_ROOT_PEM));
  assert.equal(root.subject, "Apple App Attestation Root CA");
  assert.equal(root.curve, "P-384");
  assert.equal(root.signatureAlgorithm, "1.2.840.10045.4.3.3");
  assert.ok(root.notAfter > Date.parse("2040-01-01T00:00:00Z"));
  assert.equal(await verifyCertificate(root, root), true, "a wrong byte in the pinned root fails here, not on a device");
});

test("the certificate parser reads what it made and refuses a forged signature", async () => {
  const root = await makeKey("P-384");
  const leaf = await makeKey("P-256");
  const rootCert = parseCertificate(await certificate("Test Root", root, "Test Root", root));
  const leafCert = parseCertificate(await certificate("Leaf", leaf, "Test Root", root));
  assert.equal(leafCert.subject, "Leaf");
  assert.equal(leafCert.curve, "P-256");
  assert.equal(leafCert.publicKeyPoint.length, 65);
  assert.equal(await verifyCertificate(leafCert, rootCert), true);
  const other = await makeKey("P-384");
  const otherCert = parseCertificate(await certificate("Other", other, "Other", other));
  assert.equal(await verifyCertificate(leafCert, otherCert), false);
});

test("a P-384 key signing over SHA-256, Apple's pairing, verifies and a forgery does not", async () => {
  const issuer = await makeKey("P-384");
  const leaf = await makeKey("P-256");
  const issuerCert = parseCertificate(await certificate("Issuer", issuer, "Issuer", issuer));
  const leafCert = parseCertificate(await certificate("Leaf", leaf, "Issuer", issuer, [], undefined, "SHA-256"));
  assert.equal(leafCert.signatureAlgorithm, "1.2.840.10045.4.3.2");
  assert.equal(await verifyCertificate(leafCert, issuerCert), true);
  const other = await makeKey("P-384");
  const otherCert = parseCertificate(await certificate("Other", other, "Other", other));
  assert.equal(await verifyCertificate(leafCert, otherCert), false);
  const forged = { ...leafCert, tbs: concat(leafCert.tbs, new Uint8Array([1])) };
  assert.equal(await verifyCertificate(forged, issuerCert), false);
});

test("object identifiers, base64 and CBOR read back what was written", () => {
  assert.equal(decodeOid(oid("1.2.840.113635.100.8.2").slice(2)), "1.2.840.113635.100.8.2");
  const bytes = new Uint8Array([0, 1, 2, 250, 251, 255]);
  assert.deepEqual(fromBase64(toBase64(bytes)), bytes);
  assert.deepEqual(fromBase64("AAEC-vv_"), bytes, "base64url is accepted too");
  const value = { fmt: "apple-appattest", attStmt: { x5c: [new Uint8Array([1, 2]), new Uint8Array(300)], receipt: new Uint8Array([9]) }, authData: new Uint8Array([7, 7]), n: 1000, ok: true, nothing: null };
  assert.deepEqual(decodeCbor(encodeCbor(value)), value);
  assert.throws(() => decodeCbor(new Uint8Array([0x5f])), /indefinite/);
  assert.throws(() => decodeCbor(concat(encodeCbor(1), new Uint8Array([0]))), /trailing/);
});

test("a DER signature becomes raw r || s at the curve's size, leading zeros and all", () => {
  const r = new Uint8Array(32).fill(1);
  const s = new Uint8Array(32).fill(0x90);
  const raw = derSignatureToRaw(seq(integer(r), integer(s)), 32);
  assert.deepEqual(raw, concat(r, s));
  const short = derSignatureToRaw(seq(integer(new Uint8Array([5])), integer(new Uint8Array([6]))), 32);
  assert.equal(short.length, 64);
  assert.equal(short[31], 5);
  assert.equal(short[63], 6);
});

// ---------------------------------------------------------------------------
// Attestation, end to end, on a chain made here
// ---------------------------------------------------------------------------

async function attestationFixture(options: { nonceTamper?: boolean; wrongKeyId?: boolean; counter?: number; aaguid?: string; appId?: string } = {}) {
  const root = await makeKey("P-384");
  const intermediate = await makeKey("P-384");
  const credential = await makeKey("P-256");
  const rootPem = pem(await certificate("Test Attestation Root", root, "Test Attestation Root", root));
  const caCert = await certificate("Test Attestation CA 1", intermediate, "Test Attestation Root", root);

  const point = parseCertificate(await certificate("x", credential, "x", credential)).publicKeyPoint;
  const keyId = await sha256(point);
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const authData = await authenticatorData(options.counter ?? 0, options.appId ?? APP_ID, {
    aaguid: options.aaguid ?? "appattest", credentialId: options.wrongKeyId ? new Uint8Array(32) : keyId,
  });
  const nonce = await sha256(concat(authData, await sha256(challenge)));
  if (options.nonceTamper) nonce[0] ^= 1;
  const nonceExtension = seq(oid("1.2.840.113635.100.8.2"), octets(seq(explicit(1, octets(nonce)))));
  // Signed the way Apple signs it: the P-384 intermediate over SHA-256.
  const credCert = await certificate("Test Credential", credential, "Test Attestation CA 1", intermediate, [nonceExtension],
    undefined, "SHA-256");

  const attestation = toBase64(encodeCbor({
    fmt: "apple-appattest",
    attStmt: { x5c: [credCert, caCert], receipt: new Uint8Array([1]) },
    authData,
  }));
  return { attestation, keyId: toBase64(keyId), challenge, rootPem, credential, credentialSpki: credential.spki };
}

test("a good attestation chains to the root, matches the nonce and the key identifier, and yields the key", async () => {
  const f = await attestationFixture();
  const result = await verifyAttestation({ attestation: f.attestation, keyId: f.keyId, clientData: f.challenge, appId: APP_ID, rootPem: f.rootPem });
  assert.equal(result.environment, "appattest");
  assert.equal(result.counter, 0);
  assert.deepEqual(fromBase64(result.publicKey), f.credentialSpki);
});

test("the development environment is named as such", async () => {
  const f = await attestationFixture({ aaguid: "appattestdevelop" });
  const result = await verifyAttestation({ attestation: f.attestation, keyId: f.keyId, clientData: f.challenge, appId: APP_ID, rootPem: f.rootPem });
  assert.equal(result.environment, "appattestdevelop");
});

test("an attestation against the wrong root, a wrong nonce, a wrong key identifier, a used counter, another app or a replayed challenge is refused", async () => {
  const good = await attestationFixture();
  const otherRoot = (await attestationFixture()).rootPem;
  await assert.rejects(verifyAttestation({ attestation: good.attestation, keyId: good.keyId, clientData: good.challenge, appId: APP_ID, rootPem: otherRoot }), /not signed by its issuer/);
  await assert.rejects(verifyAttestation({ attestation: good.attestation, keyId: good.keyId, clientData: good.challenge, appId: APP_ID }), /not signed by its issuer/, "Apple's real root refuses a chain it did not sign");

  const tampered = await attestationFixture({ nonceTamper: true });
  await assert.rejects(verifyAttestation({ attestation: tampered.attestation, keyId: tampered.keyId, clientData: tampered.challenge, appId: APP_ID, rootPem: tampered.rootPem }), /nonce/);

  const replayed = crypto.getRandomValues(new Uint8Array(32));
  await assert.rejects(verifyAttestation({ attestation: good.attestation, keyId: good.keyId, clientData: replayed, appId: APP_ID, rootPem: good.rootPem }), /nonce/);

  const wrongKey = await attestationFixture({ wrongKeyId: true });
  await assert.rejects(verifyAttestation({ attestation: wrongKey.attestation, keyId: toBase64(new Uint8Array(32)), clientData: wrongKey.challenge, appId: APP_ID, rootPem: wrongKey.rootPem }), /key identifier/);

  const used = await attestationFixture({ counter: 3 });
  await assert.rejects(verifyAttestation({ attestation: used.attestation, keyId: used.keyId, clientData: used.challenge, appId: APP_ID, rootPem: used.rootPem }), /counter/);

  const otherApp = await attestationFixture({ appId: "ZZZZZ99999.some.other.app" });
  await assert.rejects(verifyAttestation({ attestation: otherApp.attestation, keyId: otherApp.keyId, clientData: otherApp.challenge, appId: APP_ID, rootPem: otherApp.rootPem }), /not this app/);

  const unknown = await attestationFixture({ aaguid: "somethingelse" });
  await assert.rejects(verifyAttestation({ attestation: unknown.attestation, keyId: unknown.keyId, clientData: unknown.challenge, appId: APP_ID, rootPem: unknown.rootPem }), /environment/);
});

// ---------------------------------------------------------------------------
// Assertion
// ---------------------------------------------------------------------------

async function assertionFixture(key: TestKey, counter: number, clientData: Uint8Array, appId: string = APP_ID): Promise<string> {
  const authData = await authenticatorData(counter, appId);
  const nonce = await sha256(concat(authData, await sha256(clientData)));
  const signature = await sign(key, nonce);
  return toBase64(encodeCbor({ signature, authenticatorData: authData }));
}

test("an assertion over the challenge and the request verifies, and the counter must rise", async () => {
  const key = await makeKey("P-256");
  const publicKey = toBase64(key.spki);
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const payload = utf8(JSON.stringify({ kind: "boost", story_id: "abc", units: 2 }));
  const clientData = concat(challenge, payload);

  const first = await verifyAssertion({ assertion: await assertionFixture(key, 1, clientData), publicKey, clientData, appId: APP_ID, previousCounter: 0 });
  assert.equal(first.counter, 1);
  const later = await verifyAssertion({ assertion: await assertionFixture(key, 7, clientData), publicKey, clientData, appId: APP_ID, previousCounter: 1 });
  assert.equal(later.counter, 7);

  // The same assertion again: the counter has not risen, so it is a replay.
  await assert.rejects(verifyAssertion({ assertion: await assertionFixture(key, 7, clientData), publicKey, clientData, appId: APP_ID, previousCounter: 7 }), /counter/);

  // A different request under the same signature.
  const changed = concat(challenge, utf8(JSON.stringify({ kind: "boost", story_id: "abc", units: 3 })));
  await assert.rejects(verifyAssertion({ assertion: await assertionFixture(key, 8, clientData), publicKey, clientData: changed, appId: APP_ID, previousCounter: 7 }), /signature/);

  // Another key.
  const other = await makeKey("P-256");
  await assert.rejects(verifyAssertion({ assertion: await assertionFixture(other, 9, clientData), publicKey, clientData, appId: APP_ID, previousCounter: 7 }), /signature/);

  // Another app.
  await assert.rejects(verifyAssertion({ assertion: await assertionFixture(key, 9, clientData, "ZZZZZ99999.other"), publicKey, clientData, appId: APP_ID, previousCounter: 7 }), /not this app/);
});
