import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
const root = fileURLToPath(new URL('../', import.meta.url));
const moduleRequire = createRequire(import.meta.url);
const cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative.endsWith('.ts') ? relative : `${relative}.ts`);
  if (cache.has(filename)) return cache.get(filename);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const result = {}; cache.set(filename, result);
  const resolve = name => name.startsWith('.') ? load(path.relative(root, path.resolve(path.dirname(filename), name))) : moduleRequire(name);
  new Function('require', 'exports', output)(resolve, result);
  return result;
}
const { NextRequest } = moduleRequire('next/server');
const { handleDealerSocket } = load('lib/dealersocket-server');
const { sanitizeDealerSocket } = load('lib/dealersocket');
const { sanitizeLiveSnapshot } = load('lib/live-dealersocket');
const snapshot = {
  state: 'connected', operation: null, lastCheckedAt: '2026-10-15T09:00:00Z',
  lastConnectedAt: '2026-10-15T09:00:00Z', sessionExpiresAt: null, errorCode: null,
  message: 'Session verified.', interactiveLoginEnabled: true,
  rooftops: [{ id: 'cranbourne_kia', name: 'Cranbourne Kia', verified: true },
    { id: 'cranbourne_mg', name: 'Cranbourne MG', verified: false },
    { id: 'geely_cranbourne', name: 'Geely Cranbourne', verified: false }],
};
function request(method = 'GET', cookie = true, origin = 'http://localhost:3001') {
  return new NextRequest('http://localhost:3001/api/integrations/dealersocket/status', {
    method, headers: { ...(cookie ? { Cookie: 'booran_session=portal-test' } : {}), ...(origin ? { Origin: origin } : {}) },
  });
}
function upstream(t, role = 'group_admin', result = snapshot, status = 200) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/auth/me')) return Response.json({ role, isActive: true });
    return Response.json(result, { status });
  });
  return calls;
}
test('DealerSocket proxy denies missing sessions and non-admins', async t => {
  assert.equal((await handleDealerSocket(request('GET', false), ['status'])).status, 401);
  const calls = upstream(t, 'salesperson');
  assert.equal((await handleDealerSocket(request(), ['status'])).status, 403);
  assert.equal(calls.length, 1);
});
test('DealerSocket browser actions require same Origin and supported paths', async () => {
  assert.equal((await handleDealerSocket(request('POST', true, 'https://other.test'), ['login', 'start'])).status, 403);
  assert.equal((await handleDealerSocket(request('POST', true, ''), ['check'])).status, 403);
  assert.equal((await handleDealerSocket(request(), ['../../secrets'])).status, 404);
});
test('DealerSocket status/check/login forward only portal authentication and whitelist response', async t => {
  const calls = upstream(t, 'group_admin', { ...snapshot, cookies: ['private'], token: 'secret' });
  for (const [method, segments] of [['GET', ['status']], ['POST', ['check']], ['POST', ['login', 'start']], ['POST', ['login','automatic','start']]]) {
    const response = await handleDealerSocket(request(method), segments);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), snapshot);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(calls.length, 8);
  assert.equal(calls[7].url, 'https://www.cranbourne-backend.omnisuiteai.com/api/integrations/dealersocket/login/automatic/start');
  assert.equal(calls[5].init.headers.Authorization, 'Bearer portal-test');
  assert.equal(calls[5].init.headers['X-Connector-Key'], undefined);
});
test('DealerSocket proxy rejects malformed connector data', async t => {
  upstream(t, 'group_admin', { ...snapshot, rooftops: [] });
  assert.equal((await handleDealerSocket(request(), ['status'])).status, 502);
  assert.throws(() => sanitizeDealerSocket({ ...snapshot, lastConnectedAt: 'bad-date' }));
});

test('DealerSocket proxy preserves read activity and original check timestamps', async t => {
  const reading={...snapshot,state:'connecting',operation:'read',message:'Lead read in progress. Session checks resume when it finishes.'};
  upstream(t,'group_admin',reading);
  const response=await handleDealerSocket(request(),['status']);
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),reading);
});
test('DealerSocket upstream secrets are not echoed on service failures', async t => {
  upstream(t, 'group_admin', { message: 'secret-token-value' }, 503);
  const response = await handleDealerSocket(request(), ['status']);
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes('secret-token-value'));
});
test('DealerSocket expired sessions clear the cookie', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 401 }));
  const response = await handleDealerSocket(request(), ['status']);
  assert.equal(response.status, 401);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
});

