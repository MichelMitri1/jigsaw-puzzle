import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import WebSocket from "ws";
import sharp from "sharp";
import { targetFor } from "../shared/puzzle.js";
let server,
  data,
  base = "http://127.0.0.1:3099";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function start() {
  server = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, PORT: "3099", DATA_DIR: data },
    stdio: "pipe",
  });
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error("Server did not start");
}
async function stop() {
  const exited = new Promise((r) => server.once("exit", r));
  server.kill();
  await exited;
}
before(async () => {
  data = await mkdtemp(path.join(os.tmpdir(), "puzzlefolk-test-"));
  await start();
});
after(async () => {
  if (server.exitCode === null) await stop();
  await rm(data, { recursive: true, force: true });
});
async function create(body = {}) {
  const res = await fetch(`${base}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      count: 24,
      sample: "coast",
      title: "Test room",
      ...body,
    }),
  });
  return { res, room: await res.json() };
}
function connect(id, name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:3099/ws?room=${id}&name=${name}`);
    const messages = [];
    ws.on("error", reject);
    ws.on("message", (data) => {
      const msg = JSON.parse(data);
      messages.push(msg);
      if (msg.type === "init")
        resolve({
          ws,
          messages,
          init: msg,
          send: (msg) => ws.send(JSON.stringify(msg)),
          wait: async (predicate) => {
            for (let i = 0; i < 100; i++) {
              const index = messages.findIndex(predicate);
              if (index !== -1) return messages.splice(index, 1)[0];
              await sleep(20);
            }
            throw new Error("Timed out waiting for websocket event");
          },
        });
    });
  });
}
test("validates room creation and image uploads", async () => {
  assert.equal((await create({ count: 25 })).res.status, 400);
  assert.equal(
    (
      await create({
        sample: null,
        image: "data:image/jpeg;base64,bm90YW5pbWFnZQ==",
      })
    ).res.status,
    400,
  );
  const bytes = await sharp({
    create: { width: 100, height: 100, channels: 3, background: "#ee8844" },
  })
    .png()
    .toBuffer();
  const { res, room } = await create({
    sample: null,
    image: `data:image/png;base64,${bytes.toString("base64")}`,
  });
  assert.equal(res.status, 201);
  assert.match(room.imageUrl, /^\/uploads\/.*\.webp$/);
  assert.equal((await fetch(base + room.imageUrl)).status, 200);
  assert.equal((await fetch(base + "/api/rooms/invalid")).status, 404);
});
test("two players sync, enforce locks, snap, complete, and restore after restart", async () => {
  const { room } = await create();
  const a = await connect(room.id, "Alice"),
    b = await connect(room.id, "Bob");
  try {
    assert.equal(
      (await a.wait((m) => m.type === "presence" && m.players.length === 2))
        .players.length,
      2,
    );
    a.send({ type: "name", name: "Alicia" });
    assert.ok(
      (
        await b.wait(
          (m) =>
            m.type === "presence" && m.players.some((p) => p.name === "Alicia"),
        )
      ).players.some((p) => p.name === "Alicia"),
    );
    a.send({ type: "grab", pieceId: 0 });
    await a.wait((m) => m.type === "lock" && m.pieceId === 0);
    b.send({ type: "grab", pieceId: 0 });
    await b.wait((m) => m.type === "denied");
    b.send({ type: "drop", pieceId: 0, ...targetFor(room.pieces[0], 24) });
    await sleep(50);
    let current = await (await fetch(`${base}/api/rooms/${room.id}`)).json();
    assert.equal(current.pieces[0].placed, false);
    const target = targetFor(room.pieces[0], 24);
    a.send({ type: "move", pieceId: 0, x: target.x + 5, y: target.y + 5 });
    await b.wait((m) => m.type === "moving" && m.pieceId === 0);
    a.send({ type: "drop", pieceId: 0, x: target.x + 5, y: target.y + 5 });
    const snapped = await b.wait((m) => m.type === "piece" && m.piece.id === 0);
    assert.equal(snapped.piece.placed, true);
    assert.equal(snapped.piece.x, target.x);
    a.send({ type: "grab", pieceId: 1 });
    await a.wait((m) => m.type === "lock" && m.pieceId === 1);
    a.ws.close();
    await b.wait((m) => m.type === "piece" && m.piece.id === 1);
    for (let i = 1; i < 24; i++) {
      b.send({ type: "grab", pieceId: i });
      await b.wait((m) => m.type === "lock" && m.pieceId === i);
      b.send({ type: "drop", pieceId: i, ...targetFor(room.pieces[i], 24) });
      const msg = await b.wait((m) => m.type === "piece" && m.piece.id === i);
      assert.equal(msg.piece.placed, true);
      if (i === 23) assert.ok(msg.completedAt);
    }
    b.ws.close();
    await sleep(100);
    await stop();
    await start();
    current = await (await fetch(`${base}/api/rooms/${room.id}`)).json();
    assert.equal(current.pieces.filter((p) => p.placed).length, 24);
    assert.ok(current.completedAt);
  } finally {
    a.ws.close();
    b.ws.close();
  }
});
