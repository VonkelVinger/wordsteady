const demo = {
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

const levelBadge = document.getElementById("levelBadge");
const progressDots = document.getElementById("progressDots");
const stepHost = document.getElementById("stepHost");
const primaryBtn = document.getElementById("primaryBtn");

levelBadge.textContent = demo.level;

const steps = [
  { id: "discover", kind: "info" },
  { id: "meaning", kind: "mcq", data: demo.meaning },
  { id: "pron", kind: "mcq", data: demo.pronunciation },
  { id: "spelling", kind: "mcq", data: demo.spelling },
  { id: "done", kind: "done" },
];

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

function render() {
  renderDots();
  setPrimaryLabel();
  selectedIndex = null;
  answered = false;

  const s = steps[stepIndex];

  if (s.kind === "info") {
    stepHost.innerHTML = `
      <div class="word">${demo.puzzle.value}</div>
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
  render();
});

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

render();
