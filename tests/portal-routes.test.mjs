import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source=readFileSync(new URL('../lib/portal-routes.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};new Function('exports',compiled)(exports);
const {safePortalDestination,conversationPath}=exports;

test('sign-in return destinations accept portal deep links and reject external or malformed URLs',()=>{
  for(const value of ['https://evil.example/overview','//evil.example','/\\evil.example','javascript:alert(1)',
    '/signin','/api/prospects','/unknown','/conversations/a/b','/conversations/%2Fsecret','/conversations/%5Csecret',
    '/conversations/%00','/conversations/%ZZ',null,undefined]) assert.equal(safePortalDestination(value),'/overview');
  assert.equal(safePortalDestination('/automation'),'/automation');
  assert.equal(safePortalDestination('/prospects?source=portal'),'/prospects?source=portal');
  assert.equal(safePortalDestination('/conversations/pr_123'),'/conversations/pr_123');
  assert.equal(conversationPath('test ?#'),'\/conversations/test%20%3F%23');
});
