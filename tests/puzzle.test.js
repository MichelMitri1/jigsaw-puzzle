import test from "node:test";
import assert from "node:assert/strict";
import {
  BOARD,
  TABLE,
  COUNTS,
  makePieces,
  scatterPieces,
  targetFor,
  piecePath,
} from "../shared/puzzle.js";
for (const count of Object.keys(COUNTS).map(Number)) {
  test(`${count} pieces have matching seams and stay on the table`, () => {
    const pieces = makePieces(count, 42),
      [cols, rows] = COUNTS[count];
    assert.equal(pieces.length, count);
    for (const p of pieces) {
      if (p.row) assert.equal(p.edges[0], -pieces[p.id - cols].edges[2]);
      else assert.equal(p.edges[0], 0);
      if (p.col) assert.equal(p.edges[3], -pieces[p.id - 1].edges[1]);
      else assert.equal(p.edges[3], 0);
      assert.ok(p.x >= 0 && p.x + BOARD.width / cols < TABLE.width);
      assert.ok(p.y >= 0 && p.y + BOARD.height / rows < TABLE.height);
      assert.ok(piecePath(p, count).endsWith("Z"));
    }
    const lastTarget = targetFor(pieces.at(-1), count);
    assert.ok(
      Math.abs(lastTarget.x + BOARD.width / cols - BOARD.x - BOARD.width) <
        0.00001,
    );
    assert.ok(
      Math.abs(lastTarget.y + BOARD.height / rows - BOARD.y - BOARD.height) <
        0.00001,
    );
  });
}
test("shuffling preserves placed pieces and changes loose positions", () => {
  const pieces = makePieces(24, 42);
  Object.assign(pieces[0], targetFor(pieces[0], 24), { placed: true });
  const shuffled = scatterPieces(pieces, 24, 88);
  assert.deepEqual(shuffled[0], pieces[0]);
  assert.ok(
    shuffled.some(
      (p, i) => !p.placed && (p.x !== pieces[i].x || p.y !== pieces[i].y),
    ),
  );
});
