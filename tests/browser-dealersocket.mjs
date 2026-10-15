// Production UI smoke test with synthetic API data; no CRM/database/SMS access.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const socket = createServer();
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const base = `http://localhost:${port}`;
const server = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port)],
  { cwd: root, windowsHide: true, stdio: 'ignore' });
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, 'Production frontend starts');
  browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let state = 'disconnected';
  let leadState = 'partial';
  let serverScheduled = false;
  let viewer = 'group_admin';
  const actions = [];
  const roofs = [['cranbourne_kia', 'Cranbourne Kia'], ['cranbourne_mg', 'Cranbourne MG'], ['geely_cranbourne', 'Geely Cranbourne']];
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    let body;
    if (url.pathname === '/api/auth/me') body = { user: {
      id: 'fixture-admin', email: 'admin@example.test', name: 'Fixture Admin', role: viewer==='group_admin'?'Super Admin':'Dealership Manager', apiRole: viewer,
      rooftopIds: roofs.map(r => r[0]), rooftops: roofs.map(r => r[1]), isActive: true,
      permissions: viewer==='group_admin'?['overview', 'settings','conversations']:['overview','conversations'], ownProspectsOnly: false,
    } };
    else if (url.pathname.startsWith('/api/integrations/dealersocket/')) {
      const action = url.pathname.split('/dealersocket/')[1];
      if(action.startsWith('leads/')) {
        if(action==='leads/read') { actions.push(action);leadState='running'; }
        else if(leadState==='running' && !serverScheduled) leadState='partial';
        const records=(leadState==='partial' || serverScheduled)?[{id:'fixture|sales|1|customer',opportunityId:'DS-FIXTURE-1',customerId:'customer',
          rooftopId:'cranbourne_kia',rooftop:'Cranbourne Kia',customerName:'Synthetic Live Lead',mobile:'+61412345678',email:'fixture@example.test',
          vehicle:'Kia Fixture',source:'Website',owner:'Fixture Staff',status:'Open',sourceTimestamp:'2026-10-15T09:00:00+11:00',
          sourceTimestampBasis:'opportunity.createdDate',observedAt:new Date().toISOString(),detailsObservedAt:new Date().toISOString(),
          detailsVerified:true,missingFields:'',warnings:'source_time_unverified'}]:[];
        body={state:leadState,jobId:leadState==='idle'?null:'fixture-job',startedAt:null,fetchedAt:leadState==='partial'?new Date().toISOString():null,
          completedAt:null,durationSeconds:leadState==='partial'?42:null,progress:leadState==='running'?'reading_queue':null,errorCode:null,readOnly:true,
          limited:false,records,rooftops:roofs.map(([id,name])=>({id,name,recordCount:id==='cranbourne_kia'?records.length:0,matchedCandidateCount:id==='cranbourne_kia'?61:0})),
          issues:[],coverageNote:'Fresh selected-queue snapshot. Full rooftop coverage is unverified.'};
        if(serverScheduled) Object.assign(body,{snapshotState:'partial',fetchedAt:'2026-10-15T09:00:00Z',
          schedule:{enabled:true,intervalSeconds:3600,nextRunAt:'2026-10-15T10:00:00Z'},errorCode:leadState==='error'?'login_required':null});
        await route.fulfill({status:action==='leads/read'?202:200,contentType:'application/json',body:JSON.stringify(body)});
        return;
      }
      if (route.request().method() === 'POST') {
        actions.push(action);
        state = action === 'login/start' ? 'connected' : 'login_required';
      }
      body = { state, operation: null, lastCheckedAt: '2026-10-15T09:00:00Z',
        lastConnectedAt: state === 'connected' ? '2026-10-15T09:00:00Z' : null,
        errorCode: null, message: state === 'connected' ? 'DealerSocket session verified.' : 'Complete login on the automation PC.',
        interactiveLoginEnabled: true, sessionExpiresAt: null,
        rooftops: roofs.map(([id, name]) => ({ id, name, verified: state === 'connected' })),
      };
    } else body = [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(base);
  await page.getByRole('button', { name: 'Dealership settings', exact: true }).click();
  await page.getByRole('button', { name: 'DealerSocket', exact: true }).click();
  await page.getByRole('button', { name: 'Check connection', exact: true }).click();
  await page.getByText('Login required', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Open login on automation PC', exact: true }).click();
  await page.getByText('Connected', { exact: true }).waitFor();
  assert.deepEqual(actions, ['check', 'login/start']);
  assert.equal(await page.getByText(/Explicit dealership label observed/).count(), 3);
  mkdirSync(path.join(root, 'test-results'), { recursive: true });
  await page.screenshot({ path: path.join(root, 'test-results/dealersocket-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().right <= 1);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No mobile horizontal overflow');
  await page.screenshot({ path: path.join(root, 'test-results/dealersocket-mobile.png'), fullPage: true });
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'Prospect list',exact:true}).click();
  await page.getByRole('heading',{name:'Live dealership leads',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Fetch latest leads',exact:true}).count(),0);
  await page.getByText('Synthetic Live Lead',{exact:true}).waitFor();
  assert.equal(actions.filter(action=>action==='leads/read').length,0);
  await page.getByLabel('Search leads',{exact:true}).fill('does-not-exist');
  await page.getByText('No records match the permitted scope and selected filters.',{exact:true}).waitFor();
  await page.getByLabel('Search leads',{exact:true}).fill('');
  await page.getByRole('combobox',{name:'Rooftop',exact:true}).selectOption('geely_cranbourne');
  await page.getByText('No records match the permitted scope and selected filters.',{exact:true}).waitFor();
  await page.getByRole('combobox',{name:'Rooftop',exact:true}).selectOption('all');
  await page.screenshot({path:path.join(root,'test-results/live-leads-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().right<=1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No mobile live-lead overflow');
  await page.screenshot({path:path.join(root,'test-results/live-leads-mobile.png'),fullPage:true});
  serverScheduled=true;
  leadState='running';
  await page.setViewportSize({width:1440,height:1000});
  await page.reload();
  await page.getByRole('button',{name:'Prospect list',exact:true}).click();
  await page.getByText(/Server sync: every 60 minutes/).waitFor();
  await page.getByText(/Showing the previous snapshot/).waitFor();
  await page.getByText('Synthetic Live Lead',{exact:true}).waitFor();
  assert.equal(await page.getByRole('checkbox',{name:/Automatically refresh/}).count(),0);
  leadState='error';
  await page.getByText('DealerSocket login is required on the automation PC.',{exact:true}).waitFor();
  await page.getByText('Synthetic Live Lead',{exact:true}).waitFor();
  leadState='partial';
  viewer='read_only';
  await page.setViewportSize({width:1440,height:1000});
  await page.reload();
  await page.getByRole('button',{name:'Prospect list',exact:true}).click();
  await page.getByText('Synthetic Live Lead',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Fetch latest leads',exact:true}).count(),0);
  assert.equal(await page.getByRole('checkbox',{name:/Automatically refresh/}).count(),0);
  assert.deepEqual(errors, []);
  console.log('DealerSocket production UI: session controls, live read-only leads, refresh, search/rooftop filters, scoped-viewer controls, desktop/mobile and zero runtime errors passed (synthetic APIs).');
} finally {
  await browser?.close();
  server.kill();
  if (server.exitCode === null) await new Promise(resolve => server.once('exit', resolve));
}
