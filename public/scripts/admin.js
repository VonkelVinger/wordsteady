// wordsteady/public/scripts/admin.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  query,
  collection,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/**
 * 1) PASTE FIREBASE CONFIG HERE
 * Copy/paste from Firebase Console → Project settings → General → Your apps → Web app → Config
 */
const firebaseConfig = {
  apiKey: "PASTE",
  authDomain: "PASTE",
  projectId: "PASTE",
  storageBucket: "PASTE",
  messagingSenderId: "PASTE",
  appId: "PASTE"
};

/**
 * 2) OPTIONAL: restrict publishing to specific admin UIDs
 * If this array is empty, any signed-in user passes the UI gate (Firestore rules must still protect writes).
 */
const ADMIN_UIDS = [
  // "UID1",
  // "UID2"
];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const els = {
  authBadge: document.getElementById("authBadge"),
  authNote: document.getElementById("authNote"),
  btnSignIn: document.getElementById("btnSignIn"),
  btnSignOut: document.getElementById("btnSignOut"),
  btnRunChecks: document.getElementById("btnRunChecks"),
  btnPublish: document.getElementById("btnPublish"),
  status: document.getElementById("status"),

  date: document.getElementById("date"),
  word: document.getElementById("word"),
  pos: document.getElementById("pos"),
  simpleDef: document.getElementById("simpleDef"),
  preciseDef: document.getElementById("preciseDef"),
  example: document.getElementById("example"),
  memoryHook: document.getElementById("memoryHook"),
  tags: document.getElementById("tags"),
  sourceName: document.getElementById("sourceName"),
  sourceUrl: document.getElementById("sourceUrl"),

  checklist: document.getElementById("checklist")
};

let lastChecks = {
  ran: false,
  ok: false,
  problems: [],
  dateExists: false,
  wordExists: false,
  wordKey: ""
};

const CHECKS = [
  {
    id: "c_no_quotes",
    title: "No copied text from the source",
    detail: "Definitions and example sentence are written independently (no quotes/excerpts)."
  },
  {
    id: "c_not_random",
    title: "Chosen from reputable real-world English",
    detail: "Word was encountered in reputable journalism and is useful beyond trivia."
  },
  {
    id: "c_clear_definition",
    title: "Plain meaning is clear",
    detail: "A learner can explain the word after reading the plain definition once."
  },
  {
    id: "c_example_original",
    title: "Example sentence is original and natural",
    detail: "Sentence shows realistic usage and is not a paraphrase of the article."
  },
  {
    id: "c_memory_hook",
    title: "Retention is supported",
    detail: "There is a hook (contrast, spelling tip, confusion warning) or the word is inherently memorable."
  },
  {
    id: "c_quality_control",
    title: "Checked for common pitfalls",
    detail: "Spelling, part of speech, and meaning match standard usage."
  },
  {
    id: "c_not_used_before",
    title: "Confirmed: word has not been used before",
    detail: "This is verified by Firestore check (and you still agree it’s not a repeat/variant)."
  }
];

function renderChecklist() {
  els.checklist.innerHTML = "";
  for (const item of CHECKS) {
    const row = document.createElement("label");
    row.className = "ws-check";
    row.innerHTML = `
      <input type="checkbox" id="${item.id}" />
      <div>
        <strong>${item.title}</strong>
        <span>${item.detail}</span>
      </div>
    `;
    els.checklist.appendChild(row);
  }
}

function setStatus(msg, isBad = false) {
  els.status.textContent = msg;
  els.status.style.color = isBad ? "#b42318" : "var(--muted)";
}

