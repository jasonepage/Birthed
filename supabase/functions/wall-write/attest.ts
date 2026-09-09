// App Attest, checked on the server. docs/the-wall.md sections 6 and 12.
//
// Apple's DeviceCheck framework lets an app prove, with a key the Secure
// Enclave made, that a request came from a genuine copy of Birthed on a real
// Apple device. Two steps. Once per install the app attests the key, and
// Apple signs a statement about it that this file checks against Apple's
// root certificate. Then, on every write, the app asserts: it signs a hash
// of a challenge this server issued plus the request it is making, and this
// file checks that signature against the key it kept. Nothing here is
// trusted from the client: the challenge is ours, the counter must rise, and
// the key is the one Apple vouched for.
//
// Pure. No runtime import, so it runs under Deno in the Edge Function and
// under Node in its test. Web Crypto does the hashing and the signature
// checks; the two byte formats Apple uses, CBOR for the envelope and DER for
// the certificates, are read by the small parsers below, which read only the
// shapes this needs and refuse everything else.
//
// The steps follow Apple's "Validating apps that connect to your server",
// in the order given there.

// ---------------------------------------------------------------------------
// Bytes
// ---------------------------------------------------------------------------

export function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
  const padded = clean + "=".repeat((4 - (clean.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

export function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

export function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

// ---------------------------------------------------------------------------
// CBOR, the little of it an attestation uses
// ---------------------------------------------------------------------------

export type Cbor = number | string | Uint8Array | boolean | null | Cbor[] | { [key: string]: Cbor };

export function decodeCbor(bytes: Uint8Array): Cbor {
  let at = 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  function argument(first: number): number {
    const low = first & 0x1f;
    if (low < 24) return low;
    if (low === 24) return bytes[at++]!;
    if (low === 25) { const v = view.getUint16(at); at += 2; return v; }
    if (low === 26) { const v = view.getUint32(at); at += 4; return v; }
    if (low === 27) {
      const high = view.getUint32(at);
      const lowWord = view.getUint32(at + 4);
      at += 8;
      if (high > 0x1fffff) throw new Error("cbor: integer too large");
      return high * 0x100000000 + lowWord;
    }
    throw new Error("cbor: indefinite lengths are not used here");
  }

  function item(): Cbor {
    if (at >= bytes.length) throw new Error("cbor: truncated");
    const first = bytes[at++]!;
    const major = first >> 5;
    switch (major) {
      case 0: return argument(first);
      case 1: return -1 - argument(first);
      case 2: {
        const n = argument(first);
        if (at + n > bytes.length) throw new Error("cbor: truncated byte string");
        const out = bytes.slice(at, at + n);
        at += n;
        return out;
      }
      case 3: {
        const n = argument(first);
        if (at + n > bytes.length) throw new Error("cbor: truncated text string");
        const out = new TextDecoder().decode(bytes.slice(at, at + n));
        at += n;
        return out;
      }
      case 4: {
        const n = argument(first);
        const out: Cbor[] = [];
        for (let i = 0; i < n; i++) out.push(item());
        return out;
      }
      case 5: {
        const n = argument(first);
        const out: { [key: string]: Cbor } = {};
        for (let i = 0; i < n; i++) {
          const key = item();
          if (typeof key !== "string" && typeof key !== "number") throw new Error("cbor: a map key here is text or a number");
          out[String(key)] = item();
        }
        return out;
      }
      case 6: { argument(first); return item(); }
      case 7: {
        const low = first & 0x1f;
        if (low === 20) return false;
        if (low === 21) return true;
        if (low === 22 || low === 23) return null;
        throw new Error("cbor: floats and simple values are not used here");
      }
      default: throw new Error("cbor: unreadable");
    }
  }

  const out = item();
  if (at !== bytes.length) throw new Error("cbor: trailing bytes");
  return out;
}

// ---------------------------------------------------------------------------
// DER, enough to read an X.509 certificate
// ---------------------------------------------------------------------------

export interface Der {
  /** The tag byte, class and constructed bit included. */
  tag: number;
  /** The content bytes. */
  value: Uint8Array;
  /** The whole element, header included. */
  raw: Uint8Array;
  /** Where the next element begins, relative to the slice this was read from. */
  end: number;
}

export function readDer(bytes: Uint8Array, at: number = 0): Der {
  if (at + 2 > bytes.length) throw new Error("der: truncated");
  const tag = bytes[at]!;
  let length = bytes[at + 1]!;
  let headerLength = 2;
  if (length & 0x80) {
    const n = length & 0x7f;
    if (n === 0 || n > 4) throw new Error("der: unsupported length");
    length = 0;
    for (let i = 0; i < n; i++) length = (length << 8) | bytes[at + 2 + i]!;
    headerLength = 2 + n;
  }
  const start = at + headerLength;
  const end = start + length;
  if (end > bytes.length) throw new Error("der: truncated element");
  return { tag, value: bytes.slice(start, end), raw: bytes.slice(at, end), end };
}

/** Every element inside a constructed element, in order. */
export function children(element: Der): Der[] {
  const out: Der[] = [];
  let at = 0;
  while (at < element.value.length) {
    const child = readDer(element.value, at);
    out.push(child);
    at = child.end;
  }
  return out;
}

export function decodeOid(bytes: Uint8Array): string {
  const parts: number[] = [];
  let value = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    value = value * 128 + (b & 0x7f);
    if ((b & 0x80) === 0) {
      if (parts.length === 0) {
        parts.push(Math.floor(value / 40), value % 40);
      } else {
        parts.push(value);
      }
      value = 0;
    }
  }
  return parts.join(".");
}

const SEQUENCE = 0x30;
const OCTET_STRING = 0x04;
const OID = 0x06;
const BIT_STRING = 0x03;
const BOOLEAN = 0x01;
const UTC_TIME = 0x17;
const GENERALIZED_TIME = 0x18;

export interface Certificate {
  /** The bytes the signature covers. */
  tbs: Uint8Array;
  /** The whole certificate. */
  raw: Uint8Array;
  signatureAlgorithm: string;
  /** The DER encoded ECDSA signature. */
  signature: Uint8Array;
  /** SubjectPublicKeyInfo, whole, ready for Web Crypto. */
  spki: Uint8Array;
  /** The curve the public key is on. */
  curve: "P-256" | "P-384";
  /** The uncompressed public key point, 04 || x || y. */
  publicKeyPoint: Uint8Array;
  notBefore: number;
  notAfter: number;
  /** Extension values by object identifier, as the raw octet string contents. */
  extensions: Map<string, Uint8Array>;
  subject: string;
}

function derTime(element: Der): number {
  const text = new TextDecoder().decode(element.value);
  let iso: string;
  if (element.tag === UTC_TIME) {
    const yy = Number(text.slice(0, 2));
    const year = yy >= 50 ? 1900 + yy : 2000 + yy;
    iso = `${year}-${text.slice(2, 4)}-${text.slice(4, 6)}T${text.slice(6, 8)}:${text.slice(8, 10)}:${text.slice(10, 12)}Z`;
  } else if (element.tag === GENERALIZED_TIME) {
    iso = `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}T${text.slice(8, 10)}:${text.slice(10, 12)}:${text.slice(12, 14)}Z`;
  } else {
    throw new Error("der: not a time");
  }
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) throw new Error("der: unreadable time");
  return parsed;
}

function nameOf(element: Der): string {
  // A Name is a sequence of sets of attribute type and value. Only the
  // common name is worth reading, and only for a message.
  for (const set of children(element)) {
    for (const pair of children(set)) {
      const [type, value] = children(pair);
      if (type && value && decodeOid(type.value) === "2.5.4.3") return new TextDecoder().decode(value.value);
    }
  }
  return "";
}

export function parseCertificate(bytes: Uint8Array): Certificate {
  const cert = readDer(bytes);
  if (cert.tag !== SEQUENCE) throw new Error("certificate: not a sequence");
  const [tbs, algorithm, signatureBits] = children(cert);
  if (!tbs || !algorithm || !signatureBits) throw new Error("certificate: three parts expected");

  const fields = children(tbs);
  let i = 0;
  if (fields[0]?.tag === 0xa0) i = 1; // version, explicit [0]
  i += 1; // serial number
  i += 1; // signature algorithm, repeated
  i += 1; // issuer
  const validity = fields[i++];
  const subject = fields[i++];
  const spki = fields[i++];
  if (!validity || !subject || !spki) throw new Error("certificate: short");
  const [notBefore, notAfter] = children(validity);
  if (!notBefore || !notAfter) throw new Error("certificate: no validity");

  const extensions = new Map<string, Uint8Array>();
  for (; i < fields.length; i++) {
    const field = fields[i]!;
    if (field.tag !== 0xa3) continue;
    const list = readDer(field.value);
    for (const extension of children(list)) {
      const parts = children(extension);
      const oid = parts[0];
      let valueIndex = 1;
      if (parts[1]?.tag === BOOLEAN) valueIndex = 2;
      const value = parts[valueIndex];
      if (!oid || oid.tag !== OID || !value || value.tag !== OCTET_STRING) continue;
      extensions.set(decodeOid(oid.value), value.value);
    }
  }

  const [spkiAlgorithm, spkiBits] = children(spki);
  if (!spkiAlgorithm || !spkiBits || spkiBits.tag !== BIT_STRING) throw new Error("certificate: no public key");
  const [keyType, curveOid] = children(spkiAlgorithm);
  if (!keyType || decodeOid(keyType.value) !== "1.2.840.10045.2.1" || !curveOid) throw new Error("certificate: not an elliptic curve key");
  const curveName = decodeOid(curveOid.value);
  const curve = curveName === "1.2.840.10045.3.1.7" ? "P-256" : curveName === "1.3.132.0.34" ? "P-384" : null;
  if (curve === null) throw new Error(`certificate: unsupported curve ${curveName}`);

  const [sigOid] = children(algorithm);
  if (!sigOid) throw new Error("certificate: no signature algorithm");
  if (signatureBits.tag !== BIT_STRING || signatureBits.value[0] !== 0) throw new Error("certificate: odd signature");

  return {
    tbs: tbs.raw,
    raw: cert.raw,
    signatureAlgorithm: decodeOid(sigOid.value),
    signature: signatureBits.value.slice(1),
    spki: spki.raw,
    curve,
    publicKeyPoint: spkiBits.value.slice(1),
    notBefore: derTime(notBefore),
    notAfter: derTime(notAfter),
    extensions,
    subject: nameOf(subject),
  };
}

export function pemToDer(pem: string): Uint8Array {
  const body = pem.replace(/-----BEGIN [^-]+-----/g, "").replace(/-----END [^-]+-----/g, "");
  return fromBase64(body);
}

// ---------------------------------------------------------------------------
// Signatures
// ---------------------------------------------------------------------------

/** An ECDSA signature as DER, Sequence { Integer r, Integer s }, to the raw r || s Web Crypto wants. */
export function derSignatureToRaw(der: Uint8Array, size: number): Uint8Array {
  const sequence = readDer(der);
  if (sequence.tag !== SEQUENCE) throw new Error("signature: not a sequence");
  const [r, s] = children(sequence);
  if (!r || !s) throw new Error("signature: two integers expected");
  const fit = (integer: Uint8Array): Uint8Array => {
    let v = integer;
    while (v.length > size && v[0] === 0) v = v.slice(1);
    if (v.length > size) throw new Error("signature: integer too long");
    const out = new Uint8Array(size);
    out.set(v, size - v.length);
    return out;
  };
  return concat(fit(r.value), fit(s.value));
}

const HASH_FOR: Record<string, "SHA-256" | "SHA-384"> = {
  "1.2.840.10045.4.3.2": "SHA-256",
  "1.2.840.10045.4.3.3": "SHA-384",
};

/** Whether `signed` carries a valid signature from the holder of `issuer`'s key. */
export async function verifyCertificate(signed: Certificate, issuer: Certificate): Promise<boolean> {
  const hash = HASH_FOR[signed.signatureAlgorithm];
  if (hash === undefined) return false;
  const key = await crypto.subtle.importKey("spki", issuer.spki, { name: "ECDSA", namedCurve: issuer.curve }, false, ["verify"]);
  const size = issuer.curve === "P-256" ? 32 : 48;
  let raw: Uint8Array;
  try {
    raw = derSignatureToRaw(signed.signature, size);
  } catch {
    return false;
  }
  return crypto.subtle.verify({ name: "ECDSA", hash }, key, raw, signed.tbs);
}

/** Whether `signature` (DER) over `message` is by the P-256 key in `spki`. */
export async function verifyP256(spki: Uint8Array, signature: Uint8Array, message: Uint8Array): Promise<boolean> {
  const key = await crypto.subtle.importKey("spki", spki, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  let raw: Uint8Array;
  try {
    raw = derSignatureToRaw(signature, 32);
  } catch {
    return false;
  }
  return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, raw, message);
}

// ---------------------------------------------------------------------------
// Apple's root
// ---------------------------------------------------------------------------

/**
 * Apple App Attestation Root CA, from
 * https://www.apple.com/certificateauthority/Apple_App_Attestation_Root_CA.pem
 * as published. The test checks this certificate's own signature with its
 * own key, so a wrong byte here fails the test rather than a device. It can
 * be replaced at run time with APP_ATTEST_ROOT_PEM.
 */
export const APPLE_APP_ATTEST_ROOT_PEM = `-----BEGIN CERTIFICATE-----
MIICITCCAaegAwIBAgIQC/O+DvHN0uD7jG5yH2IXmDAKBggqhkjOPQQDAzBSMSYw
JAYDVQQDDB1BcHBsZSBBcHAgQXR0ZXN0YXRpb24gUm9vdCBDQTETMBEGA1UECgwK
QXBwbGUgSW5jLjETMBEGA1UECAwKQ2FsaWZvcm5pYTAeFw0yMDAzMTgxODMyNTNa
Fw00NTAzMTUwMDAwMDBaMFIxJjAkBgNVBAMMHUFwcGxlIEFwcCBBdHRlc3RhdGlv
biBSb290IENBMRMwEQYDVQQKDApBcHBsZSBJbmMuMRMwEQYDVQQIDApDYWxpZm9y
bmlhMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAERTHhmLW07ATaFQIEVwTtT4dyctdh
NbJhFs/Ii2FdCgAHGbpphY3+d8qjuDngIN3WVhQUBHAoMeQ/cLiP1sOUtgjqK9au
Yen1mMEvRq9Sk3Jm5X8U62H+xTD3FE9TgS41o0IwQDAPBgNVHRMBAf8EBTADAQH/
MB0GA1UdDgQWBBSskRBTM72+aEH/pwyp5frq5eWKoTAOBgNVHQ8BAf8EBAMCAQYw
CgYIKoZIzj0EAwMDaAAwZQIwQgFGnByvsiVbpTKwSga0kP0e8EeDS4+sQmTvb7vn
53O5+FRXgeLhpJ06ysC5PrOyAjEAp5U4xDgEgllF7En3VcE3iexZZtKeYnpqtijV
oyFraWVIyd/dganmrduC1bmTBGwD
-----END CERTIFICATE-----`;

// ---------------------------------------------------------------------------
// Attestation
// ---------------------------------------------------------------------------

/** The extension Apple puts the nonce in. */
const NONCE_EXTENSION = "1.2.840.113635.100.8.2";

export type Environment = "appattest" | "appattestdevelop";

export interface AttestationResult {
  /** The attested P-256 public key as SubjectPublicKeyInfo, base64. */
  publicKey: string;
  environment: Environment;
  /** What the authenticator data carried: zero, on a fresh key. */
  counter: number;
}

export interface AttestationInput {
  /** The CBOR attestation object the device produced, base64. */
  attestation: string;
  /** The key identifier the device reported, base64. */
  keyId: string;
  /** What the device hashed: the challenge this server issued, raw. */
  clientData: Uint8Array;
  /** Team identifier, a dot, and the bundle identifier. */
  appId: string;
  /** The root to chain to. Apple's unless a test says otherwise. */
  rootPem?: string;
  now?: number;
}

/**
 * Checks an attestation object the way Apple's document lists it, and
 * returns the key to keep. Throws with a plain reason on any failure; the
 * reason is for the log, and the client is told only that the device could
 * not be verified.
 */
export async function verifyAttestation(input: AttestationInput): Promise<AttestationResult> {
  const now = input.now ?? Date.now();
  const decoded = decodeCbor(fromBase64(input.attestation));
  if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded) || decoded instanceof Uint8Array) {
    throw new Error("attestation: not a map");
  }
  if (decoded["fmt"] !== "apple-appattest") throw new Error("attestation: not apple-appattest");
  const statement = decoded["attStmt"];
  const authData = decoded["authData"];
  if (typeof statement !== "object" || statement === null || Array.isArray(statement) || statement instanceof Uint8Array) {
    throw new Error("attestation: no statement");
  }
  if (!(authData instanceof Uint8Array)) throw new Error("attestation: no authenticator data");
  const x5c = statement["x5c"];
  if (!Array.isArray(x5c) || x5c.length < 2 || !x5c.every((c) => c instanceof Uint8Array)) {
    throw new Error("attestation: certificate chain missing");
  }

  // 1. The chain, up to Apple's root.
  const chain = (x5c as Uint8Array[]).map(parseCertificate);
  const root = parseCertificate(pemToDer(input.rootPem ?? APPLE_APP_ATTEST_ROOT_PEM));
  const credential = chain[0]!;
  for (let i = 0; i < chain.length; i++) {
    const cert = chain[i]!;
    if (now < cert.notBefore || now > cert.notAfter) throw new Error(`attestation: certificate ${i} is not valid now`);
    const issuer = chain[i + 1] ?? root;
    if (!(await verifyCertificate(cert, issuer))) throw new Error(`attestation: certificate ${i} is not signed by its issuer`);
  }
  if (!(await verifyCertificate(root, root))) throw new Error("attestation: the root does not verify itself");

  // 2 and 3. The nonce: a hash of the authenticator data and the client data hash.
  const clientDataHash = await sha256(input.clientData);
  const nonce = await sha256(concat(authData, clientDataHash));

  // 4. The nonce is in the credential certificate's extension, as a sequence
  // holding one tagged octet string.
  const extension = credential.extensions.get(NONCE_EXTENSION);
  if (extension === undefined) throw new Error("attestation: no nonce extension");
  const outer = readDer(extension);
  const tagged = readDer(outer.value);
  const octets = readDer(tagged.value);
  if (octets.tag !== OCTET_STRING || !equal(octets.value, nonce)) throw new Error("attestation: nonce does not match");

  // 5. The key identifier is the hash of the public key.
  const keyId = fromBase64(input.keyId);
  if (credential.curve !== "P-256" || credential.publicKeyPoint.length !== 65) throw new Error("attestation: not a P-256 key");
  if (!equal(await sha256(credential.publicKeyPoint), keyId)) throw new Error("attestation: key identifier does not match the key");

  // 6. The relying party is this app.
  const rpIdHash = authData.slice(0, 32);
  if (!equal(rpIdHash, await sha256(utf8(input.appId)))) throw new Error("attestation: not this app");

  // 7. A fresh key has never signed anything.
  const view = new DataView(authData.buffer, authData.byteOffset, authData.byteLength);
  const counter = view.getUint32(33);
  if (counter !== 0) throw new Error("attestation: counter is not zero");

  // 8. The environment, from the attested credential data.
  const aaguid = new TextDecoder().decode(authData.slice(37, 53)).replace(/\0+$/, "");
  const environment: Environment = aaguid === "appattest" ? "appattest" : aaguid === "appattestdevelop" ? "appattestdevelop" : (() => {
    throw new Error("attestation: unknown environment");
  })();

  // 9. The credential identifier is the key identifier.
  const credentialIdLength = view.getUint16(53);
  const credentialId = authData.slice(55, 55 + credentialIdLength);
  if (!equal(credentialId, keyId)) throw new Error("attestation: credential identifier does not match");

  return { publicKey: toBase64(credential.spki), environment, counter };
}

