import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  BOARD,
  TABLE,
  COUNTS,
  makePieces,
  scatterPieces,
  targetFor,
} from "../shared/puzzle.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = process.env.DATA_DIR || path.join(root, "data");
mkdirSync(path.join(data, "uploads"), { recursive: true });
mkdirSync(path.join(data, "rooms"), { recursive: true });
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "16mb" }));
app.use(
  "/uploads",
  express.static(path.join(data, "uploads"), { maxAge: "1y", immutable: true }),
);
const rooms = new Map(),
  peers = new Map(),
  locks = new Map();
const validId = (id) => /^[a-f0-9]{24}$/.test(id);
function getRoom(id) {
  if (!validId(id)) return null;
  if (rooms.has(id)) return rooms.get(id);
  try {
    const room = JSON.parse(
      readFileSync(path.join(data, "rooms", `${id}.json`), "utf8"),
    );
    rooms.set(id, room);
    return room;
  } catch {
    return null;
  }
}
function save(room) {
  const file = path.join(data, "rooms", `${room.id}.json`);
  writeFileSync(file + ".tmp", JSON.stringify(room));
  renameSync(file + ".tmp", file);
}
function publicRoom(room) {
  return room;
}
function send(ws, msg) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}
function broadcast(id, msg, except) {
  for (const ws of peers.get(id) || []) if (ws !== except) send(ws, msg);
}
function presence(id) {
  broadcast(id, {
    type: "presence",
    players: [...(peers.get(id) || [])].map((ws) => ({
      id: ws.playerId,
      name: ws.playerName,
      color: ws.color,
    })),
  });
}
const creations = new Map();
app.post("/api/rooms", async (req, res, next) => {
  try {
    const ip = req.ip,
      now = Date.now(),
      recent = (creations.get(ip) || []).filter((t) => now - t < 3600000);
    if (recent.length >= 40)
      return res.status(429).json({
        error:
          "You’ve made a lot of puzzles. Please try again in a little while.",
      });
    const { count, image, sample, title } = req.body;
    if (!Object.hasOwn(COUNTS, count))
      return res
        .status(400)
        .json({ error: "Choose a supported number of pieces." });
    const samples = ["coast", "mountains", "flowers", "city"];
    let imageUrl;
    if (sample && samples.includes(sample)) imageUrl = `/images/${sample}.jpg`;
    else if (
      typeof image === "string" &&
      /^data:image\/(jpeg|png|webp);base64,/.test(image)
    ) {
      const bytes = Buffer.from(image.split(",")[1], "base64");
      if (bytes.length > 10 * 1024 * 1024)
        return res
          .status(413)
          .json({ error: "Please choose an image under 10 MB." });
      const filename = `${randomBytes(12).toString("hex")}.webp`;
      try {
        await sharp(bytes, { limitInputPixels: 40000000 })
          .rotate()
          .resize(1600, 1067, { fit: "cover" })
          .webp({ quality: 88 })
          .toFile(path.join(data, "uploads", filename));
      } catch {
        return res.status(400).json({
          error: "We couldn’t read that image. Try a JPG, PNG, or WebP photo.",
        });
      }
      imageUrl = `/uploads/${filename}`;
    } else
      return res.status(400).json({
        error: "Please upload an image or select one from the gallery.",
      });
    const id = randomBytes(12).toString("hex");
    const room = {
      id,
      title:
        typeof title === "string"
          ? title.trim().slice(0, 80) || "Our little puzzle"
          : "Our little puzzle",
      count: Number(count),
      imageUrl,
      createdAt: Date.now(),
      completedAt: null,
      pieces: makePieces(Number(count), randomBytes(4).readUInt32LE()),
    };
    save(room);
    rooms.set(id, room);
    recent.push(now);
    creations.set(ip, recent);
    res.status(201).json(publicRoom(room));
  } catch (error) {
    next(error);
  }
});
app.get("/api/rooms/:id", (req, res) => {
  const room = getRoom(req.params.id);
  room
    ? res.json(publicRoom(room))
    : res.status(404).json({
        error:
          "This puzzle could not be found. Check the invitation link or create a new one.",
      });
});
app.get("/api/health", (_, res) => res.json({ ok: true }));
app.use("/api", (_, res) => res.status(404).json({ error: "Not found" }));
app.use((error, req, res, next) => {
  console.error(error.message);
  res.status(error.status || 500).json({
    error:
      error.status === 413
        ? "That image is too large. Please choose one under 10 MB."
        : "Something went wrong. Please try again.",
  });
});
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*splat}", (_, res) =>
    res.sendFile(path.join(root, "dist", "index.html")),
  );
}
const server = createServer(app),
  wss = new WebSocketServer({ server, path: "/ws", maxPayload: 2048 });
