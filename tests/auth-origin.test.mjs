import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const output = ts.transpileModule(fs.readFileSync(new URL('../lib/auth-server.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
new Function('require', 'exports', output)(require, exports);
const { sameOrigin } = exports;
function request(origin, host, site = 'same-origin') {
  return { nextUrl: new URL('http://localhost:3001/api/auth/login'),
    headers: new Headers({ Origin: origin, Host: host, 'Sec-Fetch-Site': site }) };
}

test('accepts requested local and LAN hosts despite an internal localhost URL', () => {
  assert.equal(sameOrigin(request('http://127.0.0.1:3001', '127.0.0.1:3001')), true);
  assert.equal(sameOrigin(request('http://192.168.1.20:3001', '192.168.1.20:3001')), true);
  assert.equal(sameOrigin(request('http://localhost:3001', 'localhost:3001')), true);
});
test('rejects other origins, schemes, ports, null origins and cross-site requests', () => {
  for (const origin of ['https://evil.test', 'http://localhost:3000', 'https://localhost:3001', 'null', 'http://localhost:3001/path']) {
    assert.equal(sameOrigin(request(origin, 'localhost:3001')), false, origin);
  }
  assert.equal(sameOrigin(request('http://localhost:3001', 'localhost:3001', 'cross-site')), false);
  assert.equal(sameOrigin(request('http://localhost:3001', 'portal.example.com')), false);
});
test('HTTPS proxy deployments require the configured public origin, ignoring forwarded host claims', () => {
  const previous = process.env.PORTAL_ORIGIN;
  process.env.PORTAL_ORIGIN = 'https://portal.example.com';
  try {
    assert.equal(sameOrigin(request('https://portal.example.com', 'localhost:3001')), true);
    const malicious = request('https://evil.test', 'localhost:3001');
    malicious.headers.set('x-forwarded-host', 'evil.test');
    assert.equal(sameOrigin(malicious), false);
    assert.equal(sameOrigin(request('http://localhost:3001', 'localhost:3001')), false);
  } finally {
    if (previous === undefined) delete process.env.PORTAL_ORIGIN;
    else process.env.PORTAL_ORIGIN = previous;
  }
});
