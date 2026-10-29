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
  const filename = path.resolve(
    root,
    relative.endsWith(".ts") ? relative : `${relative}.ts`,
  );
  if (cache.has(filename)) return cache.get(filename);
  const result = {};
  cache.set(filename, result);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const resolve = (name) =>
    name.startsWith("@/")
      ? load(name.slice(2))
      : name.startsWith(".")
        ? load(path.relative(root, path.resolve(path.dirname(filename), name)))
        : moduleRequire(name);
  new Function("require", "exports", output)(resolve, result);
  return result;
}
const { NextRequest } = moduleRequire("next/server");
const api = load("app/api/prospects/[[...path]]/route");
const { mapProspect } = load("lib/conversations");
const prospect = {
  id: "pr_test",
  rooftopId: "cranbourne_kia",
  dealerSocketOpportunityId: "DS-TEST",
  customer: { firstName: "Actual", lastName: "Customer", mobile: "0491570006" },
  normalizedMobile: "+61491570006",
  vehicle: { make: "Kia", model: "Sportage", year: 2026 },
  leadSource: "website",
  status: "waiting_on_us",
  journey: { status: "paused", currentStep: 1, currentStepName: "Ack" },
  unreadInboundCount: 2,
  lastActivityAt: "2026-10-14T00:00:00Z",
  createdAt: "2026-10-14T00:00:00Z",
  lastMessageDirection: "inbound",
  lastMessagePreview: "Actual customer reply",
};
function request(method, suffix = "", body, cookie = true) {
  return new NextRequest(`http://localhost:3001/api/prospects${suffix}`, {
    method,
    headers: {
      Origin: "http://localhost:3001",
      ...(cookie ? { Cookie: "booran_session=test-token" } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
const context = (path = []) => ({ params: Promise.resolve({ path }) });

test("all eight endpoints forward method, DTO and bearer token to configured backend", async (t) => {
  for (const [method, segments, body] of [
    ["GET", []],
    ["GET", ["pr_test"]],
    ["GET", ["pr_test", "thread"]],
    [
      "POST",
      ["pr_test", "messages"],
      { content: "Hello", authorName: "Staff" },
    ],
    [
      "POST",
      ["pr_test", "notes"],
      { content: "Team note", authorName: "Staff" },
    ],
    ["PATCH", ["pr_test", "journey"], { action: "pause", reason: "Takeover" }],
    [
      "PATCH",
      ["pr_test", "outcome"],
      { outcome: "appointment_requested", notes: "Saturday" },
    ],
    [
      "PATCH",
      ["pr_test", "assign"],
      { salespersonName: "Staff", salespersonEmail: "staff@example.test" },
    ],
  ]) {
    t.mock.restoreAll();
    t.mock.method(globalThis, "fetch", async (url, init) => {
      assert.equal(
        String(url),
        `https://www.cranbourne-backend.omnisuiteai.com/api/prospects${segments.length ? `/${segments.join("/")}` : ""}`,
      );
      assert.equal(init.method, method);
      assert.equal(init.headers.Authorization, "Bearer test-token");
      assert.equal(init.cache, "no-store");
      if (body) assert.deepEqual(JSON.parse(init.body), body);
      return Response.json(segments.length === 0 ? [prospect] : prospect, {
        status: method === "POST" ? 201 : 200,
      });
    });
    const response = await api[method](
      request(method, segments.length ? `/${segments.join("/")}` : "", body),
      context(segments),
    );
    assert.equal(response.status, method === "POST" ? 201 : 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});
test("valid inbox filters are forwarded; unrelated query parameters are excluded", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url.searchParams.get("search"), "a+b [literal]");
    assert.equal(url.searchParams.get("ownerName"), "Staff");
    assert.equal(url.searchParams.get("status"), "waiting_on_us");
    assert.equal(url.searchParams.has("token"), false);
    return Response.json([]);
  });
  const response = await api.GET(
    request(
      "GET",
      "?search=a%2Bb+%5Bliteral%5D&ownerName=Staff&status=waiting_on_us&token=ignored",
    ),
    context(),
  );
  assert.equal(response.status, 200);
});
test("400, 401, 403, 404 and 500 remain identifiable to frontend", async (t) => {
  for (const status of [400, 401, 403, 404, 500]) {
    t.mock.restoreAll();
    t.mock.method(globalThis, "fetch", async () =>
      Response.json({ message: ["Rejected input"] }, { status }),
    );
    const response = await api.GET(request("GET"), context());
    assert.equal(response.status, status);
    if (status === 401)
      assert.match(response.headers.get("set-cookie"), /Max-Age=0/i);
    if (status === 500)
      assert.equal(
        (await response.json()).message.includes("Rejected input"),
        false,
      );
  }
});
test("missing auth, invalid routes, invalid JSON and cross-origin mutation fail safely", async () => {
  assert.equal(
    (await api.GET(request("GET", "", undefined, false), context())).status,
    401,
  );
  assert.equal(
    (await api.GET(request("GET"), context(["../bad"]))).status,
    404,
  );
  assert.equal(
    (
      await api.PATCH(
        request("PATCH", "/pr_test/unsupported", {}),
        context(["pr_test", "unsupported"]),
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await api.POST(
        request("POST", "/pr_test/messages", []),
        context(["pr_test", "messages"]),
      )
    ).status,
    400,
  );
  const foreign = new NextRequest(
    "http://localhost:3001/api/prospects/pr_test/messages",
    { method: "POST", headers: { Origin: "https://unrelated.test" } },
  );
  assert.equal(
    (await api.POST(foreign, context(["pr_test", "messages"]))).status,
    403,
  );
});
test("network failures return 503 without pretending the action succeeded", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("offline");
  });
  assert.equal((await api.GET(request("GET"), context())).status, 503);
});
test("real prospect fields map correctly into existing UI columns", () => {
  const mapped = mapProspect(prospect);
  assert.equal(mapped.name, "Actual Customer");
  assert.equal(mapped.rooftop, "Cranbourne Kia");
  assert.equal(mapped.vehicle, "2026 Kia Sportage");
  assert.equal(mapped.status, "Waiting on us");
  assert.equal(mapped.unread, 2);
  assert.equal(mapped.lastDirection, "Inbound");
  assert.equal(mapped.preview, "Actual customer reply");
  assert.equal(mapped.crmId, "DS-TEST");
});
