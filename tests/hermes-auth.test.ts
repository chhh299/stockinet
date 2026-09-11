import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { authenticateHermesRequest } from "../lib/hermes/auth";

test("authenticateHermesRequest passes when HERMES_API_KEY is not configured", () => {
  const originalKey = process.env.HERMES_API_KEY;
  delete process.env.HERMES_API_KEY;

  const req = new NextRequest("http://localhost/api/v1/hermes/news");
  const auth = authenticateHermesRequest(req);

  assert.equal(auth.authenticated, true);
  assert.equal(auth.errorResponse, undefined);

  if (originalKey) process.env.HERMES_API_KEY = originalKey;
});

test("authenticateHermesRequest rejects when HERMES_API_KEY is set but Authorization header is missing", () => {
  process.env.HERMES_API_KEY = "test-secret-hermes-key";

  const req = new NextRequest("http://localhost/api/v1/hermes/news");
  const auth = authenticateHermesRequest(req);

  assert.equal(auth.authenticated, false);
  assert.ok(auth.errorResponse);
  assert.equal(auth.errorResponse.status, 401);

  delete process.env.HERMES_API_KEY;
});

test("authenticateHermesRequest rejects when Bearer token does not match", () => {
  process.env.HERMES_API_KEY = "test-secret-hermes-key";

  const req = new NextRequest("http://localhost/api/v1/hermes/news", {
    headers: {
      Authorization: "Bearer wrong-token",
    },
  });
  const auth = authenticateHermesRequest(req);

  assert.equal(auth.authenticated, false);
  assert.ok(auth.errorResponse);
  assert.equal(auth.errorResponse.status, 401);

  delete process.env.HERMES_API_KEY;
});

test("authenticateHermesRequest succeeds when Bearer token matches", () => {
  process.env.HERMES_API_KEY = "test-secret-hermes-key";

  const req = new NextRequest("http://localhost/api/v1/hermes/news", {
    headers: {
      Authorization: "Bearer test-secret-hermes-key",
    },
  });
  const auth = authenticateHermesRequest(req);

  assert.equal(auth.authenticated, true);
  assert.equal(auth.errorResponse, undefined);

  delete process.env.HERMES_API_KEY;
});
