import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const source = await readFile(new URL("../apps/web/src/api/auth.js", import.meta.url), "utf8");
const api = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const challenge = {
  challengeId: "b6e0d868-3360-485a-8c3f-125453222e7b",
  expiresAt: "2030-01-01T00:05:00Z",
  resendAt: "2030-01-01T00:01:00Z",
};
let calls;
function replies(result, status = 200) {
  calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/csrf")) return Response.json({ headerName: "X-CSRF-TOKEN", token: "csrf" });
    return status === 204 ? new Response(null, { status }) : Response.json(result, { status });
  };
}

test("password login returns challenge without turning it into a session", async () => {
  replies(challenge);
  assert.deepEqual(await api.loginAccount({ email: "user@example.com", password: "secret" }), challenge);
  assert.equal(calls[1].url, "/api/auth/login");
  assert.equal(calls[1].options.headers["X-CSRF-TOKEN"], "csrf");
  assert.equal(calls[1].options.credentials, "same-origin");
  assert.equal(calls[1].options.headers.Authorization, undefined);
});

test("only the verify request converts tokens into a frontend session", async () => {
  replies({ accessToken: "verified-token", user: { id: "user-1" }, expiresIn: 900 });
  const session = await api.verifyLoginCode(challenge.challengeId, "123456");
  assert.equal(session.accessToken, "verified-token");
  assert.ok(session.expiresAt > Date.now());
  assert.equal(calls[1].url, "/api/auth/login/verify");
  assert.deepEqual(JSON.parse(calls[1].options.body), { challengeId: challenge.challengeId, code: "123456" });
});

test("verification rejects challenge-only responses", async () => {
  replies(challenge);
  await assert.rejects(api.verifyLoginCode(challenge.challengeId, "123456"), /unexpected login response/);
});

test("password reset passes OTP and new password with CSRF protection", async () => {
  replies(null, 204);
  assert.equal(await api.resetForgottenPassword(challenge.challengeId, "123456", "new-password"), null);
  assert.equal(calls[1].url, "/api/auth/password/reset");
  assert.equal(calls[1].options.headers["X-CSRF-TOKEN"], "csrf");
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    challengeId: challenge.challengeId, code: "123456", newPassword: "new-password",
  });
});

test("rate-limit errors expose status for translated UI messaging", async () => {
  replies({}, 429);
  await assert.rejects(api.resendLoginCode(challenge.challengeId), error => error.status === 429);
});

test("normal session refresh still works without asking for OTP again", async () => {
  replies({ accessToken: "refreshed", user: { id: "user-1" }, expiresIn: 900 });
  const session = await api.refreshSession();
  assert.equal(session.accessToken, "refreshed");
  assert.equal(calls[1].url, "/api/auth/refresh");
});


test("customer password login converts a direct response into a session", async () => {
  replies({ accessToken: "customer-token", user: { id: "customer-1", role: "CUSTOMER" }, expiresIn: 900 });
  const session = await api.loginAccount({ email: "customer@example.com", password: "secret" });
  assert.equal(session.accessToken, "customer-token");
  assert.ok(session.expiresAt > Date.now());
  assert.equal(calls[1].url, "/api/auth/login");
});
