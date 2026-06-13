let sentences = [];
let state = {};
let currentSentence = null;

init();

/* ================= INIT ================= */

async function init() {
    loadState();
    await loadSentences();
}

/* ================= DATA ================= */

async function loadSentences() {
    const res = await fetch(
        "https://opensheet.elk.sh/1gD6OEDDVH1gBIBO1iNS4_tXVJhlTdGZX5Gk8lpyHces/Sheet1"
    );

    sentences = await res.json();
    showRandomSentence();
}

function loadState() {
    const saved = localStorage.getItem("learningState");
    state = saved ? JSON.parse(saved) : {};
}

function saveState() {
    localStorage.setItem("learningState", JSON.stringify(state));
}

/* ================= LEVEL ================= */

function computeLevel(info) {
    if (info.lastResult === "wrong") return "L1";
    if (info.correct === 0 && info.wrong === 0) return "L2";
    if (info.wrong > info.correct) return "L3";
    if (info.wrong > 0) return "L4";
    return "L5";
}

function getLevelUI(level) {
    const map = {
        L1: { text: "L1 MISSED", color: "#e53935" },
        L2: { text: "L2 NEW", color: "#1e88e5" },
        L3: { text: "L3 WEAK", color: "#fb8c00" },
        L4: { text: "L4 REVIEW", color: "#fdd835" },
        L5: { text: "L5 MASTER", color: "#43a047" }
    };
    return map[level] || map.L2;
}

/* ================= ANSWER ================= */

function submitAnswer(isCorrect) {
    const id = currentSentence.ID;

    if (!state[id]) {
        state[id] = { correct: 0, wrong: 0, level: "L2" };
    }

    if (isCorrect) state[id].correct++;
    else state[id].wrong++;

    state[id].lastResult = isCorrect ? "correct" : "wrong";
    state[id].level = computeLevel(state[id]);

    saveState();
    showRandomSentence();
}

function showAnswer() {
    document.getElementById("englishSentence").innerHTML =
        currentSentence.English.split("|").join("<br><br>");
}

/* ================= PICK ================= */

function pickSentence() {
    const groups = { L1: [], L2: [], L3: [], L4: [], L5: [] };

    sentences.forEach(s => {
        const level = state[s.ID]?.level || "L2";
        groups[level].push(s);
    });

    const pick = arr =>
        arr[Math.floor(Math.random() * arr.length)];

    if (groups.L1.length) return pick(groups.L1);
    if (groups.L2.length) return pick(groups.L2);
    if (groups.L3.length) return pick(groups.L3);
    if (groups.L4.length) return pick(groups.L4);
    return pick(groups.L5);
}

/* ================= UI ================= */

function showRandomSentence() {
    currentSentence = pickSentence();

    const level = state[currentSentence.ID]?.level || "L2";
    const ui = getLevelUI(level);

    document.getElementById("sentenceId").innerText = "#" + currentSentence.ID;
    document.getElementById("koreanSentence").innerText = currentSentence.Korean;
    document.getElementById("tag").innerText = currentSentence.Tags;
    document.getElementById("englishSentence").innerHTML = "";

    const badge = document.getElementById("levelBadge");
    badge.innerText = ui.text;
    badge.style.background = ui.color;
    badge.onclick = showLevelDetail;
}

/* ================= LIST ================= */

function renderList() {
    const container = document.getElementById("sentenceList");
    container.innerHTML = "";

    const order = { L1:1, L2:2, L3:3, L4:4, L5:5 };

    const sorted = [...sentences].sort(
        (a,b) =>
            (order[state[a.ID]?.level || "L2"] -
             order[state[b.ID]?.level || "L2"])
    );

    sorted.forEach(s => {
        const level = state[s.ID]?.level || "L2";
        const ui = getLevelUI(level);

        const div = document.createElement("div");
        div.className = "sentence-item";

        div.innerHTML = `
            <span style="background:${ui.color};color:white;padding:3px 8px;border-radius:10px;font-size:12px;margin-right:8px;">
                ${ui.text}
            </span>
            ${s.Korean}
        `;

        div.onclick = () => {
            currentSentence = s;
            setTab("learn");
        };

        container.appendChild(div);
    });
}

/* ================= STATS ================= */

function renderStats() {
    let count = { L1:0, L2:0, L3:0, L4:0, L5:0 };

    Object.values(state).forEach(s => {
        count[s.level]++;
    });

    document.getElementById("statsBox").innerHTML = `
L1: ${count.L1}
L2: ${count.L2}
L3: ${count.L3}
L4: ${count.L4}
L5: ${count.L5}
    `;
}

/* ================= TAB ================= */

function setTab(tab) {
    document.getElementById("learnView").classList.add("hidden");
    document.getElementById("listView").classList.add("hidden");
    document.getElementById("statsView").classList.add("hidden");

    if (tab === "learn") document.getElementById("learnView").classList.remove("hidden");
    if (tab === "list") { document.getElementById("listView").classList.remove("hidden"); renderList(); }
    if (tab === "stats") { document.getElementById("statsView").classList.remove("hidden"); renderStats(); }
}

/* ================= MODAL ================= */

function showLevelDetail() {
    const id = currentSentence.ID;
    const info = state[id] || {};

    const level = info.level || "L2";

    document.getElementById("modalTitle").innerText = getLevelUI(level).text;

    document.getElementById("modalBody").innerText =
`level: ${level}

correct: ${info.correct || 0}
wrong: ${info.wrong || 0}
last: ${info.lastResult || "none"}`;

    document.getElementById("levelModal").classList.remove("hidden");
}

function closeModal() {
    document.getElementById("levelModal").classList.add("hidden");
}