
const Model = {
    sentences: [],
    state: {},
    currentSentence: null,

    loadState() {
        const saved = localStorage.getItem("learningState");
        this.state = saved ? JSON.parse(saved) : {};
    },

    saveState() {
        localStorage.setItem("learningState", JSON.stringify(this.state));
    }
};

// =========================
// CONTROLLER
// =========================
const Controller = {

    async init() {
        Model.loadState();
        await this.loadSentences();
        this.next();
    },

    async loadSentences() {
        const res = await fetch(
            "https://opensheet.elk.sh/1gD6OEDDVH1gBIBO1iNS4_tXVJhlTdGZX5Gk8lpyHces/Sheet1"
        );
        Model.sentences = await res.json();
    },

    computeLevel(info) {
        if (!info) return "L2";
        if (info.lastResult === "wrong") return "L1";
        if ((info.correct || 0) === 0 && (info.wrong || 0) === 0) return "L2";
        if ((info.wrong || 0) > (info.correct || 0)) return "L3";
        if ((info.wrong || 0) > 0) return "L4";
        return "L5";
    },

    getUI(level) {
        return {
            L1: { text: "L1 MISS", color: "#e53935" },
            L2: { text: "L2 NEW", color: "#1e88e5" },
            L3: { text: "L3 WEAK", color: "#fb8c00" },
            L4: { text: "L4 REVIEW", color: "#fdd835" },
            L5: { text: "L5 MASTER", color: "#43a047" }
        }[level];
    },

    pick() {
        const groups = { L1: [], L2: [], L3: [], L4: [], L5: [] };

        Model.sentences.forEach(s => {
            const lvl = this.computeLevel(Model.state[String(s.ID)]);
            groups[lvl].push(s);
        });

        return groups.L1[0] || groups.L2[0] || groups.L3[0] || groups.L4[0] || groups.L5[0];
    },

    next() {
        const s = this.pick();
        Model.currentSentence = s;

        const id = String(s.ID);

        if (!Model.state[id]) {
            Model.state[id] = { correct: 0, wrong: 0, lastResult: null };
        }

        const info = Model.state[id];
        const level = this.computeLevel(info);
        const ui = this.getUI(level);

        document.getElementById("sentenceId").innerText = "#" + s.ID;
        document.getElementById("koreanSentence").innerText = s.Korean;
        document.getElementById("tag").innerText = s.Tags;
        document.getElementById("englishSentence").innerHTML = "";

        const badge = document.getElementById("levelBadge");
        badge.innerText = ui.text;
        badge.style.background = ui.color;

        Model.saveState();
    },

    submitAnswer(isCorrect) {
        const id = String(Model.currentSentence.ID);

        if (!Model.state[id]) {
            Model.state[id] = { correct: 0, wrong: 0, lastResult: null };
        }

        if (isCorrect) Model.state[id].correct++;
        else Model.state[id].wrong++;

        Model.state[id].lastResult = isCorrect ? "correct" : "wrong";

        const logs = JSON.parse(localStorage.getItem("learningLogs") || "[]");
        logs.push({ sentenceId: id, isCorrect });
        localStorage.setItem("learningLogs", JSON.stringify(logs));

        Model.saveState();
        this.next();
    },

    showAnswer() {
        document.getElementById("englishSentence").innerHTML =
            Model.currentSentence.English.split("|").join("<br><br>");
    }
};

// =========================
// WCW BAR
// =========================
function renderBar(id) {
    const logs = JSON.parse(localStorage.getItem("learningLogs") || "[]");

    const history = logs.filter(l => String(l.sentenceId) === String(id));

    if (history.length === 0) {
        return `<div class="bar empty"></div>`;
    }

    return `
        <div class="bar">
            ${history.map(h =>
                `<div class="bar-seg ${h.isCorrect ? "c" : "w"}"></div>`
            ).join("")}
        </div>
    `;
}

// =========================
// MODAL
// =========================
function showLevelDetail() {
    const id = String(Model.currentSentence.ID);
    const info = Model.state[id] || {};
    const level = Controller.computeLevel(info);

    document.getElementById("modalTitle").innerText = level;

    document.getElementById("modalBody").innerText =
`L1: last wrong
L2: new
L3: weak
L4: mixed
L5: master

C: ${info.correct || 0}
W: ${info.wrong || 0}
last: ${info.lastResult || "none"}`;

    document.getElementById("levelModal").classList.remove("hidden");
}

function closeModal() {
    document.getElementById("levelModal").classList.add("hidden");
}

// =========================
// TAB
// =========================
function setTab(tab) {

    ["learnView", "listView", "statsView"].forEach(id =>
        document.getElementById(id).classList.add("hidden")
    );

    if (tab === "learn") {
        document.getElementById("learnView").classList.remove("hidden");
    }

    if (tab === "list") {
        document.getElementById("listView").classList.remove("hidden");

        const c = document.getElementById("sentenceList");

        const order = {
            L1: 1,
            L2: 2,
            L3: 3,
            L4: 4,
            L5: 5
        };

        const sorted = [...Model.sentences].sort((a, b) => {
            const levelA = Controller.computeLevel(Model.state[String(a.ID)]);
            const levelB = Controller.computeLevel(Model.state[String(b.ID)]);

            return order[levelA] - order[levelB];
        });

        c.innerHTML = sorted.map(s => {

            const info = Model.state[String(s.ID)] || {};
            const correct = info.correct || 0;
            const wrong = info.wrong || 0;
            const total = correct + wrong;

            const level = Controller.computeLevel(info);
            const ui = Controller.getUI(level);

            return `
                <div class="card" style="margin-bottom:10px;">

                    <div style="display:flex;justify-content:space-between;">
                        <div>
                            <span style="font-size:11px;color:#999;">#${s.ID}</span>
                            <span style="
                                background:${ui.color};
                                color:white;
                                padding:3px 8px;
                                border-radius:999px;
                                font-size:11px;
                                margin-left:6px;
                            ">
                                ${ui.text}
                            </span>
                        </div>

                        <small>${total === 0 ? "NEW" : `${correct}/${total}`}</small>
                    </div>

                    <div style="margin-top:8px;font-weight:600;">
                        ${s.Korean}
                    </div>

                    ${renderBar(s.ID)}

                    <div style="font-size:11px;color:#888;margin-top:6px;">
                        last: ${info.lastResult || "none"}
                    </div>

                </div>
            `;
        }).join("");
    }

    if (tab === "stats") {
        document.getElementById("statsView").classList.remove("hidden");
        document.getElementById("statsBox").innerText =
            JSON.stringify(Model.state, null, 2);
    }
}

// =========================
// GLOBAL BIND
// =========================
window.submitAnswer = v => Controller.submitAnswer(v);
window.showAnswer = () => Controller.showAnswer();
window.setTab = setTab;
window.showLevelDetail = showLevelDetail;
window.closeModal = closeModal;

// =========================
// INIT
// =========================
Controller.init();