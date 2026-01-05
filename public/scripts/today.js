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

/* Elements */
const els = {
  status: document.getElementById("status"),
  card: document.getElementById("wordCard"),
  word: document.getElementById("word"),
  pos: document.getElementById("pos"),
  simpleDef: document.getElementById("simpleDef"),
  example: document.getElementById("example")
};

/* Utilities */
function todayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* Main */
async function loadToday() {
  const key = todayKey();
  const ref = doc(db, "dailyWords", key);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    els.status.textContent = "Today’s word has not been published yet.";
    return;
  }

  const d = snap.data();

  els.word.textContent = d.word;
  els.pos.textContent = d.pos ? `(${d.pos})` : "";
  els.simpleDef.textContent = d.simpleDef;
  els.example.textContent = d.example;

  els.status.textContent = "";
  els.card.hidden = false;
}

loadToday().catch(err => {
  els.status.textContent = "Error loading today’s word.";
  console.error(err);
});