// ---------------------------------------------------------------------------
// Assertion
// ---------------------------------------------------------------------------

export interface AssertionInput {
  /** The CBOR assertion the device produced, base64. */
  assertion: string;
  /** The stored public key, base64 SubjectPublicKeyInfo. */
  publicKey: string;
  /** The bytes the device hashed as client data. */
  clientData: Uint8Array;
  appId: string;
  /** The counter the last accepted assertion carried. */
  previousCounter: number;
}

export interface AssertionResult {
  counter: number;
}

/**
 * Checks an assertion: the signature over the nonce, the app, and a counter
 * that has risen. Throws with a plain reason on any failure.
 */
export async function verifyAssertion(input: AssertionInput): Promise<AssertionResult> {
  const decoded = decodeCbor(fromBase64(input.assertion));
  if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded) || decoded instanceof Uint8Array) {
    throw new Error("assertion: not a map");
  }
  const signature = decoded["signature"];
  const authenticatorData = decoded["authenticatorData"];
  if (!(signature instanceof Uint8Array) || !(authenticatorData instanceof Uint8Array)) throw new Error("assertion: incomplete");
  if (authenticatorData.length < 37) throw new Error("assertion: authenticator data too short");

  const clientDataHash = await sha256(input.clientData);
  const nonce = await sha256(concat(authenticatorData, clientDataHash));
  if (!(await verifyP256(fromBase64(input.publicKey), signature, nonce))) throw new Error("assertion: signature does not verify");

  if (!equal(authenticatorData.slice(0, 32), await sha256(utf8(input.appId)))) throw new Error("assertion: not this app");

  const view = new DataView(authenticatorData.buffer, authenticatorData.byteOffset, authenticatorData.byteLength);
  const counter = view.getUint32(33);
  if (counter <= input.previousCounter) throw new Error("assertion: counter did not rise");

  return { counter };
}
