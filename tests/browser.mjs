import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { BOARD, targetFor } from "../shared/puzzle.js";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
const base =
  process.argv[2] || process.env.BROWSER_BASE_URL || "http://localhost:5173";
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(base);
  await page.getByRole("heading", { name: /Life’s better/ }).waitFor();
  await page.screenshot({ path: "/tmp/puzzlefolk-home.png", fullPage: true });
  await page.getByRole("button", { name: "Create your puzzle" }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles("public/images/flowers.jpg");
  await page.getByLabel("Give it a name").fill("A shared flower garden");
  await page.getByRole("button", { name: "24 A quick pause" }).click();
  await page.getByRole("button", { name: "Let’s make a puzzle" }).click();
  await page.getByText("Connected · progress saved").waitFor();
  const url = page.url(),
    id = url.split("/").at(-1);
  assert.match(url, /\/p\/[a-f0-9]{24}$/);
  await page.getByRole("button", { name: "Invite a friend" }).click();
  await page.getByLabel("Your name at the table").fill("Michel");
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), url);
  await page.getByRole("button", { name: "Close dialog" }).click();
  const context2 = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const friend = await context2.newPage();
  friend.on("pageerror", (e) => errors.push(e.message));
  await friend.goto(url);
  await friend.getByText("Connected · progress saved").waitFor();
  await page.getByText("2 people, one puzzle").waitFor();
  const room = await (await page.request.get(`${base}/api/rooms/${id}`)).json();
  const piece = room.pieces[0],
    target = targetFor(piece, room.count);
  const coords = await page.locator(".puzzle-table").evaluate(
    (svg, p) => {
      const point = svg.createSVGPoint();
      point.x = p.x;
      point.y = p.y;
      const r = point.matrixTransform(svg.getScreenCTM());
      return { x: r.x, y: r.y };
    },
    { x: piece.x + 55, y: piece.y + 55 },
  );
  const dest = await page.locator(".puzzle-table").evaluate(
    (svg, p) => {
      const point = svg.createSVGPoint();
      point.x = p.x;
      point.y = p.y;
      const r = point.matrixTransform(svg.getScreenCTM());
      return { x: r.x, y: r.y };
    },
    { x: target.x + 55, y: target.y + 55 },
  );
  await page.mouse.move(coords.x, coords.y);
  await page.mouse.down();
  await page.mouse.move(dest.x, dest.y, { steps: 20 });
  await page.mouse.up();
  await page.getByText("1 / 24", { exact: true }).waitFor();
  await friend.getByText("1 / 24", { exact: true }).waitFor();
  await page.screenshot({ path: "/tmp/puzzlefolk-table.png", fullPage: true });
  await page.reload();
  await page.getByText("1 / 24", { exact: true }).waitFor();
  const keyboardPiece = page.locator('[data-piece-id="2"]');
  const originalPosition = await keyboardPiece.getAttribute("transform");
  await keyboardPiece.focus();
  await keyboardPiece.press("Enter");
  await page.locator('[data-piece-id="2"].active').waitFor();
  await keyboardPiece.press("ArrowRight");
  assert.notEqual(
    await keyboardPiece.getAttribute("transform"),
    originalPosition,
  );
  await keyboardPiece.press("Escape");
  await page.waitForFunction(
    (original) =>
      document
        .querySelector('[data-piece-id="2"]')
        .getAttribute("transform") === original,
    originalPosition,
  );
  await page.getByRole("button", { name: "Edge pieces only" }).click();
  assert.ok((await page.locator('.puzzle-piece[opacity="0.12"]').count()) > 0);
  await page.getByRole("button", { name: "Picture guide" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByText("125%", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Reset view" }).click();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const phone = await mobile.newPage();
  phone.on("pageerror", (e) => errors.push(e.message));
  await phone.goto(base);
  assert.ok(
    await phone.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await phone.screenshot({
    path: "/tmp/puzzlefolk-mobile.png",
    fullPage: true,
  });
  await phone.goto(url);
  await phone.getByText("Connected · progress saved").waitFor();
  assert.ok(
    await phone.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await phone.screenshot({
    path: "/tmp/puzzlefolk-mobile-table.png",
    fullPage: true,
  });
  const touch = await mobile.newCDPSession(phone);
  const scrollBefore = await phone
    .locator(".table-viewport")
    .evaluate((el) => el.scrollLeft);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 190, y: 250 }],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 270, y: 250 }],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert.ok(
    (await phone.locator(".table-viewport").evaluate((el) => el.scrollLeft)) <
      scrollBefore,
  );
  await phone.getByRole("button", { name: "Zoom out" }).click();
  await phone.getByRole("button", { name: "Zoom out" }).click();
  await phone.getByText("50%", { exact: true }).waitFor();
  const touchPiece = room.pieces[1],
    touchTarget = targetFor(touchPiece, 24);
  const screenPoint = async (p) =>
    phone.locator(".puzzle-table").evaluate((svg, p) => {
      const point = svg.createSVGPoint();
      point.x = p.x + 55;
      point.y = p.y + 55;
      const result = point.matrixTransform(svg.getScreenCTM());
      return { x: result.x, y: result.y };
    }, p);
  const from = await screenPoint(touchPiece),
    to = await screenPoint(touchTarget);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [from],
  });
  for (let i = 1; i <= 15; i++)
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: from.x + ((to.x - from.x) * i) / 15,
          y: from.y + ((to.y - from.y) * i) / 15,
        },
      ],
    });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await phone.getByText("2 / 24", { exact: true }).waitFor();
  await friend.getByText("2 / 24", { exact: true }).waitFor();
  await phone.goto(base + "/p/aaaaaaaaaaaaaaaaaaaaaaaa");
  await phone.getByText("A little piece is missing.").waitFor();
  await context2.close();
  await mobile.close();
  assert.deepEqual(errors, []);
  console.log(
    "Browser checks passed: upload, invite, clipboard, two-player drag and snap, reload, tools, keyboard, mobile layout, touch pan and snap, missing room, no runtime errors.",
  );
} catch (error) {
  await page.screenshot({
    path: "/tmp/puzzlefolk-test-failure.png",
    fullPage: true,
  });
  console.log("Page errors:", errors);
  throw error;
} finally {
  await browser.close();
}
