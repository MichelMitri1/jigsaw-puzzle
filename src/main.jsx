import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  ArrowLeft,
  Upload,
  Plus,
  X,
  Check,
  Copy,
  Link,
  Users,
  Puzzle,
  Image as ImageIcon,
  Shuffle,
  ZoomIn,
  ZoomOut,
  Maximize,
  HelpCircle,
  Sparkles,
  Heart,
  MousePointer2,
  Clock,
  LoaderCircle,
} from "lucide-react";
import { BOARD, TABLE, COUNTS, piecePath } from "../shared/puzzle.js";
import "./styles.css";
const GALLERY = [
  {
    id: "coast",
    title: "The slow life",
    place: "CINQUE TERRE, ITALY",
    tag: "A little getaway",
    color: "#e8efe7",
  },
  {
    id: "mountains",
    title: "Into the quiet",
    place: "THE GREAT OUTDOORS",
    tag: "Fresh perspective",
    color: "#e9ecef",
  },
  {
    id: "flowers",
    title: "A softer kind of day",
    place: "IN FULL BLOOM",
    tag: "Small joys",
    color: "#f3e6df",
  },
  {
    id: "city",
    title: "Meet me in Paris",
    place: "PARIS, FRANCE",
    tag: "City daydreams",
    color: "#eee8dc",
  },
];
function readLocal(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
function Logo({ onClick }) {
  return (
    <button className="logo" onClick={onClick} aria-label="Puzzlefolk home">
      <span className="logo-icon">
        <Puzzle size={23} strokeWidth={1.7} />
      </span>
      puzzlefolk<span className="logo-dot">.</span>
    </button>
  );
}
function Modal({ children, onClose, title, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.focus();
    const handler = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const elements = [
          ...ref.current.querySelectorAll(
            'button:not(:disabled), input:not(:disabled), a[href], select, [tabindex="0"]',
          ),
        ];
        const first = elements[0],
          last = elements.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = overflow;
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "wide" : ""}`}
      >
        <button
          className="icon-button modal-close"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={21} />
        </button>
        {children}
      </section>
    </div>
  );
}
function Help({ onClose }) {
  return (
    <Modal onClose={onClose} title="How to play">
      <span className="eyebrow">A MOMENT TO UNWIND</span>
      <h2>One piece at a time.</h2>
      <div className="help-step">
        <span>01</span>
        <div>
          <h3>Make it yours</h3>
          <p>
            Upload a favorite photo or choose from the gallery. Pick 24 to 300
            pieces to set your pace.
          </p>
        </div>
      </div>
      <div className="help-step">
        <span>02</span>
        <div>
          <h3>Bring someone along</h3>
          <p>
            Copy your invitation link and send it to a friend. You’ll share the
            same table, live.
          </p>
        </div>
      </div>
      <div className="help-step">
        <span>03</span>
        <div>
          <h3>Find your fit</h3>
          <p>
            Drag pieces onto the outline in the center. They snap when they’re
            close to their spot. Try the edges first!
          </p>
        </div>
      </div>
      <p className="help-note">
        Keyboard: Tab to a piece, Enter to pick it up, arrows to move (Shift for
        smaller steps), Enter to drop, Escape to cancel. Your progress saves
        automatically.
      </p>
      <button className="button primary full" onClick={onClose}>
        Sounds lovely <ArrowRight size={17} />
      </button>
    </Modal>
  );
}
function CreatePuzzle({ sample, onClose, onCreated }) {
  const [selected, setSelected] = useState(sample),
    [upload, setUpload] = useState(null),
    [title, setTitle] = useState(sample?.title || ""),
    [count, setCount] = useState(48),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [drag, setDrag] = useState(false);
  const input = useRef(null);
  const acceptFile = async (file) => {
    if (!file) return;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Please choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Please choose an image under 10 MB.");
      return;
    }
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setUpload(data);
      setSelected(null);
      setTitle(
        file.name
          .replace(/\.[^.]+$/, "")
          .replace(/[-_]/g, " ")
          .slice(0, 80),
      );
    } catch {
      setError("This image could not be read. Please try another.");
    }
  };
  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count,
          title,
          sample: selected?.id,
          image: upload,
        }),
      });
      const result = await res.json().catch(() => {
        throw new Error(
          "Couldn’t reach your puzzle table. Please try again in a moment.",
        );
      });
      if (!res.ok) throw new Error(result.error);
      onCreated(result);
    } catch (e) {
      setError(e.message || "Couldn’t create your puzzle. Please try again.");
      setBusy(false);
    }
  };
  return (
    <Modal onClose={() => !busy && onClose()} title="Create a puzzle" wide>
      <span className="eyebrow">YOUR PHOTO. YOUR LITTLE ESCAPE.</span>
      <h2>Make something come together.</h2>
      <p className="modal-subtitle">
        A favorite memory makes a pretty great puzzle.
      </p>
      <form onSubmit={create}>
        <div className="create-grid">
          <div>
            <input
              type="file"
              ref={input}
              hidden
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => acceptFile(e.target.files[0])}
            />
            <button
              type="button"
              className={`upload-zone ${drag ? "drag-over" : ""} ${upload || selected ? "has-image" : ""}`}
              onClick={() => input.current.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                acceptFile(e.dataTransfer.files[0]);
              }}
            >
              {upload || selected ? (
                <>
                  <img
                    src={upload || `/images/${selected.id}.jpg`}
                    alt="Your puzzle preview"
                  />
                  <span className="replace-image">
                    <Upload size={15} /> Change photo
                  </span>
                </>
              ) : (
                <>
                  <span className="upload-icon">
                    <Upload size={27} />
                  </span>
                  <strong>Drop a photo here</strong>
                  <span>or click to find your favorite</span>
                  <small>JPG, PNG, WebP · up to 10 MB</small>
                </>
              )}
            </button>
            <p className="crop-note">
              Your image is cropped to a landscape frame.
            </p>
          </div>
          <div className="create-options">
            <label className="field-label" htmlFor="puzzle-title">
              Give it a name
            </label>
            <input
              id="puzzle-title"
              className="text-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="Our little puzzle"
            />
            <label className="field-label">How many pieces?</label>
            <div className="count-options">
              {Object.keys(COUNTS).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={count === +n ? "selected" : ""}
                  onClick={() => setCount(+n)}
                >
                  <strong>{n}</strong>
                  <span>
                    {n === "24"
                      ? "A quick pause"
                      : n === "48"
                        ? "Take it easy"
                        : n === "96"
                          ? "Settle in"
                          : n === "150"
                            ? "Stay a while"
                            : "A real challenge"}
                  </span>
                  {count === +n && <Check size={14} />}
                </button>
              ))}
            </div>
            <div className="small-note">
              <Users size={17} />
              <span>
                Made for one. Even better together.
                <br />
                Invite friends after creating your puzzle.
              </span>
            </div>
          </div>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="button primary full"
          disabled={busy || (!upload && !selected)}
        >
          {busy ? (
            <>
              <LoaderCircle className="spin" size={18} /> Preparing your pieces…
            </>
          ) : (
            <>
              Let’s make a puzzle <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>
    </Modal>
  );
}
function Home({ onCreate, navigate, onHelp }) {
  const recent = readLocal("puzzlefolk-recent", []);
  return (
    <div className="home">
      <header className="site-header">
        <Logo onClick={() => navigate("/")} />
        <nav>
          <button
            className="nav-link"
            onClick={() =>
              document
                .getElementById("gallery")
                .scrollIntoView({ behavior: "smooth" })
            }
          >
            Explore puzzles
          </button>
          <button className="nav-link" onClick={onHelp}>
            How it works
          </button>
          <span className="nav-divider" />
          <button
            className="button small outline"
            onClick={() => onCreate(null)}
          >
            <Plus size={17} /> Create a puzzle
          </button>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="hero-label">
              <span /> A LITTLE TIME, TOGETHER
            </div>
            <h1>
              Life’s better
              <br />
              piece by{" "}
              <span>
                piece
                <svg viewBox="0 0 240 15">
                  <path d="M3 10 Q100 -2 236 7" />
                </svg>
              </span>
              .
            </h1>
            <p>
              Turn your favorite photos into a little escape.
              <br className="desktop-break" /> Make a puzzle, invite your
              people, and find your fit.
            </p>
            <button
              className="button primary hero-cta"
              onClick={() => onCreate(null)}
            >
              <Plus size={19} /> Create your puzzle <ArrowRight size={18} />
            </button>
            <div className="hero-meta">
              <span>
                <Check size={14} /> Free to play
              </span>
              <span>
                <Check size={14} /> No sign-up
              </span>
              <span>
                <Check size={14} /> Better together
              </span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="decor-star">✳</div>
            <div className="photo-underlay" />
            <div className="hero-photo">
              <img
                src="/images/coast.jpg"
                alt="Colorful Italian seaside village overlooking turquoise water"
              />
              <svg
                className="hero-puzzle-lines"
                viewBox="0 0 600 400"
                preserveAspectRatio="none"
              >
                <path d="M150 0V72c-25-12-25 32 0 20v108h-65c12-25-32-25-20 0H0 M150 200v76c25-12 25 32 0 20v104 M300 0v67c25-12 25 32 0 20v113h-61c12 25-32 25-20 0h-69 M300 200v74c-25-12-25 32 0 20v106 M450 0v72c-25-12-25 32 0 20v108h-63c12-25-32-25-20 0h-67 M450 200v71c25-12 25 32 0 20v109 M450 200h63c-12 25 32 25 20 0h67" />
              </svg>
              <div className="photo-caption">
                <span>Somewhere we’d rather be.</span>
                <span>01 / ∞</span>
              </div>
            </div>
            <div className="floating-note">
              <span className="note-icon">
                <Users size={21} />
              </span>
              <div>
                <strong>A shared little escape</strong>
                <span>You, your people, one puzzle.</span>
              </div>
              <span className="note-dot" />
            </div>
            <div className="handwritten">
              Good things come together.
              <svg viewBox="0 0 90 45">
                <path d="M3 3 Q7 42 76 30 M66 22l13 7-11 10" />
              </svg>
            </div>
          </div>
        </section>
        <div className="little-manifesto">
          <span>
            <ImageIcon size={17} /> Your photos, in a whole new way
          </span>
          <i />
          <span>
            <Link size={17} /> One link brings everyone to the table
          </span>
          <i />
          <span>
            <Heart size={17} /> No rush. Just one more piece.
          </span>
        </div>
        {recent.length > 0 && (
          <section className="recent-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">RIGHT WHERE YOU LEFT OFF</span>
                <h2>Your puzzle table</h2>
              </div>
              <span className="muted">Saved as you go</span>
            </div>
            <div className="recent-list">
              {recent.slice(0, 3).map((r) => (
                <button
                  key={r.id}
                  className="recent-card"
                  onClick={() => navigate(`/p/${r.id}`)}
                >
                  <img src={r.imageUrl} alt="" />
                  <span>
                    <strong>{r.title}</strong>
                    <small>{r.count} pieces · Continue puzzle</small>
                  </span>
                  <ArrowRight size={18} />
                </button>
              ))}
            </div>
          </section>
        )}
        <section className="gallery-section" id="gallery">
          <div className="section-heading">
            <div>
              <span className="eyebrow">A GOOD PLACE TO START</span>
              <h2>Find your next little escape.</h2>
              <p>No photo in mind? There’s a whole world to piece together.</p>
            </div>
            <span className="collection-label">
              <Sparkles size={15} /> The everyday collection
            </span>
          </div>
          <div className="gallery-grid">
            {GALLERY.map((item, i) => (
              <button
                className="gallery-card"
                key={item.id}
                onClick={() => onCreate(item)}
              >
                <div className="gallery-image">
                  <img
                    src={`/images/${item.id}.jpg`}
                    alt={item.title}
                    loading="lazy"
                  />
                  <span className="gallery-tag">{item.tag}</span>
                  <span className="gallery-play">
                    <ArrowRight size={21} />
                  </span>
                </div>
                <div className="gallery-details">
                  <span className="gallery-place">{item.place}</span>
                  <div>
                    <h3>{item.title}</h3>
                    <span className="card-puzzle">
                      <Puzzle size={17} />
                    </span>
                  </div>
                  <p>
                    Choose your pace <span>24 – 300 pieces</span>
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
        <section className="bottom-banner">
          <div className="banner-symbol">
            <Puzzle size={31} strokeWidth={1.3} />
            <Heart size={16} />
          </div>
          <div>
            <h3>A little less scrolling. A little more connecting.</h3>
            <p>Pull up a chair. There’s always room for one more.</p>
          </div>
          <button className="text-button" onClick={() => onCreate(null)}>
            Make a memory <ArrowRight size={17} />
          </button>
        </section>
      </main>
      <footer>
        <Logo onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} />
        <span>Small pieces. Good company.</span>
        <span>
          Made for the joy of it <Heart size={13} />
        </span>
      </footer>
    </div>
  );
}
function Invite({ onClose, name, setName }) {
  const [copied, setCopied] = useState(false),
    [failed, setFailed] = useState(false);
  const url = location.href;
  const field = useRef(null);
  return (
    <Modal title="Invite a friend" onClose={onClose}>
      <div className="dialog-symbol">
        <Users size={28} />
      </div>
      <h2>Better with your people.</h2>
      <p className="modal-subtitle">
        Send this link to a friend. They’ll pull up a chair at your puzzle
        table, with every piece in sync.
      </p>
      <label htmlFor="your-name" className="field-label">
        Your name at the table
      </label>
      <input
        id="your-name"
        className="text-input"
        maxLength={24}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Puzzle pal"
      />
      <label htmlFor="invite-link" className="field-label">
        Your invitation link
      </label>
      <div className="copy-field">
        <input
          id="invite-link"
          ref={field}
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
        />
        <button
          className="button primary small"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
            } catch {
              field.current.focus();
              field.current.select();
              setFailed(true);
            }
          }}
        >
          {copied ? <Check size={17} /> : <Copy size={17} />}{" "}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <p className="small-note">
        {failed
          ? "Link selected. Copy it with Ctrl+C or ⌘C."
          : "Anyone with this link can join. Up to 12 puzzle pals."}
      </p>
    </Modal>
  );
}
function PuzzleRoom({ id, navigate, onHelp }) {
  const [room, setRoom] = useState(null),
    [error, setError] = useState(""),
    [connected, setConnected] = useState(false),
    [players, setPlayers] = useState([]),
    [playerId, setPlayerId] = useState(""),
    [locks, setLocks] = useState({}),
    [cursors, setCursors] = useState({}),
    [invite, setInvite] = useState(false),
    [name, setName] = useState(() =>
      readLocal("puzzlefolk-name", "Puzzle pal"),
    ),
    [reference, setReference] = useState(true),
    [ghost, setGhost] = useState(false),
    [edgesOnly, setEdgesOnly] = useState(false),
    [zoom, setZoom] = useState(1),
    [active, setActive] = useState(null),
    [finishedDismissed, setFinishedDismissed] = useState(false),
    [elapsed, setElapsed] = useState(0),
    [notice, setNotice] = useState("");
  const socket = useRef(null),
    svg = useRef(null),
    drag = useRef(null),
    pan = useRef(null),
    roomRef = useRef(null),
    viewport = useRef(null),
    soundRef = useRef(null),
    [sound, setSound] = useState(false);
  roomRef.current = room;
  useEffect(() => {
    if (viewport.current)
      viewport.current.scrollLeft =
        (viewport.current.scrollWidth - viewport.current.clientWidth) / 2;
  }, [room?.id]);
  const send = (msg) => {
    if (socket.current?.readyState === 1)
      socket.current.send(JSON.stringify(msg));
  };
  const updatePiece = (p) =>
    setRoom((prev) =>
      prev
        ? {
            ...prev,
            pieces: prev.pieces.map((piece) =>
              piece.id === p.id ? { ...piece, ...p } : piece,
            ),
          }
        : prev,
    );
  const remember = (value) => {
    const recent = readLocal("puzzlefolk-recent", []).filter(
      (r) => r.id !== value.id,
    );
    writeLocal(
      "puzzlefolk-recent",
      [
        {
          id: value.id,
          title: value.title,
          count: value.count,
          imageUrl: value.imageUrl,
        },
        ...recent,
      ].slice(0, 8),
    );
  };
  useEffect(() => {
    let disposed = false,
      retry,
      attempts = 0;
    setRoom(null);
    setError("");
    async function connect() {
      try {
        const response = await fetch(`/api/rooms/${id}`);
        const result = await response.json();
        if (!response.ok) {
          if (!disposed) setError(result.error);
          return;
        }
        if (disposed) return;
        setRoom(result);
        remember(result);
        const ws = new WebSocket(
          `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws?room=${id}&name=${encodeURIComponent(readLocal("puzzlefolk-name", "Puzzle pal"))}`,
        );
        socket.current = ws;
        ws.onopen = () => {
          if (disposed) return ws.close();
          setConnected(true);
          attempts = 0;
        };
        ws.onmessage = (e) => {
          if (disposed) return;
          const msg = JSON.parse(e.data);
          if (msg.type === "init") {
            setRoom(msg.room);
            setPlayerId(msg.playerId);
            setLocks(
              Object.fromEntries(msg.locks.map((l) => [l.pieceId, l.playerId])),
            );
          }
          if (msg.type === "state") {
            setRoom(msg.room);
            setLocks({});
          }
          if (msg.type === "presence") {
            setPlayers(msg.players);
            setCursors((prev) =>
              Object.fromEntries(
                Object.entries(prev).filter(([key]) =>
                  msg.players.some((p) => p.id === key),
                ),
              ),
            );
          }
          if (msg.type === "cursor")
            setCursors((prev) => ({
              ...prev,
              [msg.playerId]: { x: msg.x, y: msg.y, time: Date.now() },
            }));
          if (msg.type === "lock")
            setLocks((prev) => ({ ...prev, [msg.pieceId]: msg.playerId }));
          if (msg.type === "moving")
            updatePiece({ id: msg.pieceId, x: msg.x, y: msg.y });
          if (msg.type === "denied") {
            if (drag.current?.id === msg.piece.id) {
              drag.current = null;
              setActive(null);
              setNotice("A friend is moving that piece. Try another.");
            }
            updatePiece(msg.piece);
          }
          if (msg.type === "piece") {
            const wasPlaced = roomRef.current?.pieces[msg.piece.id]?.placed;
            updatePiece(msg.piece);
            setLocks((prev) => {
              const next = { ...prev };
              delete next[msg.piece.id];
              return next;
            });
            if (msg.completedAt)
              setRoom((prev) => ({ ...prev, completedAt: msg.completedAt }));
            if (msg.piece.placed && !wasPlaced) {
              setNotice("A perfect fit.");
              playSnap();
            }
          }
        };
        ws.onclose = (event) => {
          if (disposed) return;
          setConnected(false);
          drag.current = null;
          setActive(null);
          setLocks({});
          if (event.code === 1008) {
            setError(event.reason);
            return;
          }
          retry = setTimeout(connect, Math.min(1000 * 2 ** attempts++, 10000));
        };
        ws.onerror = () => ws.close();
      } catch {
        if (!disposed) {
          setConnected(false);
          setNotice("Reconnecting to your table…");
          retry = setTimeout(connect, 3000);
        }
      }
    }
    connect();
    return () => {
      disposed = true;
      clearTimeout(retry);
      socket.current?.close();
    };
  }, [id]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (room)
        setElapsed(
          Math.max(
            0,
            Math.floor(
              ((room.completedAt || Date.now()) - room.createdAt) / 1000,
            ),
          ),
        );
    }, 1000);
    return () => clearInterval(timer);
  }, [room?.createdAt, room?.completedAt]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2800);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (drag.current?.keyboard && active !== null)
      svg.current?.querySelector(`[data-piece-id="${active}"]`)?.focus();
  }, [active]);
  useEffect(
    () => () => {
      soundRef.current?.close();
    },
    [],
  );
  function playSnap() {
    const ctx = soundRef.current;
    if (!ctx || ctx.state !== "running") return;
    const osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(640, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(960, ctx.currentTime + 0.09);
    gain.gain.setValueAtTime(0.045, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }
  function point(e) {
    const p = svg.current.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    return p.matrixTransform(svg.current.getScreenCTM().inverse());
  }
  function grab(e, p) {
    e.stopPropagation();
    if (
      drag.current ||
      !connected ||
      p.placed ||
      (locks[p.id] && locks[p.id] !== playerId) ||
      (e.button !== undefined && e.button !== 0)
    )
      return;
    e.preventDefault();
    const at = point(e);
    svg.current.setPointerCapture(e.pointerId);
    drag.current = {
      id: p.id,
      offsetX: at.x - p.x,
      offsetY: at.y - p.y,
      x: p.x,
      y: p.y,
      originalX: p.x,
      originalY: p.y,
    };
    setActive(p.id);
    send({ type: "grab", pieceId: p.id });
  }
  function move(e) {
    if (pan.current) {
      viewport.current.scrollLeft =
        pan.current.left - (e.clientX - pan.current.x);
      viewport.current.scrollTop =
        pan.current.top - (e.clientY - pan.current.y);
      return;
    }
    const at = point(e);
    send({ type: "cursor", x: at.x, y: at.y });
    const d = drag.current;
    if (!d || d.keyboard) return;
    const [cols, rows] = COUNTS[room.count];
    const x = Math.max(
        10,
        Math.min(TABLE.width - BOARD.width / cols - 10, at.x - d.offsetX),
      ),
      y = Math.max(
        10,
        Math.min(TABLE.height - BOARD.height / rows - 10, at.y - d.offsetY),
      );
    Object.assign(d, { x, y });
    updatePiece({ id: d.id, x, y });
    send({ type: "move", pieceId: d.id, x, y });
  }
  function drop() {
    pan.current = null;
    const d = drag.current;
    if (!d) return;
    send({ type: "drop", pieceId: d.id, x: d.x, y: d.y });
    drag.current = null;
    setActive(null);
  }
  function cancel() {
    pan.current = null;
    const d = drag.current;
    if (!d) return;
    updatePiece({ id: d.id, x: d.originalX, y: d.originalY });
    send({ type: "cancel", pieceId: d.id });
    drag.current = null;
    setActive(null);
  }
  function keyPiece(e, p) {
    if (!connected || p.placed) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (drag.current?.id === p.id) drop();
      else if (!drag.current && !locks[p.id]) {
        drag.current = {
          id: p.id,
          x: p.x,
          y: p.y,
          originalX: p.x,
          originalY: p.y,
          keyboard: true,
        };
        setActive(p.id);
        send({ type: "grab", pieceId: p.id });
      }
    }
    if (e.key === "Escape") cancel();
    if (
      drag.current?.id === p.id &&
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
    ) {
      e.preventDefault();
      const d = drag.current,
        step = e.shiftKey ? 3 : 15;
      d.x = Math.max(
        10,
        Math.min(
          1400,
          d.x +
            (e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0),
        ),
      );
      d.y = Math.max(
        10,
        Math.min(
          920,
          d.y +
            (e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0),
        ),
      );
      updatePiece({ id: p.id, x: d.x, y: d.y });
      send({ type: "move", pieceId: p.id, x: d.x, y: d.y });
    }
  }
  const updateName = (value) => {
    setName(value);
    writeLocal("puzzlefolk-name", value);
  };
  if (error)
    return (
      <div className="room-error">
        <Puzzle size={46} />
        <h2>A little piece is missing.</h2>
        <p>{error}</p>
        <button className="button primary" onClick={() => navigate("/")}>
          Back to home
        </button>
      </div>
    );
  if (!room)
    return (
      <div className="room-error">
        <LoaderCircle size={34} className="spin" />
        <h2>Setting your table…</h2>
        <p>{notice || "Finding all the little pieces."}</p>
        <button className="text-button" onClick={() => navigate("/")}>
          Back to home
        </button>
      </div>
    );
  const placed = room.pieces.filter((p) => p.placed).length,
    percent = Math.round((placed / room.count) * 100),
    sorted = [...room.pieces].sort(
      (a, b) =>
        (a.id === active ? 2 : a.placed ? 0 : 1) -
        (b.id === active ? 2 : b.placed ? 0 : 1),
    );
  return (
    <div className="game">
      <header className="game-header">
        <button
          className="icon-button"
          onClick={() => navigate("/")}
          aria-label="Back to home"
        >
          <ArrowLeft size={20} />
        </button>
        <Logo onClick={() => navigate("/")} />
        <div className="game-title">
          <h1>{room.title}</h1>
          <span>
            {room.count} pieces <span>·</span> A little time, together
          </span>
        </div>
        <div className="game-people">
          {players.slice(0, 4).map((p) => (
            <span
              key={p.id}
              title={p.name + (p.id === playerId ? " (you)" : "")}
              style={{ background: p.color }}
            >
              {p.name.slice(0, 1).toUpperCase()}
            </span>
          ))}
        </div>
        <button
          className="button primary small"
          onClick={() => setInvite(true)}
        >
          <Users size={17} />
          <span>Invite a friend</span>
        </button>
      </header>
      <div className="game-layout">
        <aside className="game-sidebar">
          <span className="eyebrow">ON YOUR TABLE</span>
          <div className="reference-heading">
            <h3>The big picture</h3>
            <button
              className="text-button"
              onClick={() => setReference(!reference)}
            >
              {reference ? "Hide" : "Show"}
            </button>
          </div>
          {reference && (
            <img
              className="reference-photo"
              src={room.imageUrl}
              alt="Completed puzzle reference"
            />
          )}
          <div className="progress-label">
            <strong>{percent}% together</strong>
            <span>
              {placed} / {room.count}
            </span>
          </div>
          <div className="progress-track">
            <div style={{ width: `${percent}%` }} />
          </div>
          <div className="save-label">
            <span className={connected ? "online-dot" : "offline-dot"} />
            {connected
              ? "Connected · progress saved"
              : "Reconnecting · please wait"}
          </div>
          <hr />
          <span className="eyebrow">MAKE YOURSELF AT HOME</span>
          <button
            className={`setting-row ${edgesOnly ? "enabled" : ""}`}
            onClick={() => setEdgesOnly(!edgesOnly)}
          >
            <Puzzle size={17} />
            <span>Edge pieces only</span>
            <span
              className={`toggle ${edgesOnly ? "on" : ""}`}
              role="switch"
              aria-checked={edgesOnly}
            />
          </button>
          <button
            className={`setting-row ${ghost ? "enabled" : ""}`}
            onClick={() => setGhost(!ghost)}
          >
            <ImageIcon size={17} />
            <span>Picture guide</span>
            <span
              className={`toggle ${ghost ? "on" : ""}`}
              role="switch"
              aria-checked={ghost}
            />
          </button>
          <button
            className="setting-row"
            disabled={
              !connected || !!Object.keys(locks).length || placed === room.count
            }
            onClick={() => {
              send({ type: "shuffle" });
              setNotice("A fresh perspective.");
            }}
          >
            <Shuffle size={17} />
            <span>Shuffle loose pieces</span>
          </button>
          <button
            className="setting-row"
            onClick={() => {
              if (!sound) {
                const AudioCtx =
                  window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                  soundRef.current ||= new AudioCtx();
                  soundRef.current.resume();
                }
              } else soundRef.current?.suspend();
              setSound(!sound);
            }}
          >
            <Sparkles size={17} />
            <span>Little snap sounds</span>
            <span
              className={`toggle ${sound ? "on" : ""}`}
              role="switch"
              aria-checked={sound}
            />
          </button>
          <div className="sidebar-bottom">
            <div className="gentle-note">
              <Heart size={18} />
              <p>
                No rush.
                <br />
                You’re right where you need to be.
              </p>
            </div>
            <button className="text-button" onClick={onHelp}>
              <HelpCircle size={16} /> A little help
            </button>
          </div>
        </aside>
        <section className="table-area">
          <div className="table-topline">
            <span>
              <span className={connected ? "online-dot" : "offline-dot"} />
              {players.length > 1
                ? `${players.length} people, one puzzle`
                : "Your little corner of calm"}
            </span>
            <span>
              <Clock size={14} />
              {Math.floor(elapsed / 3600) > 0
                ? `${Math.floor(elapsed / 3600)}:`
                : ""}
              {String(Math.floor(elapsed / 60) % 60).padStart(2, "0")}:
              {String(elapsed % 60).padStart(2, "0")}
            </span>
          </div>
          <div className="table-viewport" ref={viewport}>
            <svg
              ref={svg}
              className="puzzle-table"
              style={{
                width: `${zoom * 100}%`,
                height: `${zoom * 100}%`,
                minWidth: 650 * zoom,
              }}
              viewBox={`0 0 ${TABLE.width} ${TABLE.height}`}
              onPointerDown={(e) => {
                if (drag.current || e.button !== 0) return;
                pan.current = {
                  x: e.clientX,
                  y: e.clientY,
                  left: viewport.current.scrollLeft,
                  top: viewport.current.scrollTop,
                };
                svg.current.setPointerCapture(e.pointerId);
              }}
              onPointerMove={move}
              onPointerUp={drop}
              onPointerCancel={cancel}
              aria-label="Jigsaw puzzle table"
            >
              <defs>
                <filter
                  id="piece-shadow"
                  x="-30%"
                  y="-30%"
                  width="160%"
                  height="160%"
                >
                  <feDropShadow
                    dx="0"
                    dy="2"
                    stdDeviation="2"
                    floodColor="#463f30"
                    floodOpacity=".2"
                  />
                </filter>
                {room.pieces.map((p) => (
                  <clipPath key={p.id} id={`clip-${p.id}`}>
                    <path d={piecePath(p, room.count)} />
                  </clipPath>
                ))}
              </defs>
              <rect
                x={BOARD.x - 9}
                y={BOARD.y - 9}
                width={BOARD.width + 18}
                height={BOARD.height + 18}
                rx="4"
                fill="#e4e1d7"
              />
              <rect
                x={BOARD.x}
                y={BOARD.y}
                width={BOARD.width}
                height={BOARD.height}
                fill="#f7f5ed"
                stroke="#c7c4b8"
                strokeWidth="1.5"
              />
              {ghost && (
                <image
                  href={room.imageUrl}
                  x={BOARD.x}
                  y={BOARD.y}
                  width={BOARD.width}
                  height={BOARD.height}
                  preserveAspectRatio="xMidYMid slice"
                  opacity=".22"
                />
              )}
              {!placed && !ghost && (
                <g
                  className="board-message"
                  fill="#a7aa9b"
                  textAnchor="middle"
                  pointerEvents="none"
                >
                  <Puzzle
                    x="693"
                    y="423"
                    width="54"
                    height="54"
                    strokeWidth="1"
                  />
                  <text
                    x="720"
                    y="508"
                    fontSize="18"
                    fontFamily="Georgia, serif"
                  >
                    Good things take a little time.
                  </text>
                  <text x="720" y="537" fontSize="12" letterSpacing="1.6">
                    START WITH ONE PIECE
                  </text>
                </g>
              )}
              {sorted.map((p) => {
                const dimmed = edgesOnly && !p.edges.includes(0) && !p.placed;
                const owner = locks[p.id],
                  lockedOther = owner && owner !== playerId;
                return (
                  <g
                    key={p.id}
                    data-piece-id={p.id}
                    transform={`translate(${p.x} ${p.y})`}
                    className={`puzzle-piece ${p.placed ? "placed" : ""} ${p.id === active ? "active" : ""} ${lockedOther ? "locked" : ""}`}
                    opacity={dimmed ? 0.12 : 1}
                    style={{ pointerEvents: dimmed ? "none" : undefined }}
                    tabIndex={p.placed || dimmed ? -1 : 0}
                    role="button"
                    aria-label={`Piece ${p.id + 1}${p.edges.includes(0) ? ", edge piece" : ""}${p.placed ? ", placed" : ""}`}
                    aria-disabled={p.placed || lockedOther || !connected}
                    onPointerDown={(e) => grab(e, p)}
                    onKeyDown={(e) => keyPiece(e, p)}
                    filter={!p.placed ? "url(#piece-shadow)" : undefined}
                  >
                    <path d={piecePath(p, room.count)} fill="#fff" />
                    <g clipPath={`url(#clip-${p.id})`}>
                      <image
                        href={room.imageUrl}
                        x={(-p.col * BOARD.width) / COUNTS[room.count][0]}
                        y={(-p.row * BOARD.height) / COUNTS[room.count][1]}
                        width={BOARD.width}
                        height={BOARD.height}
                        preserveAspectRatio="xMidYMid slice"
                      />
                    </g>
                    <path
                      className="piece-outline"
                      d={piecePath(p, room.count)}
                      fill="none"
                      stroke={
                        lockedOther
                          ? players.find((pl) => pl.id === owner)?.color ||
                            "#de7751"
                          : "#fffaf2"
                      }
                      strokeOpacity={p.placed ? 0.25 : 0.75}
                      strokeWidth={lockedOther ? 3 : 1.2}
                    />
                  </g>
                );
              })}
              {Object.entries(cursors).map(([key, cursor]) => {
                const p = players.find((pl) => pl.id === key);
                return p && Date.now() - cursor.time < 5000 ? (
                  <g
                    key={key}
                    transform={`translate(${cursor.x} ${cursor.y})`}
                    pointerEvents="none"
                  >
                    <path
                      d="M0 0L5 19L10 12L18 9Z"
                      fill={p.color}
                      stroke="white"
                      strokeWidth="1.5"
                    />
                    <rect
                      x="13"
                      y="15"
                      width={p.name.length * 7 + 16}
                      height="25"
                      rx="6"
                      fill={p.color}
                    />
                    <text x="21" y="32" fill="white" fontSize="12">
                      {p.name}
                    </text>
                  </g>
                ) : null;
              })}
            </svg>
          </div>
          <div className="table-bottomline">
            <span>
              <MousePointer2 size={15} />
              <span className="desktop-table-tip">
                Drag a piece. Find its place. Enjoy the little click.
              </span>
              <span className="mobile-table-tip">
                Drag pieces to fit. Drag empty space to pan.
              </span>
            </span>
            <div className="zoom-controls">
              <button
                onClick={() => setZoom((v) => Math.max(0.5, v - 0.25))}
                disabled={zoom <= 0.5}
                aria-label="Zoom out"
              >
                <ZoomOut size={17} />
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom((v) => Math.min(2.5, v + 0.25))}
                disabled={zoom >= 2.5}
                aria-label="Zoom in"
              >
                <ZoomIn size={17} />
              </button>
              <i />
              <button
                onClick={() => {
                  setZoom(1);
                  requestAnimationFrame(() =>
                    viewport.current?.scrollTo({
                      left:
                        (viewport.current.scrollWidth -
                          viewport.current.clientWidth) /
                        2,
                      top: 0,
                    }),
                  );
                }}
                aria-label="Reset view"
              >
                <Maximize size={17} />
              </button>
            </div>
          </div>
        </section>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
      {invite && (
        <Invite
          name={name}
          setName={updateName}
          onClose={() => {
            setInvite(false);
            send({ type: "name", name });
          }}
        />
      )}
      {placed === room.count && !finishedDismissed && (
        <Modal
          onClose={() => setFinishedDismissed(true)}
          title="Puzzle completed"
        >
          <div className="completion-art">
            <Sparkles size={29} />
            <Puzzle size={62} strokeWidth={1} />
            <Heart size={23} />
          </div>
          <span className="eyebrow">EVERY LITTLE PIECE BELONGS</span>
          <h2>Look what came together.</h2>
          <p className="modal-subtitle">
            {room.count} pieces. A little patience. Something lovely.
            <br />
            {players.length > 1
              ? "Made even better by doing it together."
              : "A little moment, just for you."}
          </p>
          <img
            className="completion-photo"
            src={room.imageUrl}
            alt="Your completed puzzle"
          />
          <button className="button primary full" onClick={() => navigate("/")}>
            Find your next puzzle <ArrowRight size={18} />
          </button>
          <button
            className="text-button completion-back"
            onClick={() => setFinishedDismissed(true)}
          >
            Stay and enjoy the view
          </button>
        </Modal>
      )}
    </div>
  );
}
function App() {
  const [route, setRoute] = useState(location.pathname),
    [create, setCreate] = useState(false),
    [sample, setSample] = useState(null),
    [help, setHelp] = useState(false);
  useEffect(() => {
    const listener = () => {
      setRoute(location.pathname);
      setCreate(false);
      setHelp(false);
    };
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, []);
  const navigate = (url) => {
    history.pushState({}, "", url);
    setRoute(url);
    setCreate(false);
    window.scrollTo(0, 0);
  };
  const match = route.match(/^\/p\/([a-f0-9]{24})\/?$/);
  return (
    <>
      {match ? (
        <PuzzleRoom
          key={match[1]}
          id={match[1]}
          navigate={navigate}
          onHelp={() => setHelp(true)}
        />
      ) : route === "/" ? (
        <Home
          navigate={navigate}
          onCreate={(sample) => {
            setSample(sample);
            setCreate(true);
          }}
          onHelp={() => setHelp(true)}
        />
      ) : (
        <div className="room-error">
          <h2>This piece doesn’t fit.</h2>
          <p>That page doesn’t exist. Let’s get you back to the table.</p>
          <button className="button primary" onClick={() => navigate("/")}>
            Back to home
          </button>
        </div>
      )}
      {create && (
        <CreatePuzzle
          sample={sample}
          onClose={() => setCreate(false)}
          onCreated={(room) => navigate(`/p/${room.id}`)}
        />
      )}
      {help && <Help onClose={() => setHelp(false)} />}
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
