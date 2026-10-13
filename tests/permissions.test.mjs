import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/permissions.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const policy = {};
new Function("exports", compiled)(policy);
const { canAccessPage, canViewProspect, hasPermission } = policy;
const prospect = (owner = "Mia Harris", rooftop = "Cranbourne Kia") => ({ owner, rooftop });

test("Super Admin inherits every administration and automation permission", () => {
  for (const page of ["overview", "conversations", "prospects", "journeys", "templates", "reports", "suppression", "team", "settings", "automation"]) assert.equal(canAccessPage("Super Admin", page), true, page);
  assert.equal(canViewProspect("Super Admin", prospect("Daniel Lee", "Geely Cranbourne")), true);
});

test("manager sees the assigned dealership but cannot configure the system", () => {
  assert.equal(canViewProspect("Dealership Manager", prospect("Other consultant")), true);
  assert.equal(canViewProspect("Dealership Manager", prospect("Mia Harris", "Cranbourne MG")), false);
  assert.equal(canAccessPage("Dealership Manager", "reports"), true);
  assert.equal(hasPermission("Dealership Manager", "reassign"), true);
  for (const page of ["journeys", "settings", "team", "automation", "suppression"]) assert.equal(canAccessPage("Dealership Manager", page), false, page);
});

test("staff can communicate and take over only own or unassigned rooftop prospects", () => {
  assert.equal(canViewProspect("Sales Consultant / Staff", prospect()), true);
  assert.equal(canViewProspect("Sales Consultant / Staff", prospect("Unassigned")), true);
  assert.equal(canViewProspect("Sales Consultant / Staff", prospect("Other consultant")), false);
  assert.equal(canViewProspect("Sales Consultant / Staff", prospect("Mia Harris", "Geely Cranbourne")), false);
  assert.equal(hasPermission("Sales Consultant / Staff", "sendSms"), true);
  assert.equal(hasPermission("Sales Consultant / Staff", "controlConversationJourney"), true);
  assert.equal(hasPermission("Sales Consultant / Staff", "reassign"), false);
  assert.equal(canAccessPage("Sales Consultant / Staff", "journeys"), false);
});

test("automation administrator can configure and monitor without user administration or staff sends", () => {
  for (const page of ["journeys", "templates", "automation", "reports", "conversations"]) assert.equal(canAccessPage("Automation / System Administrator", page), true, page);
  for (const page of ["team", "settings", "suppression"]) assert.equal(canAccessPage("Automation / System Administrator", page), false, page);
  assert.equal(hasPermission("Automation / System Administrator", "sendSms"), false);
  assert.equal(hasPermission("Automation / System Administrator", "reassign"), false);
});

test("unknown pages are denied", () => {
  assert.equal(canAccessPage("Super Admin", "nonexistent"), false);
});