function normalizeWordKey(raw) {
  return (raw || "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z\-]/g, "")
    .replace(/\-+/g, "-")
    .replace(/^\-|\-$/g, "");
}

function getFormData() {
  const date = (els.date.value || "").trim();
  const word = (els.word.value || "").trim();

  const wordKey = normalizeWordKey(word);
  const tags = (els.tags.value || "")
    .split(",")
    .map(t => t.trim())
    .filter(Boolean);

  return {
    date,
    word,
    wordKey,
    pos: (els.pos.value || "").trim(),
    simpleDef: (els.simpleDef.value || "").trim(),
    preciseDef: (els.preciseDef.value || "").trim(),
    example: (els.example.value || "").trim(),
    memoryHook: (els.memoryHook.value || "").trim(),
    tags,
    sourceName: (els.sourceName.value || "").trim(),
    sourceUrl: (els.sourceUrl.value || "").trim()
  };
}

function isAdmin(user) {
  if (!user) return false;
  if (!ADMIN_UIDS.length) return true;
  return ADMIN_UIDS.includes(user.uid);
}

function checklistAllTicked() {
  return CHECKS.every(c => {
    const el = document.getElementById(c.id);
    return el && el.checked;
  });
}

async function checkDateExists(date) {
  const ref = doc(db, "dailyWords", date);
  const snap = await getDoc(ref);
  return snap.exists();
}

async function checkWordExists(wordKey) {
  if (!wordKey) return false;

  const idxRef = doc(db, "wordIndex", wordKey);
  const idxSnap = await getDoc(idxRef);
  if (idxSnap.exists()) return true;

  const q = query(collection(db, "dailyWords"), where("wordKey", "==", wordKey));
  const res = await getDocs(q);
  return !res.empty;
}

function validateRequiredFields(d) {
  const problems = [];
  if (!d.date) problems.push("Missing date.");
  if (!d.word) problems.push("Missing word.");
  if (!d.wordKey) problems.push("Word normalisation failed (wordKey empty).");
  if (!d.simpleDef) problems.push("Missing plain meaning.");
  if (!d.example) problems.push("Missing example sentence.");
  if (!d.sourceName) problems.push("Missing source publication name (used only for identification).");
  return problems;
}

async function runChecks() {
  const user = auth.currentUser;
  if (!user) {
    setStatus("Sign in first.", true);
    return;
  }
  if (!isAdmin(user)) {
    setStatus("Signed in, but not authorised as admin on this page.", true);
    return;
  }

  const d = getFormData();
  const problems = validateRequiredFields(d);

  let dateExists = false;
  let wordExists = false;

  if (!problems.length) {
    dateExists = await checkDateExists(d.date);
    if (dateExists) problems.push(`Date already exists: dailyWords/${d.date}`);

    wordExists = await checkWordExists(d.wordKey);
    if (wordExists) problems.push(`Word has been used before: "${d.word}" (wordKey: ${d.wordKey})`);
  }

  lastChecks = {
    ran: true,
    ok: problems.length === 0,
    problems,
    dateExists,
    wordExists,
    wordKey: d.wordKey
  };

  const notUsedBox = document.getElementById("c_not_used_before");
  if (notUsedBox) {
    notUsedBox.checked = !wordExists;
    notUsedBox.disabled = wordExists;
  }

  if (problems.length) {
    setStatus("Checks failed:\n• " + problems.join("\n• "), true);
    els.btnPublish.disabled = true;
    return;
  }

  setStatus("Checks passed. Tick the checklist and publish.");
  els.btnPublish.disabled = !(checklistAllTicked());
}

async function publish() {
  const user = auth.currentUser;
  if (!user) {
    setStatus("Sign in first.", true);
    return;
  }
  if (!isAdmin(user)) {
    setStatus("Signed in, but not authorised as admin on this page.", true);
    return;
  }

  if (!lastChecks.ran || !lastChecks.ok) {
    setStatus("Run checks first (and ensure they pass).", true);
    return;
  }

  if (!checklistAllTicked()) {
    setStatus("Checklist not complete. Tick all confirmations.", true);
    return;
  }

  const d = getFormData();

  const [dateExistsNow, wordExistsNow] = await Promise.all([
    checkDateExists(d.date),
    checkWordExists(d.wordKey)
  ]);

  if (dateExistsNow) {
    setStatus(`Publish blocked: date already exists (${d.date}).`, true);
    return;
  }
  if (wordExistsNow) {
    setStatus(`Publish blocked: word already used ("${d.word}" / ${d.wordKey}).`, true);
    return;
  }

  const dailyRef = doc(db, "dailyWords", d.date);
  const idxRef = doc(db, "wordIndex", d.wordKey);

  const payload = {
    date: d.date,
    word: d.word,
    wordKey: d.wordKey,
    pos: d.pos || "",
    simpleDef: d.simpleDef,
    preciseDef: d.preciseDef || "",
    example: d.example,
    memoryHook: d.memoryHook || "",
    tags: d.tags,
    sourceName: d.sourceName,
    sourceUrl: d.sourceUrl || "",
    createdAt: serverTimestamp(),
    createdByUid: user.uid
  };

  await setDoc(dailyRef, payload);

  await setDoc(
    idxRef,
    {
      word: d.word,
      wordKey: d.wordKey,
      firstUsedDate: d.date,
      lastUsedDate: d.date,
      usedDates: [d.date],
      updatedAt: serverTimestamp(),
      updatedByUid: user.uid
    },
    { merge: true }
  );

  setStatus(`Published: ${d.date} → "${d.word}"`);
  els.btnPublish.disabled = true;
  lastChecks = { ran: false, ok: false, problems: [], dateExists: false, wordExists: false, wordKey: "" };
}

function wireChecklistReactivity() {
  els.checklist.addEventListener("change", () => {
    if (!lastChecks.ran || !lastChecks.ok) {
      els.btnPublish.disabled = true;
      return;
    }
    els.btnPublish.disabled = !(checklistAllTicked());
  });
}

async function doSignIn() {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}

async function doSignOut() {
  await signOut(auth);
}

function updateAuthUI(user) {
  if (!user) {
    els.authBadge.textContent = "signed out";
    els.authNote.textContent = "Sign in required to run checks and publish.";
    els.btnPublish.disabled = true;
    return;
  }

  const ok = isAdmin(user);
  els.authBadge.textContent = ok ? "admin signed in" : "signed in (not admin)";
  els.authNote.textContent = ok
    ? "Signed in. Run checks to confirm uniqueness, then publish."
    : "Signed in, but not authorised. Add UID to ADMIN_UIDS to allow publishing.";

  els.btnPublish.disabled = true;
}

function init() {
  renderChecklist();
  wireChecklistReactivity();

  els.btnSignIn.addEventListener("click", () => doSignIn().catch(e => setStatus(e.message, true)));
  els.btnSignOut.addEventListener("click", () => doSignOut().catch(e => setStatus(e.message, true)));

  els.btnRunChecks.addEventListener("click", () => {
    runChecks().catch(e => setStatus(e.message, true));
  });

  els.btnPublish.addEventListener("click", () => {
    publish().catch(e => setStatus(e.message, true));
  });

  const invalidate = () => {
    lastChecks.ran = false;
    lastChecks.ok = false;
    els.btnPublish.disabled = true;

    const notUsedBox = document.getElementById("c_not_used_before");
    if (notUsedBox) {
      notUsedBox.disabled = false;
      notUsedBox.checked = false;
    }
    setStatus("Edited. Run checks again.");
  };

  [
    els.date, els.word, els.pos, els.simpleDef, els.preciseDef,
    els.example, els.memoryHook, els.tags, els.sourceName, els.sourceUrl
  ].forEach(el => el.addEventListener("input", invalidate));

  onAuthStateChanged(auth, (user) => updateAuthUI(user));
  setStatus("Ready.");
}

init();
