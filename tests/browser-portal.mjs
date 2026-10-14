import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export async function runBrowserPortal({
  backendUrl,
  prospectId,
  email,
  password,
}) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const executablePath =
    process.env.BROWSER_EXECUTABLE_PATH ||
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  if (!existsSync(executablePath))
    throw new Error(
      "Set BROWSER_EXECUTABLE_PATH to an installed Chromium browser.",
    );
  const reservation = createServer();
  await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const server = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/next/dist/bin/next"),
      "start",
      "-p",
      String(port),
    ],
    {
      cwd: root,
      env: { ...process.env, API_BASE_URL: backendUrl },
      windowsHide: true,
      stdio: "ignore",
    },
  );
  const base = `http://localhost:${port}`;
  let browser;
  const pageErrors = [];
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(`${base}/signin`)).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert.equal(ready, true, "Frontend preview server must start");
    browser = await chromium.launch({ executablePath, headless: true });
    const context = await browser.newContext({
      viewport: { width: 1664, height: 1050 },
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.setDefaultTimeout(15000);
    await page.goto(`${base}/signin`);
    await page.getByLabel("Work email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Invalid email or password" })
      .waitFor();
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(base + "/");
    await page
      .locator(".profile-trigger")
      .filter({ hasText: "Group Admin" })
      .waitFor();
    await page
      .locator("nav.main-nav")
      .getByRole("button", { name: "Conversation portal" })
      .click();
    await page.locator(`[data-prospect-id="${prospectId}"]`).click();
    await page
      .locator(".thread-header h2")
      .filter({ hasText: "Test Prospect" })
      .waitFor();
    await page
      .getByLabel("SMS message", { exact: true })
      .fill("Browser test drive response");
    await page.getByRole("button", { name: "Send SMS", exact: true }).click();
    await page
      .locator(".bubble p")
      .filter({ hasText: "Browser test drive response" })
      .waitFor();
    await page
      .getByRole("button", { name: "Internal note", exact: true })
      .click();
    await page
      .getByLabel("Internal note", { exact: true })
      .fill("Browser private team note");
    await page.getByRole("button", { name: "Add note", exact: true }).click();
    await page
      .locator(".internal-note p")
      .filter({ hasText: "Browser private team note" })
      .waitFor();
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await page
      .locator(".live-status")
      .filter({ hasText: "JOURNEY ACTIVE" })
      .waitFor();
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page
      .locator(".live-status")
      .filter({ hasText: "JOURNEY PAUSED" })
      .waitFor();
    await page
      .getByRole("button", { name: "Skip current step", exact: true })
      .click();
    await page
      .locator(".detail-section")
      .filter({ hasText: "Journey controls" })
      .getByText("Step 2: Qualify", { exact: true })
      .waitFor();
    await page
      .getByLabel("Salesperson name", { exact: true })
      .fill("Browser Assigned Staff");
    await page
      .getByLabel("Email (optional)", { exact: true })
      .fill("browser-staff@example.test");
    await page
      .getByRole("button", { name: "Save assignment", exact: true })
      .click();
    await page
      .locator(".system-event")
      .filter({ hasText: "Prospect reassigned to Browser Assigned Staff" })
      .waitFor();
    await page
      .getByLabel("Outcome", { exact: true })
      .selectOption("appointment_requested");
    await page
      .getByLabel("Outcome notes", { exact: true })
      .fill("Browser appointment confirmed");
    await page
      .getByRole("button", { name: "Save outcome", exact: true })
      .click();
    await page
      .locator(".live-status")
      .filter({ hasText: "JOURNEY COMPLETED" })
      .waitFor();
    await page
      .locator(".system-event")
      .filter({ hasText: "Browser appointment confirmed" })
      .waitFor();
    const artifacts = path.join(root, "test-results");
    mkdirSync(artifacts, { recursive: true });
    await page.screenshot({
      path: path.join(artifacts, "conversation-desktop.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole("button", { name: "Prospect details", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Opportunity details", exact: true })
      .waitFor();
    await page.waitForFunction(
      () =>
        Math.abs(
          document.querySelector(".detail-panel").getBoundingClientRect().left,
        ) < 1,
    );
    await page.screenshot({
      path: path.join(artifacts, "conversation-mobile.png"),
      fullPage: true,
      animations: "disabled",
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      true,
      "Mobile page must not overflow horizontally",
    );
    await page
      .getByRole("button", { name: "Back to thread", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Back to inbox", exact: true })
      .click();
    await page.locator(`[data-prospect-id="${prospectId}"]`).waitFor();
    assert.deepEqual(pageErrors, [], "Browser must not report runtime errors");
    await context.close();
    return { desktop: true, mobile: true, runtimeErrors: pageErrors.length };
  } finally {
    if (browser) await browser.close();
    server.kill();
    await new Promise((resolve) => {
      if (server.exitCode !== null) resolve();
      else {
        server.once("exit", resolve);
        setTimeout(resolve, 3000);
      }
    });
  }
}

if (process.argv.includes("--run")) {
  runBrowserPortal({
    backendUrl: process.env.PORTAL_BROWSER_BACKEND,
    prospectId: process.env.PORTAL_BROWSER_PROSPECT,
    email: process.env.PORTAL_BROWSER_EMAIL,
    password: process.env.PORTAL_BROWSER_PASSWORD,
  })
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(String(error.message).split("\n")[0]);
      process.exitCode = 1;
    });
}
