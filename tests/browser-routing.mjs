// Routing, identity and history checks with synthetic API data only.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

const root=fileURLToPath(new URL('../',import.meta.url));
const reservation=createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));
const port=reservation.address().port;await new Promise(r=>reservation.close(r));
const base=`http://localhost:${port}`;
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','-p',String(port)],{cwd:root,windowsHide:true,stdio:'ignore'});
let browser;
try {
  let ready=false;
  for(let i=0;i<100;i++) {
    try { if((await fetch(`${base}/signin`)).ok) { ready=true;break; } } catch {}
    await new Promise(r=>setTimeout(r,200));
  }
  assert.ok(ready,'Production server starts');
  browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  let signedIn=true;let limited=false;
  const errors=[];const apiCalls=[];
  const records=['one','two'].map((value,i)=>({id:`pr_${value}`,rooftopId:'cranbourne_kia',dealerSocketOpportunityId:`op_${value}`,
    customer:{firstName:i?'Second':'First',lastName:'Routing Fixture',mobile:'+61412345678'},normalizedMobile:'+61412345678',
    vehicle:{make:'Kia',model:'Fixture'},leadSource:'Fixture',status:'new',journey:{status:'paused',currentStep:0,currentStepName:'Pending'},
    unreadInboundCount:0,createdAt:'2026-10-16T00:00:00Z',lastActivityAt:'2026-10-16T00:00:00Z'}));
  await context.route('**/api/**',async route=>{
    const url=new URL(route.request().url());apiCalls.push(url.pathname);
    let status=200,body=[];
    const user={id:'route-admin',name:'Routing Admin',email:'routing@example.test',role:limited?'Dealership Manager':'Super Admin',apiRole:limited?'read_only':'group_admin',
      isActive:true,rooftopIds:['cranbourne_kia'],rooftops:['Cranbourne Kia'],ownProspectsOnly:false,
      permissions:limited?['overview','conversations']:['overview','conversations','sendSms','controlConversationJourney','reassign','settings','automation','journeys','reports','compliance','users']};
    if(url.pathname==='/api/auth/login') { signedIn=true;body={user}; }
    else if(url.pathname==='/api/auth/me') { status=signedIn?200:401;body=signedIn?{user}:{message:'Please sign in.'}; }
    else if(url.pathname==='/api/prospects')body=records;
    else if(url.pathname.startsWith('/api/prospects/')) {
      const id=url.pathname.split('/')[3];const record=records.find(r=>r.id===id);
      if(!record) { status=403;body={message:'No access to this prospect'}; }
      else body=url.pathname.endsWith('/thread')?{prospect:record,totalEvents:2,events:[
        {id:'fixture-inbound',prospectId:id,type:'customer_inbound',direction:'inbound',content:'Hi, is the Kia still available? I would like to arrange a test drive.',timestamp:'2026-10-28T04:00:00Z'},
        {id:'fixture-outbound',prospectId:id,type:'staff_outbound',direction:'outbound',authorName:'Routing Admin',content:'Yes, it is available. What time would suit you to visit Cranbourne Kia?',deliveryStatus:'delivered',timestamp:'2026-10-28T04:05:00Z'},
      ]}:record;
    }
    else if(url.pathname.endsWith('/leads/status'))body={state:'idle',snapshotState:null,jobId:null,startedAt:null,fetchedAt:null,completedAt:null,durationSeconds:null,
      progress:null,errorCode:null,readOnly:true,limited:false,records:[],rooftops:[],issues:[],coverageNote:'Fixture',schedule:{enabled:true,intervalSeconds:3600,nextRunAt:null}};
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.waitForURL(`${base}/overview`);
  if (process.env.UI_SCREENSHOTS) {
    mkdirSync(path.join(root,'test-results'),{recursive:true});
    await page.screenshot({path:path.join(root,'test-results','overview-desktop.png'),fullPage:true});
  }
  await page.getByRole('link',{name:'Prospect list',exact:true}).click();
  await page.waitForURL(`${base}/prospects`);
  await page.getByRole('heading',{name:'Live dealership leads',exact:true}).waitFor();
  await page.reload();
  await page.getByRole('heading',{name:'Live dealership leads',exact:true}).waitFor();
  assert.equal(new URL(page.url()).pathname,'/prospects');
  await page.getByRole('link',{name:'Portal conversations',exact:true}).click();
  await page.waitForURL(`${base}/prospects?source=portal`);
  await page.reload();
  assert.equal(await page.getByRole('link',{name:'Portal conversations',exact:true}).getAttribute('aria-current'),'page');
  await page.getByRole('link',{name:'Conversation portal',exact:true}).click();
  await page.locator('[data-prospect-id="pr_two"]').click();
  await page.waitForURL(`${base}/conversations/pr_two`);
  await page.locator('.thread-header h2').filter({hasText:'Second Routing Fixture'}).waitFor();
  for (const viewport of [{width:1440,height:900},{width:1280,height:720},{width:900,height:700},{width:390,height:844}]) {
    await page.setViewportSize(viewport);
    await page.getByRole('textbox',{name:'SMS message',exact:true}).fill('Layout test only; never sent');
    const box=await page.getByRole('button',{name:'Send SMS',exact:true}).boundingBox();
    assert.ok(box && box.y>=0 && box.y+box.height<=viewport.height, `Send SMS stays in viewport at ${viewport.width}x${viewport.height}: ${JSON.stringify(box)}`);
    const input=await page.getByRole('textbox',{name:'SMS message',exact:true}).boundingBox();
    assert.ok(input && input.y>=0 && input.y+input.height<=viewport.height,'SMS message box stays visible');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth + 1), 'Conversation fits the viewport width');
    assert.ok(await page.getByRole('heading',{name:'Send a message',exact:true}).isVisible(),'SMS composer is clearly labelled');
    if (process.env.UI_SCREENSHOTS) {
      mkdirSync(path.join(root,'test-results'),{recursive:true});
      await page.screenshot({path:path.join(root,'test-results',`conversation-${viewport.width}.png`),fullPage:true});
    }
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.reload();
  await page.locator('.thread-header h2').filter({hasText:'Second Routing Fixture'}).waitFor();
  await page.locator('[data-prospect-id="pr_one"]').click();
  await page.waitForURL(`${base}/conversations/pr_one`);
  await page.goBack();await page.waitForURL(`${base}/conversations/pr_two`);
  await page.locator('.thread-header h2').filter({hasText:'Second Routing Fixture'}).waitFor();
  await page.goForward();await page.waitForURL(`${base}/conversations/pr_one`);
  await page.locator('.thread-header h2').filter({hasText:'First Routing Fixture'}).waitFor();
  const tab=await context.newPage();await tab.goto(`${base}/conversations/pr_two`);
  await tab.locator('.thread-header h2').filter({hasText:'Second Routing Fixture'}).waitFor();await tab.close();
  await page.goto(`${base}/?prospect=pr_two`);await page.waitForURL(`${base}/conversations/pr_two`);
  await page.getByRole('link',{name:'Automation monitoring',exact:true}).click();
  await page.waitForURL(`${base}/automation`);await page.getByRole('heading',{name:'Connector monitoring',exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Open menu',exact:true}).click();
  await page.getByRole('link',{name:'Prospect list',exact:true}).click();await page.waitForURL(`${base}/prospects`);
  await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().right<=1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile layout fits');
  limited=true;const count=apiCalls.filter(p=>p.includes('/leads/')).length;
  await page.goto(`${base}/automation`);await page.getByRole('heading',{name:'Access unavailable',exact:true}).waitFor();
  assert.equal(apiCalls.filter(p=>p.includes('/leads/')).length,count,'Denied route does not mount its screen');
  await page.goto(`${base}/conversations/hidden`);await page.getByRole('alert').filter({hasText:'No access to this prospect'}).waitFor();
  assert.equal(await page.locator('.thread-header h2').count(),0,'Denied thread does not show another customer');
  signedIn=false;limited=false;
  await page.goto(`${base}/conversations/pr_two`);await page.waitForURL(/\/signin\?next=/);
  assert.equal(new URL(page.url()).searchParams.get('next'),'/conversations/pr_two');
  await page.getByLabel('Work email',{exact:true}).fill('routing@example.test');await page.getByLabel('Password',{exact:true}).fill('fixture-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(`${base}/conversations/pr_two`);
  await page.locator('.thread-header h2').filter({hasText:'Second Routing Fixture'}).waitFor();
  await page.goto(`${base}/signin?next=${encodeURIComponent('https://evil.example/')}`);
  await page.getByLabel('Work email',{exact:true}).fill('routing@example.test');await page.getByLabel('Password',{exact:true}).fill('fixture-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(`${base}/overview`);
  const missing=await page.goto(`${base}/unknown-page`);assert.equal(missing.status(),404);
  assert.deepEqual(errors,[]);
  console.log('Portal routing passed: sidebar URLs, refresh, prospect tabs, conversation selection, back/forward, direct/new-tab/legacy links, mobile, permissions, denied thread, sign-in return, redirect safety and 404 (synthetic APIs).');
} finally {
  await browser?.close();server.kill();
  if(server.exitCode===null)await new Promise(r=>server.once('exit',r));
}
