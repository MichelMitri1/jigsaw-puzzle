export const TABLE = { width: 1440, height: 960 };
export const BOARD = { x: 390, y: 260, width: 660, height: 440 };
export const COUNTS = {
  24: [6, 4],
  48: [8, 6],
  96: [12, 8],
  150: [15, 10],
  300: [20, 15],
};
export function random(seed) {
  let n = seed >>> 0;
  return () => {
    n += 0x6d2b79f5;
    let t = Math.imul(n ^ (n >>> 15), 1 | n);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function makePieces(count, seed = 1234) {
  const [cols, rows] = COUNTS[count];
  const rand = random(seed);
  const pieces = Array.from({ length: count }, (_, id) => {
    const col = id % cols,
      row = Math.floor(id / cols);
    return {
      id,
      col,
      row,
      edges: [
        0,
        col === cols - 1 ? 0 : rand() > 0.5 ? 1 : -1,
        row === rows - 1 ? 0 : rand() > 0.5 ? 1 : -1,
        0,
      ],
      x: 0,
      y: 0,
      placed: false,
    };
  });
  for (const p of pieces) {
    p.edges[0] = p.row ? -pieces[p.id - cols].edges[2] : 0;
    p.edges[3] = p.col ? -pieces[p.id - 1].edges[1] : 0;
  }
  return scatterPieces(pieces, count, seed + 1);
}
export function scatterPieces(pieces, count, seed) {
  const rand = random(seed);
  const [cols, rows] = COUNTS[count];
  const w = BOARD.width / cols,
    h = BOARD.height / rows;
  const loose = pieces.filter((p) => !p.placed).map((p) => p.id);
  for (let i = loose.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [loose[i], loose[j]] = [loose[j], loose[i]];
  }
  const perSide = Math.ceil(loose.length / 2),
    trayCols = Math.max(2, Math.floor(300 / (w * 1.18))),
    trayRows = Math.ceil(perSide / trayCols);
  const positions = new Map(
    loose.map((id, i) => {
      const side = i >= perSide ? 1 : 0,
        index = i % perSide;
      return [
        id,
        {
          x:
            (side ? 1110 : 48) +
            ((index % trayCols) * (280 - w)) / Math.max(1, trayCols - 1),
          y:
            100 +
            Math.floor(index / trayCols) *
              Math.min(h * 1.35, (760 - h) / Math.max(1, trayRows - 1)),
        },
      ];
    }),
  );
  return pieces.map((p) => (p.placed ? p : { ...p, ...positions.get(p.id) }));
}
export function targetFor(piece, count) {
  const [cols, rows] = COUNTS[count];
  return {
    x: BOARD.x + (piece.col * BOARD.width) / cols,
    y: BOARD.y + (piece.row * BOARD.height) / rows,
  };
}
export function piecePath(piece, count) {
  const [cols, rows] = COUNTS[count],
    w = BOARD.width / cols,
    h = BOARD.height / rows,
    bump = Math.min(w, h) * 0.23;
  const points = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
    [0, 0],
  ];
  let path = "M 0 0";
  for (let i = 0; i < 4; i++) {
    const a = points[i],
      b = points[i + 1],
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      len = Math.hypot(dx, dy),
      sign = piece.edges[i];
    const at = (t, v = 0) =>
      `${a[0] + dx * t + (dy / len) * v} ${a[1] + dy * t - (dx / len) * v}`;
    if (!sign) {
      path += ` L ${at(1)}`;
      continue;
    }
    const v = bump * sign;
    path += ` L ${at(0.35)} C ${at(0.44)} ${at(0.39, v * 0.25)} ${at(0.39, v * 0.65)} C ${at(0.39, v * 1.3)} ${at(0.61, v * 1.3)} ${at(0.61, v * 0.65)} C ${at(0.61, v * 0.25)} ${at(0.56)} ${at(0.65)} L ${at(1)}`;
  }
  return path + " Z";
}
