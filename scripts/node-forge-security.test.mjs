import assert from "node:assert/strict";
import { constants, createHash, generateKeyPairSync, privateEncrypt, sign } from "node:crypto";
import { createRequire } from "node:module";
import { test } from "node:test";

// Exercise the dependency used by Nuxt's development HTTPS server, including
// pnpm's installed patch, without relying on pnpm's internal store directory.
const exampleRequire = createRequire(new URL("../apps/example-nuxt/package.json", import.meta.url));
const nuxtRequire = createRequire(exampleRequire.resolve("nuxt/package.json"));
const cliRequire = createRequire(nuxtRequire.resolve("@nuxt/cli"));
const listhenRequire = createRequire(cliRequire.resolve("listhen"));
const forge = listhenRequire("node-forge");

// Backport provenance: https://github.com/digitalbazaar/forge/pull/1152 and
// https://github.com/digitalbazaar/forge/pull/1157. These fixtures are signed
// with an ephemeral private key to test malformed-encoding rejection; they
// are not a demonstration of signature forgery without a private key.
const keys = generateKeyPairSync("rsa", { modulusLength: 2048, publicExponent: 3 });
const publicKey = forge.pki.publicKeyFromPem(keys.publicKey.export({ type: "spki", format: "pem" }));
const message = Buffer.from("AWC dependency security regression");
const digest = createHash("sha256").update(message).digest();
const wrongDigest = createHash("sha256").update("a different message").digest();
const { asn1 } = forge;
const invalidDigestInfo = /does not contain a valid RSASSA-PKCS1-v1_5 DigestInfo/;

function signature({ parameters = "", omitParameters = false, extraElements = [], ber = false } = {}) {
  const algorithm = [
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer("2.16.840.1.101.3.4.2.1").getBytes()),
  ];
  if (!omitParameters) {
    algorithm.push(asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, parameters));
  }
  algorithm.push(...extraElements);
  const info = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, algorithm),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, digest.toString("binary")),
  ]);
  let encoded = Buffer.from(asn1.toDer(info).getBytes(), "binary");
  if (ber) {
    assert.ok(encoded[1] < 128);
    encoded = Buffer.concat([Buffer.from([0x30, 0x80]), encoded.subarray(2), Buffer.from([0, 0])]);
  }
  const paddingLength = 256 - encoded.length - 3;
  assert.ok(paddingLength >= 8);
  const padded = Buffer.concat([Buffer.from([0, 1]), Buffer.alloc(paddingLength, 0xff), Buffer.from([0]), encoded]);
  return privateEncrypt({ key: keys.privateKey, padding: constants.RSA_NO_PADDING }, padded).toString("binary");
}

test("PKCS#1 v1.5 rejects extra nested DigestAlgorithm elements", () => {
  for (const omitParameters of [false, true]) {
    const malformed = signature({
      omitParameters,
      extraElements: [asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, "unchecked bytes")],
    });
    assert.throws(() => publicKey.verify(digest.toString("binary"), malformed), invalidDigestInfo);
  }
});

test("PKCS#1 v1.5 rejects duplicate NULL parameters", () => {
  const malformed = signature({
    extraElements: [asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, "")],
  });
  assert.throws(() => publicKey.verify(digest.toString("binary"), malformed), invalidDigestInfo);
});

test("PKCS#1 v1.5 rejects nonempty NULL parameters", () => {
  for (const length of [1, 8, 32]) {
    const malformed = signature({ parameters: "x".repeat(length) });
    assert.throws(() => publicKey.verify(digest.toString("binary"), malformed), invalidDigestInfo);
  }
});

test("PKCS#1 v1.5 accepts valid SHA-256 parameters and rejects a wrong digest", () => {
  for (const omitParameters of [false, true]) {
    const valid = signature({ omitParameters });
    assert.equal(publicKey.verify(digest.toString("binary"), valid), true);
    assert.equal(publicKey.verify(wrongDigest.toString("binary"), valid), false);
  }
});

test("PKCS#1 v1.5 preserves legacy BER DigestInfo verification", () => {
  assert.equal(publicKey.verify(digest.toString("binary"), signature({ ber: true })), true);
});

test("PKCS#1 v1.5 accepts native OpenSSL signatures", () => {
  const valid = sign("sha256", message, keys.privateKey).toString("binary");
  assert.equal(publicKey.verify(digest.toString("binary"), valid), true);
  assert.equal(publicKey.verify(wrongDigest.toString("binary"), valid), false);
});

test("RSA-PSS verification remains compatible with native signatures", () => {
  const valid = sign("sha256", message, {
    key: keys.privateKey,
    padding: constants.RSA_PKCS1_PSS_PADDING,
    saltLength: 32,
  }).toString("binary");
  const pss = forge.pss.create({
    md: forge.md.sha256.create(),
    mgf: forge.mgf.mgf1.create(forge.md.sha256.create()),
    saltLength: 32,
  });
  assert.equal(publicKey.verify(digest.toString("binary"), valid, pss), true);
});
