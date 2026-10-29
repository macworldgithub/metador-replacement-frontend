// Synthetic API fixtures: no real SMS, CRM writes or database calls.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const socket = createServer(); await new Promise(r => socket.listen(0, '127.0.0.1', r));
const port = socket.address().port; await new Promise(r => socket.close(r));
const base = `http://localhost:${port}`;
const server = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port)], {
  cwd: root, env: { ...process.env, PORTAL_BUILD_DIR: process.env.PORTAL_BUILD_DIR || '.next-ui-preview' }, windowsHide: true, stdio: 'ignore',
});
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${base}/signin`)).ok) { ready = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  assert.ok(ready, 'Preview server starts');
  browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  let failure = false, missing = false, enabled = false;
  const errors = [];
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url()); let body = [], status = 200;
    if (url.pathname === '/api/auth/me') body = { user: { id: 'fixture', name: 'Fixture Admin', email: 'admin@example.test', role: 'Super Admin', apiRole: 'group_admin', isActive: true,
      rooftopIds: ['cranbourne_kia'], rooftops: ['Cranbourne Kia'], ownProspectsOnly: false,
      permissions: ['overview', 'conversations', 'journeys', 'reports', 'settings', 'automation', 'users', 'compliance'] } };
    else if (url.pathname === '/api/rooftops') body = [{ id: 'cranbourne_kia', name: 'Configured Kia', address: 'Recorded address', senderPhone: '', displayPhone: '', smsMode: 'disabled', sendHours: { start: '09:00', end: '20:00' }, closedDays: ['Sunday'] }];
    else if (url.pathname.includes('/journeys/')) { enabled = !enabled; body = { id: 'saved', enabled }; }
    else if (url.pathname === '/api/journeys') body = missing ? [] : [{ key: 'saved', data: { rooftopId: 'cranbourne_kia', leadType: 'new', name: 'Recorded journey', status: 'published', version: 4, isCurrent: true, enabled,
      steps: [{ name: 'Saved first step', delayType: 'immediate', delayValue: 0, template: 'Saved SMS template' }] } }];
    else if (url.pathname.includes('/reports/')) {
      status = failure ? 503 : 200;
      body = failure ? { message: 'Unavailable' } : { generatedAt: '2026-10-29T00:00:00Z', excludedTestRecords: 1, medianFirstSmsSeconds: null, daily: [{ date: '2026-10-29', leads: 7, replies: 2 }],
        rooftops: [{ rooftopId: 'cranbourne_kia', totalLeads: 7, replied: 2, replyRate: 2 / 7, medianFirstSmsSeconds: null, failedSends: 0, optedOut: 1, outcomes: { handed_to_salesperson: 2 } }] };
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/reports`);
  await page.getByText('1 known test records excluded.', { exact: false }).waitFor();
  assert.equal(await page.getByText('No confirmed send records', { exact: true }).count(), 1);
  assert.equal(await page.getByText('< 60s', { exact: true }).count(), 0);
  assert.equal(await page.locator('.report-stats article').first().locator('b').innerText(), '7');
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export CSV' }).click();
  assert.equal((await download).suggestedFilename(), 'journey-performance.csv');
  failure = true; await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Could not load journey performance' }).waitFor();
  assert.equal(await page.locator('.report-stats article').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Export CSV' }).isDisabled(), true);
  await page.goto(`${base}/journeys`); await page.getByText('Recorded journey', { exact: true }).waitFor();
  assert.equal(await page.getByText('PAUSED', { exact: true }).count(), 1);
  await page.getByRole('button', { name: 'Activate', exact: true }).click(); await page.getByText('ACTIVE', { exact: true }).waitFor();
  missing = true; await page.reload(); await page.getByText('No current published journey', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Activate', exact: true }).isDisabled(), true);
  await page.goto(`${base}/settings`); await page.getByText('NOT CONFIGURED', { exact: true }).waitFor();
  await page.getByText('SMS sending: Disabled', { exact: true }).waitFor();
  assert.equal(await page.getByText('ACTIVE', { exact: true }).count(), 0);
  assert.equal(await page.locator('input[value="Recorded address"]').count(), 1);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []); console.log('Real-data screen checks passed (synthetic fixtures).');
} finally { await browser?.close(); server.kill(); }
