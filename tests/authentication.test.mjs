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
const { mapAuthProfile } = load("lib/auth-profile");
const { canAccessPage, canViewProspect, hasPermission } = load("lib/permissions");
const login = load("app/api/auth/login/route");
const me = load("app/api/auth/me/route");
const logout = load("app/api/auth/logout/route");
const profile = { id: "test-user", name: "Real User", email: "user@example.test", role: "group_admin", rooftopIds: ["cranbourne_mg"], isActive: true };
function request(route, body, cookie) { return new NextRequest(`http://localhost:3001/api/auth/${route}`, { method: body ? "POST" : "GET", headers: { ...(body ? { "Content-Type": "application/json", Origin: "http://localhost:3001" } : {}), ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); }

test("profile maps backend role and uses real identity and assigned rooftops", () => {
  const user = mapAuthProfile(profile);
  assert.equal(user.role, "Super Admin");
  assert.equal(user.name, "Real User");
  assert.deepEqual(user.rooftops, ["Cranbourne MG"]);
  assert.equal(canViewProspect(user.role, { owner: "Any", rooftop: "Cranbourne Kia" }, user), false);
  assert.equal(canViewProspect(user.role, { owner: "Any", rooftop: "Cranbourne MG" }, user), true);
});

test("read-only and BDC accounts cannot inherit manager mutation or reporting privileges", () => {
  const readOnly = mapAuthProfile({ ...profile, role: "read_only" });
  assert.equal(hasPermission(readOnly.role, "sendSms", readOnly), false);
  assert.equal(hasPermission(readOnly.role, "reassign", readOnly), false);
  assert.equal(canAccessPage(readOnly.role, "reports", readOnly), false);
  const bdc = mapAuthProfile({ ...profile, role: "bdc" });
  assert.equal(hasPermission(bdc.role, "sendSms", bdc), true);
  assert.equal(canAccessPage(bdc.role, "reports", bdc), false);
});

test("inactive and unknown role profiles are rejected", () => {
  assert.throws(() => mapAuthProfile({ ...profile, isActive: false }));
  assert.throws(() => mapAuthProfile({ ...profile, role: "unrecognised" }));
  assert.deepEqual(mapAuthProfile({ ...profile, rooftopIds: ["__proto__"] }).rooftops, []);
});

test("login accepts backend 201, forwards credentials and protects bearer token in cookie", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(String(url), "http://localhost:3000/api/auth/login");
    assert.deepEqual(JSON.parse(init.body), { email: "user@example.test", password: "TestPassword1" });
    return Response.json({ accessToken: "test-token", tokenType: "Bearer", expiresIn: "8h", user: profile }, { status: 201 });
  });
  const response = await login.POST(request("login", { email: " USER@example.test ", password: "TestPassword1" }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.user.name, "Real User");
  assert.equal(body.accessToken, undefined);
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, /booran_session=test-token/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=lax/i);
  assert.match(cookie, /Max-Age=28800/i);
});

test("invalid credentials clear an existing session", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ message: "Invalid credentials" }, { status: 401 }));
  const response = await login.POST(request("login", { email: "user@example.test", password: "invalid" }));
  assert.equal(response.status, 401);
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/i);
});

test("profile forwards cookie token as a Bearer header and avoids caching", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(String(url), "http://localhost:3000/api/auth/me");
    assert.equal(init.headers.Authorization, "Bearer test-token");
    assert.equal(init.cache, "no-store");
    return Response.json(profile);
  });
  const response = await me.GET(request("me", undefined, "booran_session=test-token"));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.role, "Super Admin");
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("missing and expired sessions return 401; expired cookie is cleared", async (t) => {
  assert.equal((await me.GET(request("me"))).status, 401);
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 401 }));
  const response = await me.GET(request("me", undefined, "booran_session=expired"));
  assert.equal(response.status, 401);
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/i);
});

test("network failure produces a retryable 503", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("connection refused"); });
  assert.equal((await me.GET(request("me", undefined, "booran_session=test-token"))).status, 503);
});

test("logout clears cookie and rejects cross-origin requests", async () => {
  const response = await logout.POST(request("logout", {}));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/i);
  const foreign = new NextRequest("http://localhost:3001/api/auth/logout", { method: "POST", headers: { Origin: "https://unrelated.test" } });
  assert.equal((await logout.POST(foreign)).status, 403);
});

test("live backend login and profile through the Next authentication handlers", { skip: !process.env.AUTH_TEST_EMAIL || !process.env.AUTH_TEST_PASSWORD }, async () => {
  const signedIn = await login.POST(request("login", { email: process.env.AUTH_TEST_EMAIL, password: process.env.AUTH_TEST_PASSWORD }));
  assert.equal(signedIn.status, 200, "Live login should succeed");
  const token = signedIn.cookies.get("booran_session")?.value;
  assert.ok(token, "Login should set the session cookie");
  const result = await me.GET(request("me", undefined, `booran_session=${token}`));
  assert.equal(result.status, 200, "Authenticated profile should load");
  const data = await result.json();
  assert.equal(data.user.email, process.env.AUTH_TEST_EMAIL);
  assert.equal(data.user.isActive, true);
  assert.equal(data.accessToken, undefined);
});
