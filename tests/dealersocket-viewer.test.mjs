import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const output = ts.transpileModule(fs.readFileSync(new URL('../app/api/integrations/dealersocket/viewer/route.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

test('viewer requires an active Super Admin and a secure server-configured destination', async () => {
  const previous = process.env.DEALERSOCKET_VIEWER_URL;
  let actor = { role: 'group_admin', isActive: true };
  let backendStatus = 200;
  let calls = 0;
  const exports = {};
  const auth = {
    sessionCookie: 'booran_session',
    authResponse: (body, status) => Response.json(body, { status }),
    backendAuth: async () => { calls++; return Response.json(actor, { status: backendStatus }); },
  };
  new Function('require', 'exports', output)((name) => {
    if (name === '@/lib/auth-server') return auth;
    if (name === 'next/server') return { NextResponse: { redirect: url => new Response(null, { status: 307, headers: { Location: url.toString() } }) } };
    throw new Error(`Unexpected dependency: ${name}`);
  }, exports);
  const request = token => ({ cookies: { get: () => token ? { value: token } : undefined } });
  try {
    assert.equal((await exports.GET(request())).status, 401);
    assert.equal(calls, 0);
    backendStatus = 401;
    assert.equal((await exports.GET(request('token'))).status, 401);
    backendStatus = 200;
    for (const rejected of [{ role: 'staff', isActive: true }, { role: 'group_admin', isActive: false }]) {
      actor = rejected;
      assert.equal((await exports.GET(request('token'))).status, 403);
    }
    actor = { role: 'group_admin', isActive: true };
    delete process.env.DEALERSOCKET_VIEWER_URL;
    assert.equal((await exports.GET(request('token'))).status, 503);
    for (const invalid of ['http://viewer.example', 'https://user:password@viewer.example', 'invalid']) {
      process.env.DEALERSOCKET_VIEWER_URL = invalid;
      assert.equal((await exports.GET(request('token'))).status, 503);
    }
    process.env.DEALERSOCKET_VIEWER_URL = 'https://viewer.example/browser/vnc.html?path=browser/websockify';
    const result = await exports.GET(request('token'));
    assert.equal(result.status, 307);
    assert.equal(result.headers.get('location'), process.env.DEALERSOCKET_VIEWER_URL);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.equal(result.headers.get('referrer-policy'), 'no-referrer');
  } finally {
    if (previous === undefined) delete process.env.DEALERSOCKET_VIEWER_URL;
    else process.env.DEALERSOCKET_VIEWER_URL = previous;
  }
});
