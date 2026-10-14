import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const moduleRequire = createRequire(import.meta.url);
const cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative.endsWith(".ts") ? relative : `${relative}.ts`);
  if (cache.has(filename)) return cache.get(filename);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const result = {};
  cache.set(filename, result);
  const resolve = (name) => name.startsWith("@/") ? load(name.slice(2)) : name.startsWith(".") ? load(path.relative(root, path.resolve(path.dirname(filename), name))) : moduleRequire(name);
  new Function("require", "exports", output)(resolve, result);
  return result;
}
const { NextRequest } = moduleRequire("next/server");
const { handleUsers } = load("lib/users-server");
const { sanitizeUser } = load("lib/users");
const actorId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const userId = "bbbbbbbbbbbbbbbbbbbbbbbb";
const user = { id: userId, name: "Test User", email: "user@example.test", role: "salesperson", rooftopIds: ["cranbourne_kia"], isActive: true, createdAt: "2026-10-14T00:00:00Z", updatedAt: "2026-10-14T00:00:00Z" };
function request(method, body, cookie = true) { return new NextRequest("http://localhost:3001/api/users", { method, headers: { Origin: "http://localhost:3001", ...(cookie ? { Cookie: "booran_session=test-token" } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
function upstream(t, result, status = 200, actor = { id: actorId, role: "group_admin", isActive: true }) {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    requests.push({ url: String(url), init });
    if (String(url).endsWith("/auth/me")) return Response.json(actor);
    return Response.json(result, { status });
  });
  return requests;
}

test("list requires session and verified Group Admin role", async (t) => {
  assert.equal((await handleUsers(request("GET", undefined, false), [])).status, 401);
  const calls = upstream(t, [user], 200, { id: actorId, role: "salesperson", isActive: true });
  assert.equal((await handleUsers(request("GET"), [])).status, 403);
  assert.equal(calls.length, 1);
});

test("list and details forward bearer auth and sanitize returned users", async (t) => {
  const calls = upstream(t, [{ ...user, passwordHash: "should-not-leak" }]);
  const response = await handleUsers(request("GET"), []);
  assert.equal(response.status, 200);
  const [listed] = await response.json();
  assert.equal(listed.id, userId);
  assert.equal(listed.passwordHash, undefined);
  assert.equal(calls[1].init.headers.Authorization, "Bearer test-token");
  assert.equal(calls[1].init.cache, "no-store");
  t.mock.restoreAll();
  const detailCalls = upstream(t, user);
  assert.equal((await (await handleUsers(request("GET"), [userId])).json()).id, userId);
  assert.equal(detailCalls[1].url, `http://localhost:3000/api/users/${userId}`);
});

test("create validates fields, maps payload and accepts backend 201", async (t) => {
  const calls = upstream(t, user, 201);
  const body = { name: " Test User ", email: " USER@example.test ", password: "Password123", role: "salesperson", rooftopIds: ["cranbourne_kia", "cranbourne_kia"], passwordHash: "never-forward" };
  const response = await handleUsers(request("POST", body), []);
  assert.equal(response.status, 201);
  assert.deepEqual(JSON.parse(calls[1].init.body), { name: "Test User", email: "user@example.test", password: "Password123", role: "salesperson", rooftopIds: ["cranbourne_kia"] });
  const invalid = await handleUsers(request("POST", { ...body, role: "automation_admin", password: "short" }), []);
  assert.equal(invalid.status, 400);
  const result = await invalid.json();
  assert.ok(result.fields.role);
  assert.ok(result.fields.password);
});

test("role, rooftop and password patches call exactly their supplied endpoints", async (t) => {
  for (const [action, body] of [["role", { role: "sales_manager" }], ["rooftops", { rooftopIds: ["cranbourne_mg", "geely_cranbourne"] }], ["password", { newPassword: "NewPassword123" }]]) {
    t.mock.restoreAll();
    const calls = upstream(t, action === "password" ? { message: "Password updated successfully" } : user);
    const response = await handleUsers(request("PATCH", body), [userId, action]);
    assert.equal(response.status, 200);
    assert.equal(calls[1].url, `http://localhost:3000/api/users/${userId}/${action}`);
    assert.equal(calls[1].init.method, "PATCH");
    assert.deepEqual(JSON.parse(calls[1].init.body), body);
    if (action === "password") assert.deepEqual(await response.json(), { message: "Password updated successfully" });
  }
});

test("deactivation returns an inactive user and prevents self-deactivation", async (t) => {
  upstream(t, { message: "User deactivated", user: { ...user, isActive: false } });
  const response = await handleUsers(request("DELETE"), [userId]);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.isActive, false);
  assert.equal((await handleUsers(request("DELETE"), [actorId])).status, 400);
  assert.equal((await handleUsers(request("PATCH", { role: "salesperson" }), [actorId, "role"])).status, 400);
});

test("duplicate email, missing user and backend validation errors remain actionable", async (t) => {
  upstream(t, { message: "Email already registered" }, 409);
  const duplicate = await handleUsers(request("POST", { name: "Test", email: "user@example.test", password: "Password123", role: "salesperson", rooftopIds: [] }), []);
  assert.equal(duplicate.status, 409);
  t.mock.restoreAll(); upstream(t, { message: "User not found" }, 404);
  assert.equal((await handleUsers(request("GET"), [userId])).status, 404);
  t.mock.restoreAll(); upstream(t, { message: ["Invalid role", "Invalid rooftop"] }, 400);
  const result = await handleUsers(request("PATCH", { role: "salesperson" }), [userId, "role"]);
  assert.equal((await result.json()).message, "Invalid role Invalid rooftop");
});

test("expired session clears cookie and network failures return retryable 503", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 401 }));
  const expired = await handleUsers(request("GET"), []);
  assert.equal(expired.status, 401);
  assert.match(expired.headers.get("set-cookie"), /Max-Age=0/i);
  t.mock.restoreAll();
  t.mock.method(globalThis, "fetch", async () => { throw new Error("offline"); });
  assert.equal((await handleUsers(request("GET"), [])).status, 503);
});

test("invalid IDs, unsupported actions and cross-origin mutations are denied", async () => {
  assert.equal((await handleUsers(request("GET"), ["invalid-id"])).status, 404);
  assert.equal((await handleUsers(request("PATCH", {}), [userId, "unexpected"])).status, 404);
  const foreign = new NextRequest("http://localhost:3001/api/users", { method: "DELETE", headers: { Origin: "https://unrelated.test" } });
  assert.equal((await handleUsers(foreign, [userId])).status, 403);
  assert.equal(sanitizeUser({ ...user, id: undefined, _id: userId, passwordHash: "secret" }).id, userId);
});
