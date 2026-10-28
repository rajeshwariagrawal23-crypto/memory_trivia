// ---------- Card + trivia bank (add your own pairs!) ----------
const PAIRS = [
  { emoji: "🌐", q: "What does HTML stand for?", options: ["Hyper Text Markup Language", "High Tech Modern Language", "Hyper Transfer Markup Link", "Home Tool Markup Language"], answer: 0 },
  { emoji: "🎨", q: "Which CSS property changes the text colour?", options: ["font-color", "text-color", "color", "foreground"], answer: 2 },
  { emoji: "⚡", q: "Which keyword declares a block-scoped variable in JavaScript?", options: ["let", "int", "dim", "define"], answer: 0 },
  { emoji: "🐍", q: "Which symbol starts a single-line comment in Python?", options: ["//", "#", "--", "/*"], answer: 1 },
  { emoji: "🧠", q: "What does AI stand for?", options: ["Automated Input", "Artificial Intelligence", "Applied Internet", "Advanced Interface"], answer: 1 },
  { emoji: "💾", q: "How many bits are in one byte?", options: ["4", "8", "16", "32"], answer: 1 },
  { emoji: "🔒", q: "In HTTPS, what does the 'S' stand for?", options: ["Server", "Speed", "Secure", "Standard"], answer: 2 },
  { emoji: "🖥️", q: "Which part is called the 'brain' of a computer?", options: ["RAM", "CPU", "Monitor", "Keyboard"], answer: 1 },
  { emoji: "📡", q: "What does URL stand for?", options: ["Uniform Resource Locator", "Universal Radio Link", "Unified Router Layer", "User Request Language"], answer: 0 },
  { emoji: "🚀", q: "Which Git command uploads your commits to a remote repo?", options: ["git pull", "git commit", "git push", "git clone"], answer: 2 }
];

const LEVELS = {
  easy:   { pairs: 6,  time: 90 },
  medium: { pairs: 8,  time: 120 },
  hard:   { pairs: 10, time: 150 }
};
const POINTS = { match: 10, trivia: 20, bonusTime: 5, wrongPenalty: 5 };

// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);
const screens = { start: $("start"), game: $("game"), result: $("result") };
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
function show(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

// ---------- Sound (Web Audio, no files needed) ----------
let soundOn = true, audioCtx = null;
function beep(freq, dur = 0.12, type = "sine", delay = 0) {
  if (!soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    const t = audioCtx.currentTime + delay;
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t); o.stop(t + dur);
  } catch (e) { /* audio blocked – ignore */ }
}
const sfx = {
  flip:  () => beep(500, 0.07, "triangle"),
  match: () => { beep(660, 0.1, "sine"); beep(880, 0.15, "sine", 0.1); },
  miss:  () => beep(200, 0.2, "sawtooth"),
  right: () => { beep(523, 0.1); beep(659, 0.1, "sine", 0.1); beep(784, 0.2, "sine", 0.2); },
  wrong: () => { beep(250, 0.15, "square"); beep(180, 0.25, "square", 0.15); },
  win:   () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.2, "sine", i * 0.14)),
  lose:  () => [400, 330, 260, 200].forEach((f, i) => beep(f, 0.25, "sawtooth", i * 0.18))
};

// ---------- State ----------
let level = "easy", cfg, deck = [], first = null, second = null, lock = false;
let score = 0, moves = 0, matched = 0, triviaRight = 0, triviaTotal = 0;
let timeLeft = 0, timerId = null, paused = false;

// ---------- Game setup ----------
function startGame(lv) {
  level = lv; cfg = LEVELS[lv];
  const chosen = shuffle(PAIRS).slice(0, cfg.pairs);
  deck = shuffle([...chosen, ...chosen].map((p, i) => ({ ...p, uid: i })));
  first = second = null; lock = false; paused = false;
  score = moves = matched = triviaRight = triviaTotal = 0;
  timeLeft = cfg.time;

  const board = $("board");
  board.className = "board " + lv;
  board.innerHTML = "";
  deck.forEach((c, i) => {
    const el = document.createElement("div");
    el.className = "card";
    el.dataset.i = i;
    el.innerHTML = `<div class="face front">❔</div><div class="face back">${c.emoji}</div>`;
    el.addEventListener("click", () => flip(i, el));
    board.appendChild(el);
  });
  updateHud();
  show("game");
  clearInterval(timerId);
  timerId = setInterval(tick, 1000);
}

function updateHud() {
  $("time").textContent = timeLeft;
  $("time").classList.toggle("low", timeLeft <= 10);
  $("score").textContent = score;
  $("moves").textContent = moves;
  $("pairs").textContent = `${matched}/${cfg.pairs}`;
  const pct = Math.max(0, Math.min(100, (timeLeft / cfg.time) * 100));
  $("time-fill").style.width = pct + "%";
}

function tick() {
  if (paused) return;
  timeLeft--;
  updateHud();
  if (timeLeft <= 0) endGame(false);
}

