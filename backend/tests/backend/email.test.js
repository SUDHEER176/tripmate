import test from "node:test";
import assert from "node:assert/strict";
import { parseSender, sendOtpEmail } from "../../functions/_shared/email.js";

test("parseSender reads 'Name <address>' and bare addresses", () => {
  assert.deepEqual(parseSender("TripMate <hi@example.com>"), { name: "TripMate", email: "hi@example.com" });
  assert.deepEqual(parseSender("hi@example.com"), { name: "TripMate", email: "hi@example.com" });
  assert.deepEqual(parseSender(undefined), { name: "TripMate", email: "" });
});

test("sendOtpEmail posts to Brevo with the api-key header", async () => {
  const saved = { key: process.env.BREVO_API_KEY, from: process.env.EMAIL_FROM, fetch: globalThis.fetch };
  let call;
  globalThis.fetch = async (url, init) => { call = { url, init }; return new Response("{}", { status: 201 }); };
  process.env.BREVO_API_KEY = "test-key";
  process.env.EMAIL_FROM = "TripMate <sender@example.com>";
  try {
    await sendOtpEmail("user@example.com", "123456", "sign-in");
  } finally {
    globalThis.fetch = saved.fetch;
    for (const [k, v] of [["BREVO_API_KEY", saved.key], ["EMAIL_FROM", saved.from]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
  assert.equal(call.url, "https://api.brevo.com/v3/smtp/email");
  assert.equal(call.init.headers["api-key"], "test-key");
  const body = JSON.parse(call.init.body);
  assert.deepEqual(body.sender, { name: "TripMate", email: "sender@example.com" });
  assert.deepEqual(body.to, [{ email: "user@example.com" }]);
  assert.match(body.textContent, /123456/);
});