wss.on("connection", (ws, req) => {
  const url = new URL(req.url, "http://localhost"),
    id = url.searchParams.get("room"),
    room = getRoom(id || "");
  if (!room) return ws.close(1008, "Puzzle not found");
  if ((peers.get(id)?.size || 0) >= 12)
    return ws.close(1008, "This table is full (12 players)");
  ws.playerId = randomBytes(6).toString("hex");
  ws.playerName =
    (url.searchParams.get("name") || "Puzzle pal").trim().slice(0, 24) ||
    "Puzzle pal";
  ws.color = ["#de7751", "#608876", "#8a7bae", "#b28b46", "#668dab", "#b5718a"][
    (peers.get(id)?.size || 0) % 6
  ];
  ws.isAlive = true;
  if (!peers.has(id)) peers.set(id, new Set());
  peers.get(id).add(ws);
  if (!locks.has(id)) locks.set(id, new Map());
  const roomLocks = locks.get(id);
  send(ws, {
    type: "init",
    room: publicRoom(room),
    playerId: ws.playerId,
    locks: [...roomLocks].map(([pieceId, owner]) => ({
      pieceId,
      playerId: owner.playerId,
    })),
  });
  presence(id);
  ws.on("pong", () => {
    ws.isAlive = true;
  });
  let lastCursor = 0,
    lastMove = 0,
    lastShuffle = 0;
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "name") {
      if (typeof msg.name === "string") {
        ws.playerName = msg.name.trim().slice(0, 24) || "Puzzle pal";
        presence(id);
      }
      return;
    }
    if (msg.type === "cursor") {
      if (Date.now() - lastCursor < 40) return;
      lastCursor = Date.now();
      if (Number.isFinite(msg.x) && Number.isFinite(msg.y))
        broadcast(
          id,
          {
            type: "cursor",
            playerId: ws.playerId,
            x: Math.max(0, Math.min(TABLE.width, msg.x)),
            y: Math.max(0, Math.min(TABLE.height, msg.y)),
          },
          ws,
        );
      return;
    }
    if (msg.type === "shuffle") {
      if (Date.now() - lastShuffle < 1500 || roomLocks.size) return;
      lastShuffle = Date.now();
      room.pieces = scatterPieces(room.pieces, room.count, Date.now());
      save(room);
      broadcast(id, { type: "state", room });
      return;
    }
    if (!Number.isInteger(msg.pieceId)) return;
    const piece = room.pieces[msg.pieceId];
    if (!piece || piece.placed) return;
    if (msg.type === "grab") {
      if (roomLocks.has(piece.id)) {
        send(ws, { type: "denied", piece });
        return;
      }
      roomLocks.set(piece.id, ws);
      broadcast(id, { type: "lock", pieceId: piece.id, playerId: ws.playerId });
      return;
    }
    if (roomLocks.get(piece.id) !== ws) return;
    if (msg.type === "cancel") {
      roomLocks.delete(piece.id);
      broadcast(id, { type: "piece", piece });
      return;
    }
    if (
      !["move", "drop"].includes(msg.type) ||
      !Number.isFinite(msg.x) ||
      !Number.isFinite(msg.y)
    )
      return;
    if (msg.type === "move") {
      if (Date.now() - lastMove < 25) return;
      lastMove = Date.now();
      broadcast(
        id,
        {
          type: "moving",
          pieceId: piece.id,
          x: Math.max(0, Math.min(TABLE.width, msg.x)),
          y: Math.max(0, Math.min(TABLE.height, msg.y)),
        },
        ws,
      );
      return;
    }
    const [cols, rows] = COUNTS[room.count];
    piece.x = Math.max(
      10,
      Math.min(TABLE.width - BOARD.width / cols - 10, msg.x),
    );
    piece.y = Math.max(
      10,
      Math.min(TABLE.height - BOARD.height / rows - 10, msg.y),
    );
    const target = targetFor(piece, room.count),
      threshold = Math.max(
        15,
        Math.min(BOARD.width / cols, BOARD.height / rows) * 0.3,
      );
    if (Math.hypot(piece.x - target.x, piece.y - target.y) < threshold) {
      Object.assign(piece, target);
      piece.placed = true;
    }
    if (room.pieces.every((p) => p.placed)) room.completedAt = Date.now();
    roomLocks.delete(piece.id);
    save(room);
    broadcast(id, { type: "piece", piece, completedAt: room.completedAt });
  });
  ws.on("close", () => {
    for (const [pieceId, owner] of roomLocks)
      if (owner === ws) {
        roomLocks.delete(pieceId);
        broadcast(id, { type: "piece", piece: room.pieces[pieceId] });
      }
    peers.get(id)?.delete(ws);
    presence(id);
    if (!peers.get(id)?.size) {
      peers.delete(id);
      locks.delete(id);
      rooms.delete(id);
    }
  });
  ws.on("error", () => ws.close());
});
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);
heartbeat.unref();
server.listen(Number(process.env.PORT) || 3001, "0.0.0.0", () =>
  console.log(
    `Puzzlefolk server running on port ${Number(process.env.PORT) || 3001}`,
  ),
);