// ---------- Flip logic ----------
function flip(i, el) {
  if (lock || paused || el.classList.contains("flipped") || el.classList.contains("matched")) return;
  sfx.flip();
  el.classList.add("flipped");
  if (!first) { first = { i, el }; return; }
  second = { i, el };
  moves++;
  lock = true;
  updateHud();

  if (deck[first.i].emoji === deck[second.i].emoji) {
    setTimeout(onMatch, 450);
  } else {
    sfx.miss();
    first.el.classList.add("shake"); second.el.classList.add("shake");
    setTimeout(() => {
      [first.el, second.el].forEach((c) => c.classList.remove("flipped", "shake"));
      first = second = null; lock = false;
    }, 800);
  }
}

function onMatch() {
  const pair = deck[first.i];
  [first.el, second.el].forEach((c) => c.classList.add("matched"));
  matched++;
  score += POINTS.match;
  sfx.match();
  updateHud();
  first = second = null;
  setTimeout(() => askTrivia(pair), 600);
}

// ---------- Trivia modal ----------
function askTrivia(pair) {
  paused = true; // freeze the clock while answering
  triviaTotal++;
  $("m-emoji").textContent = pair.emoji;
  $("m-question").textContent = pair.q;
  $("m-feedback").textContent = "";
  $("m-continue").classList.add("hidden");
  const box = $("m-options");
  box.innerHTML = "";

  pair.options.forEach((text, idx) => {
    const b = document.createElement("button");
    b.className = "opt";
    b.textContent = text;
    b.addEventListener("click", () => answer(idx, pair, box));
    box.appendChild(b);
  });
  $("modal").classList.remove("hidden");
}

function answer(idx, pair, box) {
  const btns = [...box.children];
  btns.forEach((b) => (b.disabled = true));
  btns[pair.answer].classList.add("correct");
  const fb = $("m-feedback");

  if (idx === pair.answer) {
    triviaRight++;
    score += POINTS.trivia;
    timeLeft += POINTS.bonusTime;
    fb.textContent = `✅ Correct! +${POINTS.trivia} points and +${POINTS.bonusTime}s`;
    sfx.right();
  } else {
    btns[idx].classList.add("wrong");
    score = Math.max(0, score - POINTS.wrongPenalty);
    fb.textContent = `❌ Not quite. −${POINTS.wrongPenalty} points`;
    sfx.wrong();
  }
  updateHud();
  $("m-continue").classList.remove("hidden");
}

function closeModal() {
  $("modal").classList.add("hidden");
  paused = false; lock = false;
  if (matched === cfg.pairs) endGame(true);
}

// ---------- End of game ----------
function endGame(won) {
  clearInterval(timerId);
  paused = true;
  if (won) score += timeLeft * 2; // time bonus

  const key = "mt-best-" + level;
  const prev = Number(localStorage.getItem(key) || 0);
  const isBest = won && score > prev;
  if (isBest) localStorage.setItem(key, score);

  const maxScore = cfg.pairs * (POINTS.match + POINTS.trivia);
  const ratio = score / maxScore;
  const stars = !won ? 0 : ratio >= 1.15 ? 3 : ratio >= 0.85 ? 2 : 1;

  $("res-emoji").textContent = won ? "🎉" : "⏰";
  $("res-title").textContent = won ? "You cleared the board!" : "Time's up!";
  $("res-score").textContent = score;
  $("res-moves").textContent = moves;
  $("res-trivia").textContent = `${triviaRight}/${triviaTotal}`;
  $("res-new").classList.toggle("hidden", !isBest);
  $("stars").innerHTML = [1, 2, 3].map((n) => `<span class="${n <= stars ? "on" : ""}" style="animation-delay:${n * 0.2}s">⭐</span>`).join("");
  loadBest();
  show("result");
  if (won) { sfx.win(); confetti(); } else sfx.lose();
}

function loadBest() {
  $("best").textContent = Math.max(0, ...Object.keys(LEVELS).map((k) => Number(localStorage.getItem("mt-best-" + k) || 0)));
}

// ---------- Confetti ----------
function confetti() {
  const cv = $("confetti"), ctx = cv.getContext("2d");
  cv.width = innerWidth; cv.height = innerHeight;
  const colors = ["#ff4d8d", "#7c5cff", "#fbbf24", "#22c55e", "#06b6d4"];
  const bits = Array.from({ length: 140 }, () => ({
    x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * 0.5,
    s: 5 + Math.random() * 7, v: 2 + Math.random() * 4, r: Math.random() * 6,
    c: colors[Math.floor(Math.random() * colors.length)], d: (Math.random() - 0.5) * 3
  }));
  let frames = 0;
  (function loop() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    bits.forEach((b) => {
      b.y += b.v; b.x += b.d; b.r += 0.15;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r);
      ctx.fillStyle = b.c; ctx.fillRect(-b.s / 2, -b.s / 2, b.s, b.s * 0.6); ctx.restore();
    });
    if (++frames < 240) requestAnimationFrame(loop);
    else ctx.clearRect(0, 0, cv.width, cv.height);
  })();
}

// ---------- Events ----------
document.querySelectorAll(".level").forEach((b) => b.addEventListener("click", () => startGame(b.dataset.level)));
$("m-continue").addEventListener("click", closeModal);
$("again").addEventListener("click", () => startGame(level));
$("menu").addEventListener("click", () => show("start"));
$("quit").addEventListener("click", () => { clearInterval(timerId); show("start"); });
$("sound-btn").addEventListener("click", (e) => {
  soundOn = !soundOn;
  e.target.textContent = soundOn ? "🔊 Sound on" : "🔇 Sound off";
});

loadBest();
