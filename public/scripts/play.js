/* play.js — WordSteady
   3-step daily session engine (content-loaded from JSON)
   - Content source: ./data/today.json (or ./data/words/YYYY-MM-DD.json via ?date=YYYY-MM-DD)
   - Persists session state to localStorage (keyed by local date + WORD)
*/

document.addEventListener("DOMContentLoaded", async () => {
  // ──────────────────────────────
  // Content loading (decoupled)
  // ──────────────────────────────
  function ymdLocal() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function getContentUrl() {
    const u = new URL(window.location.href);
    const date = u.searchParams.get("date");
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return `./data/words/${date}.json?v=${Date.now()}`;
    }
    return `./data/today.json?v=${Date.now()}`;
  }

  const FALLBACK_PACK = {
    meta: { id: `fallback-${ymdLocal()}`, minutes: 6 },
    word: { text: "STEADFAST", display: "Steadfast" },
    meaning: "firm and reliable in purpose, loyalty, or belief",
    example: "“She remained steadfast during the crisis.”",
    step3Target: 2,
    starters: [
      { text: "She remained steadfast when ", accepts: ["CLAUSE"], tense: "PAST" },
      { text: "I try to be steadfast when ", accepts: ["CLAUSE"], tense: "PRESENT" },
      { text: "He stayed steadfast despite ", accepts: ["GERUND"] },
      { text: "They were steadfast in their ", accepts: ["NOUN_PHRASE"] },
      { text: "A steadfast person will ", accepts: ["VP"] }
    ],
    finishes: [
      { text: "things get difficult.", form: "CLAUSE", tense: "PRESENT" },
      { text: "others change their minds.", form: "CLAUSE", tense: "PRESENT" },
      { text: "the pressure is intense.", form: "CLAUSE", tense: "PRESENT" },
      { text: "it matters most.", form: "CLAUSE", tense: "PRESENT" },
      { text: "it would be easier to quit.", form: "CLAUSE", tense: "PRESENT" },

      { text: "things got difficult.", form: "CLAUSE", tense: "PAST" },
      { text: "others changed their minds.", form: "CLAUSE", tense: "PAST" },
      { text: "the pressure was intense.", form: "CLAUSE", tense: "PAST" },
      { text: "it mattered most.", form: "CLAUSE", tense: "PAST" },
      { text: "it would have been easier to quit.", form: "CLAUSE", tense: "PAST" },

      { text: "things getting difficult.", form: "GERUND" },
      { text: "the pressure increasing.", form: "GERUND" },
      { text: "the criticism growing louder.", form: "GERUND" },

      { text: "beliefs.", form: "NOUN_PHRASE" },
      { text: "commitment.", form: "NOUN_PHRASE" },
      { text: "principles.", form: "NOUN_PHRASE" },

      { text: "keep going.", form: "VP" },
      { text: "stand firm.", form: "VP" },
      { text: "follow through.", form: "VP" },
      { text: "remain calm under pressure.", form: "VP" }
    ]
  };

  async function loadPack() {
    try {
      const res = await fetch(getContentUrl(), { cache: "no-store" });
      if (!res.ok) throw new Error("bad status");
      const json = await res.json();
      return json;
    } catch {
      return FALLBACK_PACK;
    }
  }

  const pack = await loadPack();

  // Basic validation + normalization (contract for the engine)
  const WORD = String(pack?.word?.text || "").trim().toUpperCase();
  const DISPLAY =
    String(pack?.word?.display || "").trim() ||
    (WORD ? (WORD[0] + WORD.slice(1).toLowerCase()) : "Word");
  const MEANING = String(pack?.meaning || "").trim() || "—";
  const EXAMPLE = String(pack?.example || "").trim() || "—";
  const STEP3_TARGET = Math.max(1, Number(pack?.step3Target || 2));
  const STARTERS = Array.isArray(pack?.starters) ? pack.starters : [];
  const FINISHES = Array.isArray(pack?.finishes) ? pack.finishes : [];

  // ──────────────────────────────
  // DOM
  // ──────────────────────────────
  const wordTitle = document.getElementById("wordTitle");
  const wordMeaning = document.getElementById("wordMeaning");
  const wordExample = document.getElementById("wordExample");
  const sessionEyebrow = document.getElementById("sessionEyebrow");
  const reveal = document.getElementById("reveal");

  // Step 2 elements
  const buildArea = document.getElementById("buildArea");
  const step2LockOverlay = document.getElementById("step2LockOverlay");
  const bank = document.getElementById("bank");
  const slots = document.getElementById("slots");
  const feedback = document.getElementById("feedback");
  const reset = document.getElementById("reset");
  const startOver = document.getElementById("startOver");
  const step2DoneLine = document.getElementById("step2DoneLine");

  // Step 3 elements
  const ws3 = document.getElementById("ws3");
  const ws3LockedNote = document.getElementById("ws3LockedNote");
  const ws3Starters = document.getElementById("ws3Starters");
  const ws3Finishes = document.getElementById("ws3Finishes");
  const ws3ResultBox = document.getElementById("ws3ResultBox");
  const ws3ResultText = document.getElementById("ws3ResultText");
  const ws3Confirm = document.getElementById("ws3Confirm");
  const ws3Challenge = document.getElementById("ws3Challenge");
  const ws3Score = document.getElementById("ws3Score");
  const wsSaved = document.getElementById("wsSaved");
  const ws3WorkArea = document.getElementById("ws3WorkArea");
  const ws3DonePanel = document.getElementById("ws3DonePanel");

  const doneBtn = document.getElementById("doneBtn");

  // Render header content
  wordTitle.textContent = DISPLAY || "Word";
  wordMeaning.textContent = MEANING;
  wordExample.textContent = EXAMPLE;
  sessionEyebrow.textContent = `Today’s session • ~${Number(pack?.meta?.minutes || 6)} minutes`;

  // If pack is malformed, keep the page usable but don’t crash
  if (!WORD || !STARTERS.length || !FINISHES.length) {
    reveal.textContent = "CONTENT ERROR";
    reveal.disabled = true;
    return;
  }

  reveal.textContent = WORD;
  reveal.disabled = false;

  // ──────────────────────────────
  // Daily session persistence (keyed by date+word)
  // ──────────────────────────────
  const SESSION_KEY = `ws-play-${ymdLocal()}-${WORD}`;

  function saveState(state) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(state)); } catch {}
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function clearState() {
    try { localStorage.removeItem(SESSION_KEY); } catch {}
  }

  // ──────────────────────────────
  // UI helpers
  // ──────────────────────────────
  function setDoneEnabled(enabled) {
    doneBtn.setAttribute("aria-disabled", enabled ? "false" : "true");
  }

  function setSavedMessage(msg) {
    wsSaved.textContent = msg || "";
  }

  function showStep2Overlay(on) {
    if (!step2LockOverlay) return;
    step2LockOverlay.style.display = on ? "flex" : "none";
  }

  let savedTimer = null;
  function pulseSaved() {
    setSavedMessage("Saved");
    if (savedTimer) clearTimeout(savedTimer);
    savedTimer = setTimeout(() => setSavedMessage(""), 1200);
  }

  // ──────────────────────────────
  // Session state
  // ──────────────────────────────
  let started = false;
  let step2Done = false;

  // Step 3 completion
  let step3Correct = 0;
  let step3Done = false;

  // Challenge mode scoring
  let attempts = 0;
  let correct = 0;

  // Currently displayed finishes (includes distractors in challenge mode)
  let displayedFinishes = [];

  let starterPick = null;
  let finishPick = null;

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function updateScoreUI() {
    const prog = `Progress: ${step3Correct} / ${STEP3_TARGET}`;
    if (ws3Challenge.checked) {
      ws3Score.textContent = `${prog} • Score: ${correct} / ${attempts}`;
    } else {
      ws3Score.textContent = prog;
    }
  }

  function currentBuilt() {
    return [...slots.children].map(s => s.textContent).join("");
  }

  function allSlotsFilled() {
    return [...slots.children].every(s => s.textContent && s.textContent.length === 1);
  }

  function snapshot() {
    const slotLetters = [...slots.children].map(s => (s.textContent || ""));
    const bankLetters = [...bank.children].map(t => (t.textContent || ""));

    saveState({
      started,
      step2Done,
      revealDisabled: reveal.disabled,
      buildAreaVisible: true, // build area is always visible now
      slotLetters,
      bankLetters,
      feedbackText: feedback.textContent || "",
      feedbackOk: feedback.classList.contains("ok"),

      challenge: Boolean(ws3Challenge.checked),
      step3Correct,
      step3Done,
      attempts,
      correct
    });

    pulseSaved();
  }

  function showStep2DoneUI(on) {
    step2DoneLine.style.display = on ? "block" : "none";
    bank.style.display = on ? "none" : "flex";
  }

  function showStep3DoneUI(on) {
    ws3DonePanel.style.display = on ? "block" : "none";
    ws3WorkArea.style.display = on ? "none" : "block";
    ws3Challenge.disabled = on;
  }

  // ─────────────
  // Step 2 helpers
  // ─────────────
  function clearStep2UI() {
    slots.innerHTML = "";
    bank.innerHTML = "";
    feedback.textContent = "";
    feedback.classList.remove("ok");
    showStep2DoneUI(false);
  }

  function buildSlots(slotLetters) {
    slots.innerHTML = "";
    for (let i = 0; i < WORD.length; i++) {
      const s = document.createElement("div");
      s.className = "slot";
      s.textContent = (slotLetters && slotLetters[i]) ? slotLetters[i] : "";
      slots.appendChild(s);
    }
  }

  // Validate step2Done from actual slots
  function validateStep2DoneFromSlots() {
    const built = currentBuilt();
    if (built === WORD) {
      step2Done = true;
      feedback.textContent = "Correct. You’ve built the word.";
      feedback.classList.add("ok");
      showStep2DoneUI(true);
    } else {
      step2Done = false;
      feedback.classList.remove("ok");
      showStep2DoneUI(false);
      if ((feedback.textContent || "").toLowerCase().includes("built the word")) {
        feedback.textContent = "";
      }
    }
  }

  // ─────────────
  // Step 3 helpers
  // ─────────────
  function resetStep3Progress() {
    step3Correct = 0;
    step3Done = false;
    attempts = 0;
    correct = 0;
    showStep3DoneUI(false);
    updateScoreUI();
  }

  function renderChoices(container, items, getPressed, onPick, disabled) {
    container.innerHTML = "";
    items.forEach((item, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = item.text;
      b.setAttribute("aria-pressed", getPressed(idx) ? "true" : "false");
      b.disabled = Boolean(disabled);
      b.addEventListener("click", () => {
        if (b.disabled) return;
        onPick(idx);
      });
      container.appendChild(b);
    });
  }

  function lockStep3() {
    ws3.style.display = "none";
    ws3LockedNote.style.display = "block";
    ws3LockedNote.textContent = "Complete Step 2 to unlock Step 3.";
    resetStep3Progress();
    starterPick = null;
    finishPick = null;
    ws3Confirm.textContent = "";
    ws3ResultBox.style.display = "none";
    ws3ResultText.textContent = "";
    displayedFinishes = [];
    setDoneEnabled(false);
    updateStep3UI();
    snapshot();
  }

  function unlockStep3() {
    ws3LockedNote.style.display = "none";
    ws3.style.display = "block";
    updateScoreUI();
    updateStep3UI();
    snapshot();
  }

  function isCompatible(starterObj, finishObj) {
    const accepts = Array.isArray(starterObj.accepts) ? starterObj.accepts : [];
    if (!accepts.includes(finishObj.form)) return false;

    if (finishObj.form === "CLAUSE") {
      const stTense = starterObj.tense || null;
      const fnTense = finishObj.tense || null;
      return Boolean(stTense && fnTense && stTense === fnTense);
    }
    return true;
  }

  function getCompatibleFinishesForStarter(starterObj) {
    return FINISHES.filter(f => isCompatible(starterObj, f));
  }

  function uniqueByText(list) {
    const seen = new Set();
    const out = [];
    for (const x of list) {
      if (!x || !x.text) continue;
      const key = x.text.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(x);
    }
    return out;
  }

  function buildDistractors(starterObj, correctList) {
    const distractors = [];
    const accepts = Array.isArray(starterObj.accepts) ? starterObj.accepts : [];

    // Wrong tense distractor (CLAUSE only)
    if (accepts.includes("CLAUSE")) {
      const stTense = starterObj.tense;
      const opposite = (stTense === "PAST") ? "PRESENT" : (stTense === "PRESENT" ? "PAST" : null);
      if (opposite) {
        const wrongTensePool = FINISHES.filter(f => f.form === "CLAUSE" && f.tense === opposite);
        if (wrongTensePool.length) {
          const pick = wrongTensePool[Math.floor(Math.random() * wrongTensePool.length)];
          distractors.push({ ...pick, _isCorrect: false, _why: "TENSE" });
        }
      }
    }

    // Wrong form distractor
    const forms = ["CLAUSE", "GERUND", "NOUN_PHRASE", "VP"];
    const wrongForms = forms.filter(fr => !accepts.includes(fr));
    if (wrongForms.length) {
      const targetForm = wrongForms[Math.floor(Math.random() * wrongForms.length)];
      const wrongFormPool = FINISHES.filter(f => f.form === targetForm);
      if (wrongFormPool.length) {
        const pick = wrongFormPool[Math.floor(Math.random() * wrongFormPool.length)];
        distractors.push({ ...pick, _isCorrect: false, _why: "FORM" });
      }
    }

    const correctTexts = new Set(correctList.map(x => x.text.trim().toLowerCase()));
    return distractors.filter(d => !correctTexts.has(d.text.trim().toLowerCase()));
  }

  function hintForWrong(starterObj, pickedObj) {
    const accepts = Array.isArray(starterObj.accepts) ? starterObj.accepts : [];
    if (pickedObj._why === "TENSE" && accepts.includes("CLAUSE")) {
      if (starterObj.tense === "PRESENT") {
        return "Not quite — for habits with “when”, use present tense (e.g., “when things get…”).";
      }
      if (starterObj.tense === "PAST") {
        return "Not quite — this starter is past tense, so the “when” clause should be past (e.g., “when things got…”).";
      }
      return "Not quite — check the tense in the “when” clause.";
    }

    if (pickedObj._why === "FORM") {
      if (accepts.includes("GERUND")) return "Not quite — after “despite”, use an -ing form (e.g., “despite things getting…”).";
      if (accepts.includes("NOUN_PHRASE")) return "Not quite — after “in their”, use a noun phrase (e.g., “in their principles”).";
      if (accepts.includes("VP")) return "Not quite — after “will”, use a verb phrase (e.g., “will stand firm”).";
      if (accepts.includes("CLAUSE")) return "Not quite — after “when”, use a full clause (a subject + verb).";
      return "Not quite — check the grammar pattern for this starter.";
    }

    return "Not quite — try a finish that matches the grammar pattern.";
  }

  function markStep3Done() {
    step3Done = true;
    ws3Confirm.textContent = "✅ Step 3 complete — you used the word correctly twice.";
    showStep3DoneUI(true);
    setDoneEnabled(true);
    updateScoreUI();
    snapshot();
  }

  function updateStep3UI() {
    const disableAll = step3Done;

    // Starters
    renderChoices(
      ws3Starters,
      STARTERS,
      (i) => starterPick === i,
      (i) => {
        starterPick = i;
        finishPick = null;
        ws3Confirm.textContent = step3Done ? "✅ Step 3 complete — you used the word correctly twice." : "";
        ws3ResultBox.style.display = "none";
        ws3ResultText.textContent = "";
        updateStep3UI();
        snapshot();
      },
      disableAll
    );

    const starterObj = (starterPick === null) ? null : STARTERS[starterPick];
    const correctList = starterObj ? getCompatibleFinishesForStarter(starterObj) : [];
    const challengeOn = Boolean(ws3Challenge.checked);

    let listForDisplay = [];
    if (!starterObj) {
      listForDisplay = [];
    } else if (!challengeOn) {
      listForDisplay = correctList.map(x => ({ ...x, _isCorrect: true }));
    } else {
      const distractors = buildDistractors(starterObj, correctList);
      listForDisplay = [
        ...correctList.map(x => ({ ...x, _isCorrect: true })),
        ...distractors
      ];
    }

    listForDisplay = uniqueByText(listForDisplay);
    displayedFinishes = shuffle(listForDisplay.slice());

    // Finishes
    renderChoices(
      ws3Finishes,
      displayedFinishes,
      (i) => finishPick === i,
      (i) => {
        if (starterPick === null) return;
        if (step3Done) return;

        const s = STARTERS[starterPick];
        const picked = displayedFinishes[i];
        if (!picked) return;

        if (ws3Challenge.checked) {
          attempts += 1;
          if (picked._isCorrect) correct += 1;
        }

        if (!picked._isCorrect) {
          finishPick = null;
          ws3ResultBox.style.display = "none";
          ws3ResultText.textContent = "";
          ws3Confirm.textContent = hintForWrong(s, picked);
          updateScoreUI();
          updateStep3UI();
          snapshot();
          return;
        }

        step3Correct += 1;
        updateScoreUI();

        finishPick = i;
        ws3ResultText.textContent = s.text + picked.text;
        ws3ResultBox.style.display = "block";

        if (step3Correct >= STEP3_TARGET) {
          markStep3Done();
        } else {
          ws3Confirm.textContent = ws3Challenge.checked ? "Correct ✅" : "Nice. This sentence is grammatically correct.";
          snapshot();
        }

        updateStep3UI();
      },
      disableAll
    );
  }

  // ─────────────
  // Step 2 gameplay
  // ─────────────
  function renderBankFromLetters(letters) {
    bank.innerHTML = "";
    letters.forEach((letter) => {
      const t = document.createElement("div");
      t.className = "tile";
      t.textContent = letter;

      t.addEventListener("click", () => {
        if (!started) return;
        if (step2Done) return;

        const empty = [...slots.children].find(s => !s.textContent);
        if (!empty) return;

        empty.textContent = letter;
        t.remove();
        snapshot();

        if (!allSlotsFilled()) return;

        const built = currentBuilt();
        if (built === WORD) {
          step2Done = true;
          feedback.textContent = "Correct. You’ve built the word.";
          feedback.classList.add("ok");
          showStep2DoneUI(true);
          unlockStep3();
          snapshot();
        } else {
          feedback.textContent = "Not quite. Reset and try again.";
          lockStep3();
          snapshot();
        }
      });

      bank.appendChild(t);
    });

    if (!step2Done && bank.children.length === 0) {
      renderBankFromLetters(shuffle(WORD.split("")));
    }
  }

  function buildTilesRandom() {
    renderBankFromLetters(shuffle(WORD.split("")));
  }

  function enterBuildState() {
    started = true;
    step2Done = false;
    reveal.disabled = true;

    // NEW: unlock the Step 2 area visually
    showStep2Overlay(false);

    lockStep3();
    clearStep2UI();
    buildSlots();
    buildTilesRandom();
    snapshot();
  }

  function doReset() {
    if (!started) return;
    step2Done = false;

    lockStep3();
    clearStep2UI();
    buildSlots();
    buildTilesRandom();
    snapshot();
  }

  function doStartOver() {
    started = false;
    step2Done = false;

    reveal.disabled = false;

    // NEW: relock Step 2 visually
    showStep2Overlay(true);

    lockStep3();
    clearStep2UI();
    setDoneEnabled(false);
    showStep3DoneUI(false);
    setSavedMessage("");
    clearState();
  }

  // ─────────────
  // Restore / Init
  // ─────────────
  setDoneEnabled(false);
  showStep3DoneUI(false);
  updateScoreUI();

  const saved = loadState();
  if (saved) {
    started = Boolean(saved.started);
    step2Done = Boolean(saved.step2Done);

    ws3Challenge.checked = Boolean(saved.challenge);
    step3Correct = Number(saved.step3Correct || 0);
    step3Done = Boolean(saved.step3Done);
    attempts = Number(saved.attempts || 0);
    correct = Number(saved.correct || 0);

    reveal.disabled = Boolean(saved.revealDisabled);

    const slotLetters = Array.isArray(saved.slotLetters) ? saved.slotLetters : null;
    const bankLetters = Array.isArray(saved.bankLetters) ? saved.bankLetters : null;

    if (started) {
      showStep2Overlay(false);
      buildSlots(slotLetters);
      renderBankFromLetters(bankLetters && bankLetters.length ? bankLetters : shuffle(WORD.split("")));
      feedback.textContent = saved.feedbackText || "";
      if (saved.feedbackOk) feedback.classList.add("ok");
    } else {
      showStep2Overlay(true);
      clearStep2UI();
      buildSlots();
    }

    // reconcile step2Done with actual slots
    validateStep2DoneFromSlots();

    updateScoreUI();

    if (step2Done) {
      ws3.style.display = "block";
      ws3LockedNote.style.display = "none";
      updateStep3UI();
    } else {
      lockStep3();
    }

    if (step3Done) showStep3DoneUI(true);
    setDoneEnabled(step3Done);

    setSavedMessage("Saved earlier");
    if (savedTimer) clearTimeout(savedTimer);
    savedTimer = setTimeout(() => setSavedMessage(""), 1200);
  } else {
    // Fresh load (not started yet)
    showStep2Overlay(true);
    reveal.disabled = false;

    clearStep2UI();
    buildSlots();
    lockStep3();
  }

  // Events
  reveal.addEventListener("click", () => {
    if (started) return;
    enterBuildState();
  });

  reset.addEventListener("click", doReset);
  startOver.addEventListener("click", doStartOver);

  ws3Challenge.addEventListener("change", () => {
    if (step3Done) return;
    ws3Confirm.textContent = "";
    ws3ResultBox.style.display = "none";
    ws3ResultText.textContent = "";
    finishPick = null;
    updateScoreUI();
    updateStep3UI();
    snapshot();
  });
});
