import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* Firebase config — same project as admin */
const firebaseConfig = {
  apiKey: "AIzaSyBRZaHEyInL-aezQy4_Y9w8SDWPIGG-baE",
  authDomain: "wordsteady-prod.firebaseapp.com",
  projectId: "wordsteady-prod",
  storageBucket: "wordsteady-prod.firebasestorage.app",
  messagingSenderId: "376102396808",
  appId: "1:376102396808:web:8996283f6f2fb0cdd5d03d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ──────────────────────────────
   Utilities
   ────────────────────────────── */
function todayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shuffleWord(word) {
  const arr = String(word || "").toUpperCase().split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

/* ──────────────────────────────
   Demo fallback (used if Firestore has no word yet)
   ────────────────────────────── */
const DEMO_FALLBACK = {
  word: "exactly",
  level: "B2",
  puzzle: { type: "scramble", value: "YCLEAXT" },
  meaning: {
    question: "Which meaning best matches this word?",
    options: [
      { t: "completely correct or precise", ok: true },
      { t: "slowly and carefully", ok: false },
      { t: "almost, but not quite", ok: false },
    ],
    explain: "“Exactly” emphasises precision or complete correctness.",
  },
  pronunciation: {
    question: "Which pronunciation is most correct?",
    options: [
      { t: "Option A (audio later)", ok: true },
      { t: "Option B (audio later)", ok: false },
      { t: "Option C (audio later)", ok: false },
    ],
    explain: "Audio will be added once we wire storage and UK/US variants.",
  },
  spelling: {
    question: "Which spelling is correct?",
    options: [
      { t: "exactly", ok: true },
      { t: "exactely", ok: false },
      { t: "exatly", ok: false },
      { t: "exactally", ok: false },
    ],
    explain: "Watch the ‘-act-’ in the middle: ex-ACT-ly.",
  },
};

/* ──────────────────────────────
   Load today from Firestore and map into demo structure
   ────────────────────────────── */
async function loadTodayDemo() {
  const key = todayKey();
  const ref = doc(db, "dailyWords", key);
  const snap = await getDoc(ref);

  if (!snap.exists()) return DEMO_FALLBACK;

  const d = snap.data() || {};

  const word = String(d.word || "").trim();
  if (!word) return DEMO_FALLBACK;

  // Allow optional content fields later; provide sensible defaults now
  const level = String(d.level || d.cefr || "B2").trim();

  // If you don’t store puzzle yet, we generate a scramble from the word.
  const puzzleValue = (d.puzzle && d.puzzle.value) ? String(d.puzzle.value) : shuffleWord(word);

  // If you don’t store MCQs yet, we generate placeholder MCQs that still work.
  const meaningExplain = String(d.meaningExplain || d.simpleDef || "").trim() || "Good. That matches the meaning.";
  const example = String(d.example || "").trim();

  // Optional: if you already store meaning/pron/spelling blocks as objects, use them.
  // Otherwise we create basic ones that keep the flow working.
  const meaning = d.meaning && d.meaning.question ? d.meaning : {
    question: "Which meaning best matches this word?",
    options: [
      { t: String(d.simpleDef || meaningExplain || "—"), ok: true },
      { t: "A different meaning (distractor)", ok: false },
      { t: "Another different meaning (distractor)", ok: false },
    ],
    explain: meaningExplain,
  };

  const pronunciation = d.pronunciation && d.pronunciation.question ? d.pronunciation : {
    question: "Pronunciation check (audio later)",
    options: [
      { t: "Option A (audio later)", ok: true },
      { t: "Option B (audio later)", ok: false },
      { t: "Option C (audio later)", ok: false },
    ],
    explain: "Audio will be added once we wire storage and UK/US variants.",
  };

  const spelling = d.spelling && d.spelling.question ? d.spelling : {
    question: "Which spelling is correct?",
    options: [
      { t: word.toLowerCase(), ok: true },
      { t: word.toLowerCase().replace("a", "e"), ok: false },
      { t: word.toLowerCase().slice(0, Math.max(1, word.length - 1)), ok: false },
      { t: word.toLowerCase() + "ly", ok: false },
    ],
    explain: "Focus on the exact letter order.",
  };

  return {
    word: word.toLowerCase(),
    level,
    puzzle: { type: "scramble", value: puzzleValue },
    meaning,
    pronunciation,
    spelling,
    // Optional: you can show example somewhere later; we keep it available.
    example
  };
}

/* ──────────────────────────────
   Your existing UI logic (unchanged, just uses loaded demo)
   ────────────────────────────── */
const levelBadge = document.getElementById("levelBadge");
const progressDots = document.getElementById("progressDots");
const stepHost = document.getElementById("stepHost");
const primaryBtn = document.getElementById("primaryBtn");

let steps = [];
let stepIndex = 0;
let selectedIndex = null;
let answered = false;

function renderDots() {
  progressDots.innerHTML = "";
  const visibleSteps = 4; // discover + 3 checks
  const onUntil = Math.min(stepIndex, visibleSteps - 1);

  for (let i = 0; i < visibleSteps; i++) {
    const dot = document.createElement("div");
    dot.className = "dot" + (i <= onUntil ? " on" : "");
    progressDots.appendChild(dot);
  }
}

function setPrimaryLabel() {
  const s = steps[stepIndex];
  if (s.kind === "mcq" && !answered) primaryBtn.textContent = "CHECK ANSWER";
  else if (s.kind === "done") primaryBtn.textContent = "BACK TO TODAY";
  else primaryBtn.textContent = "CONTINUE";
}

function render(demo) {
  renderDots();
  setPrimaryLabel();
  selectedIndex = null;
  answered = false;

  const s = steps[stepIndex];

  if (s.kind === "info") {
    stepHost.innerHTML = `
      <div class="word">${escapeHtml(demo.puzzle.value)}</div>
      <p class="small" style="text-align:center;margin:0;">
        This is today’s word. Take a moment to look at it.
      </p>
    `;
    return;
  }

  if (s.kind === "mcq") {
    const { question, options } = s.data;
    stepHost.innerHTML = `
      <div class="question">${escapeHtml(question)}</div>
      <div id="options"></div>
      <div id="feedback"></div>
    `;

    const optHost = document.getElementById("options");

    options.forEach((o, idx) => {
      const row = document.createElement("label");
      row.className = "option";
      row.innerHTML = `
        <input type="radio" name="opt" value="${idx}" />
        <div>${escapeHtml(o.t)}</div>
      `;
      row.addEventListener("click", () => {
        if (answered) return;
        selectedIndex = idx;
      });
      optHost.appendChild(row);
    });
    return;
  }

  if (s.kind === "done") {
    stepHost.innerHTML = `
      <div class="question">✓ Today’s word completed</div>
      <div class="divider"></div>
      <div class="word" style="letter-spacing:1px;">${escapeHtml(
        demo.word.toUpperCase()
      )}</div>
      <p class="small" style="text-align:center;margin:0;">
        Nice work. Come back tomorrow for a new word.
      </p>
    `;
  }
}

function showFeedback(ok, explain) {
  const fb = document.getElementById("feedback");
  if (!fb) return;

  fb.innerHTML = `
    <div class="feedback">
      <div style="font-weight:650;margin-bottom:6px;">
        ${ok ? "✓ That’s right." : "Not quite."}
      </div>
      <div class="small">${escapeHtml(explain)}</div>
    </div>
  `;
}

async function boot() {
  const demo = await loadTodayDemo();

  levelBadge.textContent = demo.level;

  steps = [
    { id: "discover", kind: "info" },
    { id: "meaning", kind: "mcq", data: demo.meaning },
    { id: "pron", kind: "mcq", data: demo.pronunciation },
    { id: "spelling", kind: "mcq", data: demo.spelling },
    { id: "done", kind: "done" },
  ];

  // initial render
  render(demo);

  primaryBtn.addEventListener("click", () => {
    const s = steps[stepIndex];

    if (s.kind === "done") {
      window.location.href = "./index.html";
      return;
    }

    if (s.kind === "mcq" && !answered) {
      if (selectedIndex === null) return;
      answered = true;
      const opt = s.data.options[selectedIndex];
      showFeedback(!!opt.ok, s.data.explain);
      setPrimaryLabel();
      return;
    }

    stepIndex = Math.min(stepIndex + 1, steps.length - 1);
    render(demo);
  });
}

boot().catch(err => {
  console.error(err);
  // If something goes wrong, at least render the fallback.
  const demo = DEMO_FALLBACK;
  levelBadge.textContent = demo.level;

  steps = [
    { id: "discover", kind: "info" },
    { id: "meaning", kind: "mcq", data: demo.meaning },
    { id: "pron", kind: "mcq", data: demo.pronunciation },
    { id: "spelling", kind: "mcq", data: demo.spelling },
    { id: "done", kind: "done" },
  ];

  render(demo);
});