const liveSnapshot={state:'partial',jobId:'job-one',startedAt:null,fetchedAt:'2026-10-15T09:00:00Z',completedAt:null,
  snapshotState:'partial',schedule:{enabled:true,intervalSeconds:3600,nextRunAt:'2026-10-15T10:00:00Z'},
  durationSeconds:42,progress:null,errorCode:null,readOnly:true,limited:false,issues:['Selected queues only'],coverageNote:'Fresh queue snapshot',
  rooftops:[{id:'cranbourne_kia',name:'Cranbourne Kia',recordCount:1,matchedCandidateCount:61}],
  records:[{id:'site|sales|1|c',opportunityId:'1',customerId:'c',rooftopId:'cranbourne_kia',rooftop:'Cranbourne Kia',
    customerName:'Fixture Customer',mobile:'+61412345678',email:'fixture@example.test',vehicle:'Kia Fixture',source:'Website',owner:'Fixture Staff',
    status:'Open',sourceTimestamp:'',sourceTimestampBasis:'unavailable',observedAt:'2026-10-15T09:00:00Z',detailsObservedAt:null,
    detailsVerified:true,missingFields:'',warnings:''}]};
test('live snapshots allow authenticated scoped viewers and strip unexpected fields',async t=>{
  upstream(t,'salesperson',{...liveSnapshot,token:'private',records:[{...liveSnapshot.records[0],cookies:['private']}]});
  const result=await handleDealerSocket(request(),['leads','status']);
  assert.equal(result.status,200);
  assert.deepEqual(await result.json(),liveSnapshot);
});
test('live refresh requires admin and same origin; forwards no customer write payload',async t=>{
  upstream(t,'salesperson',liveSnapshot);
  assert.equal((await handleDealerSocket(request('POST'),['leads','read'])).status,403);
  assert.equal((await handleDealerSocket(request('POST',true,'https://other.test'),['leads','read'])).status,403);
});
test('admin can request live snapshot refresh with portal authentication only',async t=>{
  const calls=upstream(t,'group_admin',liveSnapshot,202);
  const result=await handleDealerSocket(request('POST'),['leads','read']);
  assert.equal(result.status,202);
  assert.equal(calls[1].init.body,undefined);
  assert.equal(calls[1].init.headers['X-Connector-Key'],undefined);
  assert.equal(calls[1].url,'https://www.cranbourne-backend.omnisuiteai.com/api/integrations/dealersocket/leads/read');
});
test('malformed live responses are rejected and no-store is retained',async t=>{
  assert.throws(()=>sanitizeLiveSnapshot({...liveSnapshot,readOnly:false}));
  assert.throws(()=>sanitizeLiveSnapshot({...liveSnapshot,records:[{...liveSnapshot.records[0],rooftopId:'foreign'}]}));
  upstream(t,'group_admin',{...liveSnapshot,records:'bad'});
  const result=await handleDealerSocket(request(),['leads','status']);
  assert.equal(result.status,502);
  assert.equal(result.headers.get('cache-control'),'no-store');
});

test('scheduled refresh retains dated previous rows through running and failed states',()=>{
  for(const state of ['running','error']) {
    const result=sanitizeLiveSnapshot({...liveSnapshot,state,errorCode:state==='error'?'login_required':null,
      schedule:{...liveSnapshot.schedule,token:'private'}});
    assert.equal(result.snapshotState,'partial');
    assert.equal(result.records.length,1);
    assert.equal(result.fetchedAt,liveSnapshot.fetchedAt);
    assert.deepEqual(result.schedule,liveSnapshot.schedule);
  }
  assert.throws(()=>sanitizeLiveSnapshot({...liveSnapshot,schedule:{enabled:true,intervalSeconds:0,nextRunAt:null}}));
});
