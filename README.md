# Puzzlefolk

A complete photo jigsaw website for a quiet moment alone or a shared puzzle with friends.

## Run locally

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

Open the URL printed by Vite (normally http://localhost:5173; it uses the next port if that one is occupied). The frontend proxies its API and WebSocket traffic to port 3001. Create a puzzle, click **Invite a friend**, and copy the link. Friends on your Wi-Fi can join using your computer’s LAN address (for example, `http://192.168.1.10:5173`); open the site using that address before copying the invitation.

## Features

- Upload JPG, PNG, or WebP photos up to 10 MB, or choose one of four included gallery photos.
- Choose 24, 48, 96, 150, or 300 interlocking pieces.
- Drag pieces with a mouse, pen, or touch. Pieces snap to their correct positions.
- Shared rooms for up to 12 players, with live cursors, player names, and exclusive piece ownership while dragging.
- Reference photo, optional picture guide, edge filter, shuffle, zoom, and optional snap sounds. Drag empty table space to pan on smaller screens or when zoomed in.
- Keyboard play: Tab to a piece, Enter/Space to grab, arrows to move, Shift + arrows for precision, Enter/Space to drop, Escape to cancel.
- Progress and uploaded images persist on disk, including across server restarts. Recently visited rooms appear on the homepage in the same browser.
- Reconnects automatically and restores the server’s saved state after a network interruption.

Images are cropped to a 3:2 landscape frame. Invitation links grant access to edit the shared puzzle; there are no accounts. The displayed timer measures elapsed time since room creation, including time away.

## Production

```sh
npm run build
npm start
```

The production server serves the frontend, API, uploads, and WebSocket endpoint on port **3001** (override with `PORT`). Set `DATA_DIR` to a persistent writable directory; by default, it uses `./data`. Deploy to a Node host with WebSocket support, HTTPS, and persistent storage. Use a **single server instance**, because connected players and piece locks are coordinated in memory. Static-only hosting will not run the shared rooms.

Or use Docker:

```sh
docker build -t puzzlefolk .
docker run -p 3001:3001 -v puzzlefolk-data:/app/data puzzlefolk
```

For internet invitations, deploy the server to a publicly reachable host and copy the link from that domain. A localhost link only opens on your own computer. When using a reverse proxy, forward `/ws` WebSocket upgrades along with normal HTTP traffic. Back up `DATA_DIR` to retain puzzles and images. All puzzles remain until their data is removed by the server operator.

## Validation

```sh
npm test
npm run build
```

Tests cover matching puzzle seams, all piece counts, shuffle preservation, upload validation, two-player movement, lock contention, disconnect cleanup, snapping, completion, and persistence after restarting the server. Tests create an isolated temporary data directory and use port 3099.

With the development server running and Chrome installed, run the browser checks:

```sh
npm run test:browser -- http://localhost:5173
```

Use the actual Vite port if different. Browser checks cover uploads, copying invitations, two-player mouse and touch snapping, keyboard controls, mobile panning, and responsive layouts. Screenshots are saved under `/tmp/puzzlefolk-*.png`.

## Stack and credits

React + Vite, Express, WebSocket (`ws`), and Sharp for validated image processing. UI icons by Lucide. Gallery photos from Unsplash, bundled locally; typography uses DM Sans and Libre Caslon Display bundled locally from Google Fonts with system fallbacks. No external API keys are required.
