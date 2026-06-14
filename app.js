const Model = {
    sentences: [],
    state: {},
    currentSentence: null
};

let selectedDate = null;

// =========================
// INIT
// =========================
const levelExplain = {
    L1: "❌ MISS: 마지막에 틀렸거나 최근에 실패한 문장",
    L2: "🆕 NEW: 아직 거의 학습되지 않은 문장",
    L3: "⚠️ WEAK: 틀린 횟수가 맞은 횟수보다 많음",
    L4: "🔄 REVIEW: 어느 정도 맞았지만 아직 불안정",
    L5: "🔥 MASTER: 안정적으로 정답 유지 중"
};

const Controller = {

    async init() {
        this.loadState();
        await this.loadSentences();
        this.populateSourceFilter();
        this.populateListSourceFilter();
        this.next();
    },

    loadState() {
        Model.state = JSON.parse(localStorage.getItem("learningState") || "{}");
    },

    saveState() {
        localStorage.setItem("learningState", JSON.stringify(Model.state));
    },

    async loadSentences() {
        const res = await fetch(
            "https://opensheet.elk.sh/1gD6OEDDVH1gBIBO1iNS4_tXVJhlTdGZX5Gk8lpyHces/Sheet1"
        );
        Model.sentences = await res.json();
    },


    populateSourceFilter() {

        const select =
            document.getElementById("sourceFilter");

        const sources = [
            ...new Set(
                Model.sentences
                    .map(s => s.Source)
                    .filter(Boolean)
            )
        ].sort();

        select.innerHTML =
            `<option value="ALL">전체</option>`;

        sources.forEach(source => {

            select.innerHTML +=
                `<option value="${source}">
                    ${source}
                </option>`;
        });
    },


    populateListSourceFilter() {

    const select =
        document.getElementById("listSourceFilter");

    const sources = [
        ...new Set(
            Model.sentences
                .map(s => s.Source)
                .filter(Boolean)
        )
    ].sort();

    select.innerHTML =
        `<option value="ALL">전체</option>`;

    sources.forEach(source => {

        select.innerHTML +=
            `<option value="${source}">
                ${source}
            </option>`;
    });
},



    computeLevel(info) {
        if (!info) return "L2";
        if (info.lastResult === "wrong") return "L1";
        if ((info.correct || 0) === 0) return "L2";
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

        const selectedSource =
            document.getElementById("sourceFilter")?.value
            || "ALL";

        const groups = {
            L1: [],
            L2: [],
            L3: [],
            L4: [],
            L5: []
        };

        let candidates = Model.sentences;

        if (selectedSource !== "ALL") {
            candidates = candidates.filter(
                s => s.Source === selectedSource
            );
        }

        const keyword =
            document.getElementById("searchBox")?.value
                .trim()
                .toLowerCase() || "";

        if (keyword) {

            filtered = filtered.filter(s => {

                const text = [
                    s.Korean || "",
                    s.English || "",
                    s.Note || "",
                    s.Source || "",
                    s.Tags || ""
                ]
                .join(" ")
                .toLowerCase();

                return text.includes(keyword);
            });
        }

        candidates.forEach(s => {

            const id = String(s.ID);
            const info = Model.state[id] || {
                correct: 0,
                wrong: 0
            };

            const total = info.correct + info.wrong;
            const wrongRatio =
                total === 0 ? 0 : info.wrong / total;

            const lvl = this.computeLevel(info);

            groups[lvl].push({
                ...s,
                _wrongRatio: wrongRatio
            });
        });

    const pickFromGroup = (arr) => {
        if (arr.length === 0) return null;

        // 1) wrongRatio 높은 순 정렬
        arr.sort((a, b) => {
            if (b._wrongRatio !== a._wrongRatio) {
                return b._wrongRatio - a._wrongRatio;
            }
            return Math.random() - 0.5; // 2) 같으면 랜덤
        });

        return arr[0];
    };

    return (
        pickFromGroup(groups.L1) ||
        pickFromGroup(groups.L2) ||
        pickFromGroup(groups.L3) ||
        pickFromGroup(groups.L4) ||
        pickFromGroup(groups.L5)
    );
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
        document.getElementById("noteBox").classList.add("hidden");
        document.getElementById("source").innerText = s.Source;

        const badge = document.getElementById("levelBadge");
        badge.innerText = ui.text;
        badge.style.background = ui.color;

        this.saveState();
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

        logs.push({
            sentenceId: id,
            isCorrect,
            date: new Date().toISOString().slice(0, 10),
            ts: Date.now()   // ⭐ 중요 (순서 보장)
        });

        localStorage.setItem("learningLogs", JSON.stringify(logs));

        this.saveState();
        this.next();
    }
};

// =========================
// 🔥 BAR (완전 수정 핵심)
// =========================
function renderBar(info = {}, sentenceId) {

    const logs = JSON.parse(localStorage.getItem("learningLogs") || "[]");

    const history = logs
        .filter(l => String(l.sentenceId) === String(sentenceId))
        .sort((a, b) => a.ts - b.ts)   // ⭐ 핵심: 시간순 보장
        .map(l => l.isCorrect ? "c" : "w");

    if (history.length === 0) {
        return `<div class="bar empty"></div>`;
    }

    return `
        <div class="bar">
            ${history.map(h =>
                `<div class="bar-seg ${h}"></div>`
            ).join("")}
        </div>
    `;
}

// =========================
// LIST
// =========================
function renderList() {
    const el = document.getElementById("sentenceList");

    const order = { L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };

    const selectedSource =
        document.getElementById("listSourceFilter")?.value
        || "ALL";

    let filtered = [...Model.sentences];

    if (selectedSource !== "ALL") {
        filtered = filtered.filter(
            s => s.Source === selectedSource
        );
    }

    const keyword =
        document.getElementById("searchBox")?.value
            .trim()
            .toLowerCase() || "";

    if (keyword) {

        filtered = filtered.filter(s => {

            const text = [
                s.Korean || "",
                s.English || "",
                s.Note || "",
                s.Source || "",
                s.Tags || ""
            ]
            .join(" ")
            .toLowerCase();

            return text.includes(keyword);
        });
    }

    const sorted = filtered.sort((a, b) => {
        const la = Controller.computeLevel(Model.state[String(a.ID)]);
        const lb = Controller.computeLevel(Model.state[String(b.ID)]);
        return order[la] - order[lb];
    });

    el.innerHTML = sorted.map(s => {
        const info = Model.state[String(s.ID)] || {};
        const total = (info.correct || 0) + (info.wrong || 0);

        const level = Controller.computeLevel(info);
        const ui = Controller.getUI(level);

        return `
<div class="card" style="margin-bottom:10px;">

    <div style="
        display:flex;
        align-items:center;
        gap:8px;
        margin-bottom:6px;
        flex-wrap:nowrap;
    ">

        <span style="
            padding:3px 8px;
            border-radius:999px;
            font-size:11px;
            font-weight:700;
            color:#fff;
            background:${ui.color};
            flex-shrink:0;
        ">
            ${ui.text}
        </span>

        <span style="
            padding:2px 6px;
            border-radius:999px;
            font-size:11px;
            font-weight:700;
            background:#f1f3f5;
            color:#666;
            flex-shrink:0;
        ">
            ${info.correct || 0}/${total}
        </span>


        <span style="
            font-weight:700;
            font-size:13px;
            white-space:nowrap;
        ">
            #${s.ID}
        </span>

        <span style="
            font-size:12px;
            opacity:0.7;
            white-space:nowrap;
            overflow:hidden;
            text-overflow:ellipsis;
        ">
            ${s.Tags}
        </span>

        <span style="
            padding:2px 6px;
            border-radius:999px;
            font-size:11px;
            background:#f1f3f5;
            color:#666;
            flex-shrink:0;
        ">
            ${s.Source}
</span>

    </div>

    <div
    class="sentence-korean"
    onclick="toggleEnglish(${s.ID})"
>

        ${s.Korean}
</div>

    <div
    id="eng-${s.ID}"
    class="sentence-english hidden"
>
    ${s.English.replaceAll("|","<br>")}

    ${
        s.Note
        ? `
        <div style="
            margin-top:10px;
            padding:8px;
            border-radius:8px;
            background:#f5f5f5;
            font-size:13px;
            line-height:1.5;
        ">
            💡 ${s.Note}
        </div>
        `
        : ""
    }

</div>

        ${renderBar(info, s.ID)}

    </div>
`;
    }).join("");
}

// =========================
// STATS
// =========================
function getDailyStats() {
    const logs = JSON.parse(localStorage.getItem("learningLogs") || "[]");

    const map = {};

    logs.forEach(l => {
        if (!map[l.date]) {
            map[l.date] = { total: 0, correct: 0, wrong: 0 };
        }

        map[l.date].total++;
        l.isCorrect ? map[l.date].correct++ : map[l.date].wrong++;
    });

    return map;
}

// =========================
// STREAK
// =========================
function getStreak() {
    const logs = JSON.parse(localStorage.getItem("learningLogs") || "[]");
    const dates = [...new Set(logs.map(l => l.date))].sort().reverse();

    let streak = 0;
    let today = new Date();

    for (let d of dates) {
        const date = new Date(d);
        const diff = Math.floor((today - date) / (1000 * 60 * 60 * 24));

        if (diff === streak) streak++;
        else break;
    }

    return streak;
}

// =========================
// SUMMARY
// =========================
function renderSummary() {
    const stats = getDailyStats();
    const streak = getStreak();

    let total = 0, correct = 0;

    Object.values(stats).forEach(s => {
        total += s.total;
        correct += s.correct;
    });

    const rate = total ? Math.round((correct / total) * 100) : 0;

    document.getElementById("summary").innerHTML = `
    <div class="summary-grid">

        <div class="summary-item">
            <div class="summary-icon">🔥</div>
            <div class="summary-value">${streak}</div>
            <div class="summary-label">연속 학습</div>
        </div>

        <div class="summary-item">
            <div class="summary-icon">📚</div>
            <div class="summary-value">${Object.keys(stats).length}</div>
            <div class="summary-label">학습 일수</div>
        </div>

        <div class="summary-item">
            <div class="summary-icon">🎯</div>
            <div class="summary-value">${rate}%</div>
            <div class="summary-label">정확도</div>
        </div>

    </div>
    `;
}


function renderMasterProgress() {

    let masterCount = 0;

    Model.sentences.forEach(s => {

        const info = Model.state[String(s.ID)];
        const level = Controller.computeLevel(info);

        if (level === "L5") {
            masterCount++;
        }
    });

    const total = Model.sentences.length || 1;

    const percent = Math.round(
        (masterCount / total) * 100
    );

    let message = "Just Getting Started";

    if (percent >= 80) {
        message = "Outstanding!";
    }
    else if (percent >= 60) {
        message = "Almost There!";
    }
    else if (percent >= 40) {
        message = "Making Great Progress!";
    }
    else if (percent >= 20) {
        message = "Keep Going!";
    }

    document.getElementById("masterProgress").innerHTML = `
    
        <div class="master-title">
            🏆 Mastered Progress
        </div>

        <div class="master-count">
            ${masterCount} / ${total}
        </div>

        <div class="master-sub">
            Sentences Mastered
        </div>

        <div class="master-track">
            <div
                class="master-fill"
                style="width:${percent}%"
            ></div>
        </div>

        <div class="master-footer">
            ${percent}% · ${message}
        </div>

    `;
}

function renderLevelStats() {

    const levels = {
        L1: 0,
        L2: 0,
        L3: 0,
        L4: 0,
        L5: 0
    };

    Model.sentences.forEach(s => {
        const info = Model.state[String(s.ID)];
        const level = Controller.computeLevel(info);
        levels[level]++;
    });

    const total = Model.sentences.length || 1;

    document.getElementById("levelStats").innerHTML = `
        ${renderLevelBar("L1", levels.L1, total)}
        ${renderLevelBar("L2", levels.L2, total)}
        ${renderLevelBar("L3", levels.L3, total)}
        ${renderLevelBar("L4", levels.L4, total)}
        ${renderLevelBar("L5", levels.L5, total)}
    `;
}

function renderLevelBar(level, count, total) {

    const ui = Controller.getUI(level);

    const percent = Math.round((count / total) * 100);

    return `
        <div class="level-dist-row">

            <span
                class="level-dist-badge"
                style="background:${ui.color}"
            >
                ${ui.text}
            </span>

            <div class="level-dist-track">
                <div
                    class="level-dist-fill"
                    style="
                        width:${percent}%;
                        background:${ui.color};
                    "
                ></div>
            </div>

            <span class="level-dist-count">
                ${count}
            </span>

        </div>
    `;
}


// =========================
// CALENDAR
// =========================
function renderCalendar() {
    const data = getDailyStats();
    const el = document.getElementById("calendar");

    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    const first = new Date(y, m, 1).getDay();
    const last = new Date(y, m + 1, 0).getDate();

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

    let html = "";

    for (let i = 0; i < first; i++) {
        html += `<div></div>`;
    }

    for (let i = 1; i <= last; i++) {

        const date = `${y}-${String(m + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
        const stat = data[date];

        let lv = 0;
        let studied = false;

        if (stat) {
            studied = stat.total > 0;

            const total = stat.total;
            const correct = stat.correct;
            const accuracy = total ? correct / total : 0;

            if (total >= 20 && accuracy >= 0.8) lv = 4;
            else if (total >= 15) lv = 3;
            else if (total >= 8) lv = 2;
            else lv = 1;
        }

        const isToday = date === todayStr;

        html += `
        <div class="day 
                    l${lv} 
                    ${studied ? "studied" : "unstudied"} 
                    ${isToday ? "today" : ""}"
             onclick="showDayDetail('${date}')">

            <div class="day-num">${i}</div>

            ${stat ? `
                <div class="day-meta">
                    <span class="t">${stat.total}</span>
                    <span class="c">✔${stat.correct}</span>
                    <span class="w">✖${stat.wrong}</span>
                </div>
            ` : ""}

        </div>`;
    }

    el.innerHTML = html;
}

// =========================
// DAY DETAIL
// =========================
function showDayDetail(date) {

    selectedDate = date;

    const logs = JSON.parse(localStorage.getItem("learningLogs") || "[]");
    const sentences = Model.sentences;

    const filtered = logs.filter(l => l.date === date);

    const el = document.getElementById("dayDetail");

    if (filtered.length === 0) {
        el.innerHTML = `
            <div class="detail-empty">
                📅 ${date}<br>
                No study data
            </div>
        `;
    } else {

        let correct = 0;
        let wrong = 0;

        const items = filtered.map(l => {
            const s = sentences.find(x => String(x.ID) === String(l.sentenceId));
            if (l.isCorrect) correct++;
            else wrong++;

            return `
                <div class="detail-card ${l.isCorrect ? "c" : "w"}">

                    <div class="row-top">
                        <span class="badge ${l.isCorrect ? "ok" : "no"}">
                            ${l.isCorrect ? "✔ Correct" : "✖ Wrong"}
                        </span>
                        <span class="sid">#${l.sentenceId}</span>
                    </div>

                    <div class="ko">
                        ${s?.Korean || ""}
                    </div>

                    <div class="en">
                        ${s?.English || ""}
                    </div>

                </div>
            `;
        }).join("");

        const total = correct + wrong;
        const rate = total ? Math.round((correct / total) * 100) : 0;

        el.innerHTML = `
            <div class="detail-header">
                <h3>📅 ${date}</h3>

                <div class="summary-box">
                    <div>✔ ${correct}</div>
                    <div>✖ ${wrong}</div>
                    <div>🎯 ${rate}%</div>
                </div>
            </div>

            <div class="detail-list">
                ${items}
            </div>
        `;
    }

    el.classList.remove("hidden");
    el.scrollIntoView({ behavior: "smooth" });
}

// =========================
// TAB
// =========================
function setTab(tab) {

    ["learnView", "listView", "statsView", "importView"].forEach(id => {
        document.getElementById(id).classList.add("hidden");
    });

    if (tab === "learn") document.getElementById("learnView").classList.remove("hidden");

    if (tab === "list") {
        document.getElementById("listView").classList.remove("hidden");
        renderList();
    }

    if (tab === "stats") {
        document.getElementById("statsView").classList.remove("hidden");
        renderSummary();
        renderMasterProgress();
        renderLevelStats();
        renderCalendar();
    }

    if (tab === "import") {
        document
        .getElementById("importView")
        .classList.remove("hidden");
    }

}

// =========================
// GLOBAL
// =========================
window.submitAnswer = v => Controller.submitAnswer(v);
window.setTab = setTab;
window.showDayDetail = showDayDetail;
window.showLevelDetail = showLevelDetail;

// =========================
// LEVEL DETAIL (추가)
// =========================
// function showLevelDetail() {

//     const info = Model.state[String(Model.currentSentence.ID)];
//     const level = Controller.computeLevel(info);
//     const ui = Controller.getUI(level);

//     const logs = JSON.parse(localStorage.getItem("learningLogs") || "[]")
//         .filter(l => String(l.sentenceId) === String(Model.currentSentence.ID));

//     const correct = logs.filter(l => l.isCorrect).length;
//     const wrong = logs.filter(l => !l.isCorrect).length;

//     const el = document.getElementById("dayDetail");

//     el.innerHTML = `
//         <h3>Level Detail</h3>

//         <div style="
//             display:inline-block;
//             padding:6px 12px;
//             border-radius:999px;
//             font-weight:700;
//             color:#fff;
//             background:${ui.color};
//             margin-bottom:10px;
//         ">
//             ${ui.text}
//         </div>

//         <br><br>

//         ✔ Correct: ${correct}<br>
//         ✖ Wrong: ${wrong}<br>
//         📊 Total: ${correct + wrong}
//     `;

//     el.classList.remove("hidden");
//     el.scrollIntoView({ behavior: "smooth" });
// }

function showLevelDetail() {

    const id = String(Model.currentSentence.ID);
    const info = Model.state[id] || {};
    const currentLevel = Controller.computeLevel(info);
    const currentUI = Controller.getUI(currentLevel);

    const levelDesc = {
        L1: "최근 틀림",
        L2: "처음 학습",
        L3: "오답 > 정답",
        L4: "틀린 적 있음",
        L5: "항상 맞음"
    };

    const logs = JSON.parse(localStorage.getItem("learningLogs") || "[]")
        .filter(l => String(l.sentenceId) === id);

    const correct = logs.filter(l => l.isCorrect).length;
    const wrong = logs.filter(l => !l.isCorrect).length;
    const total = correct + wrong;

    const modal = document.getElementById("levelModal");

    const levels = ["L1","L2","L3","L4","L5"];

    modal.innerHTML = `
        <div class="modal-content compact">

            <!-- 🔥 핵심 리스트 -->
            <div class="level-list">

                ${levels.map(l => {
                    const ui = Controller.getUI(l);
                    return `
                        <div class="level-row ${l === currentLevel ? "active" : ""}">
                            <span class="badge" style="
                                display:inline-block;
                                padding:3px 8px;
                                border-radius:999px;
                                font-size:11px;
                                font-weight:700;
                                color:#fff;
                                background:${ui.color};
                                margin-right:8px;
                            ">
                                ${ui.text}
                            </span>

                            <span class="desc">
                                ${levelDesc[l]}
                            </span>
                        </div>
                    `;
                }).join("")}

            </div>

            <div class="stats">
                맞은 횟수 ${correct} / 틀린 횟수 ${wrong} / Total ${total}
            </div>

            <div style="text-align:right;margin-top:10px;">
                <button onclick="closeLevelModal()">Close</button>
            </div>

        </div>
    `;

    modal.classList.remove("hidden");
}
function closeLevelModal() {
    document.getElementById("levelModal").classList.add("hidden");
}

window.closeLevelModal = closeLevelModal;
window.showLevelDetail = showLevelDetail;


// function showAnswer() {
//     const el = document.getElementById("englishSentence");
//     el.innerText = Model.currentSentence.English;
    
// }

function showAnswer() {
    const el = document.getElementById("englishSentence");

    const s = Model.currentSentence.English || "";
    const note = Model.currentSentence.Note;

    if (note && note.trim()) {

        document.getElementById("noteText")
            .innerText = note;

        document.getElementById("noteBox")
            .classList.remove("hidden");
    }

    el.innerHTML = s
    .split("|")
    .map(part => `<div class="eng-line">💬 ${part}</div>`)
    .join("");
}



// =========================
// START
// =========================
Controller.init();


function toggleEnglish(id) {

    const el = document.getElementById(`eng-${id}`);

    el.classList.toggle("hidden");
}

window.toggleEnglish = toggleEnglish;

function resetLearningData() {

    const text = prompt(
        "RESET 을 입력하면 삭제됩니다."
    );

    if (text !== "RESET") {
        return;
    }

    localStorage.removeItem("learningState");
    localStorage.removeItem("learningLogs");

    alert("초기화 완료");

    location.reload();
}

function convertOcrText() {

    const input = document.getElementById("ocrInput").value;

    const text = input
        .replace(/\r/g, "")
        .replace(/\n/g, " ")
        .replace(/[•◦·○]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const result = [];

    let english = "";
    let korean = "";

    let mode = null;
    let noteMode = false;
    let noteBuffer = "";

    const savePair = () => {

        if (
            english.trim().length > 0 &&
            korean.trim().length > 0
        ) {

            result.push({
                korean: korean.trim(),
                english: english.trim(),
                note: ""
            });
        }

        english = "";
        korean = "";
    };

    const chars = [...text];

    for (let i = 0; i < chars.length; i++) {

        const char = chars[i];

        // --------------------
        // note 시작
        // --------------------
        if (char === "#") {

            noteMode = true;
            noteBuffer = "";

            continue;
        }

        // --------------------
        // note 수집
        // --------------------
        if (noteMode) {

            // note 끝:
            // 영어 대문자로 새 문장이 시작되는 경우
            const nextText = text.slice(i);

            const newSentence =
                /^[A-Z]/.test(char);

            if (
                newSentence &&
                result.length > 0 &&
                noteBuffer.length > 10
            ) {

                result[result.length - 1].note =
                    noteBuffer.trim();

                noteMode = false;

                // 현재 문자 다시 처리
                i--;
                continue;
            }

            noteBuffer += char;
            continue;
        }

        // 숫자 토큰 처리
    if (/[0-9]/.test(char)) {

        let numberToken = char;
        let j = i + 1;

        // 연속 숫자 수집
        while (
            j < chars.length &&
            /[0-9]/.test(chars[j])
        ) {
            numberToken += chars[j];
            j++;
        }

        // 숫자 뒤 첫 의미있는 문자 찾기
        let k = j;

        while (
            k < chars.length &&
            /\s/.test(chars[k])
        ) {
            k++;
        }

        const nextChar = chars[k] || "";

        if (/[가-힣]/.test(nextChar)) {
            korean += numberToken;
        } else {
            english += numberToken;
        }

        // 숫자들을 이미 처리했으므로 건너뜀
        i = j - 1;
        continue;
    }

        const isEnglish = /[A-Za-z]/.test(char);
        const isKorean = /[가-힣]/.test(char);


        // --------------------
        // 영어 시작
        // --------------------
        if (isEnglish) {

            if (mode === "korean") {

                // 이미 영어+한글이 있으면 저장
                if (
                    english.trim().length > 0 &&
                    korean.trim().length > 0
                ) {
                    savePair();
                }
            }

            mode = "english";
            english += char;
            continue;
        }

        // --------------------
        // 한글
        // --------------------
        if (isKorean) {

            mode = "korean";
            korean += char;
            continue;
        }

        // --------------------
        // 기타 문자
        // --------------------


        if (mode === "english") {
            english += char;
        }

        if (mode === "korean") {
            korean += char;
        }
    }

    // 마지막 note 저장
    if (
        noteMode &&
        result.length > 0
    ) {
        result[result.length - 1].note =
            noteBuffer.trim();
    }

    // 마지막 pair 저장
    savePair();

    // 출력
    const output = result.map(item =>
        `${item.korean}\t${item.english}\t${item.note}\tbook`
    );

    document.getElementById("ocrOutput").value =
        output.join("\n");
}

// 되긴되는데 다시
// function convertOcrText() {

//     const input = document.getElementById("ocrInput").value;

//     console.log("🔥 START");

//     // 1. 기본 정리
//     const cleaned = input
//         .replace(/\n/g, " ")
//         .replace(/\s+/g, " ")
//         .trim();

//     console.log("🧹 cleaned:", cleaned);

//     // 2. 문장 단위 분리 (• 기준)
//     const chunks = cleaned
//         .split("•")
//         .map(s => s.trim())
//         .filter(Boolean);

//     console.log("🔪 chunks:", chunks);

//     const result = [];

//     for (let chunk of chunks) {

//         console.log("\n➡️ chunk:", chunk);

//         let note = "";
//         let main = chunk;

//         // 3. note 분리 (# 기준)
//         if (main.includes("#")) {
//             const parts = main.split("#");
//             main = parts[0].trim();
//             note = parts.slice(1).join(" ").trim();
//         }

//         console.log("   main:", main);
//         console.log("   note:", note);

//         // 4. * 제거 (의미 없음)
//         // main = main.replace(/\*/g, "");

//         // 5. 한글 / 영어 분리
//         const koreanMatch = main.match(/[가-힣][^A-Za-z]*/g);
//         const englishMatch = main.match(/[A-Za-z][^가-힣]*/g);

//         const korean = (koreanMatch || []).join(" ").trim();
//         const english = (englishMatch || []).join(" ").trim();

//         console.log("   korean:", korean);
//         console.log("   english:", english);

//         // 6. validation
//         if (!korean || !english) {
//             console.log("⚠️ SKIP (invalid pair)");
//             continue;
//         }

//         // 7. 최종 출력
//         const row = `${korean}\t${english}\t${note}\tbook`;

//         console.log("✅ row:", row);

//         result.push(row);
//     }

//     // 8. 출력
//     document.getElementById("ocrOutput").value =
//         result.join("\n");

//     console.log("🏁 DONE");
// }

// function convertOcrText() {

//     console.log("🔥 convertOcrText START");

//     const input = document.getElementById("ocrInput")?.value;

//     console.log("📥 input length:", input?.length);
//     console.log("📥 input preview:", input?.slice(0, 100));

//     if (!input) {
//         console.log("❌ input is empty or undefined");
//         return;
//     }

//     const text = input
//         .replace(/\n/g, " ")
//         .replace(/\s+/g, " ")
//         .replace(/•/g, " ")
//         .trim();

//     console.log("🧹 cleaned text preview:", text.slice(0, 100));

//     const result = [];

//     let english = "";
//     let korean = "";
//     let note = "";

//     let mode = null;
//     let isNote = false;

//     const flush = () => {

//         console.log("🚨 FLUSH CALL");
//         console.log("   english:", english);
//         console.log("   korean:", korean);
//         console.log("   note:", note);

//         if (english.trim().length > 5 && korean.trim().length > 1) {
//             const row = `${korean.trim()}\t${english.trim()}\t${note.trim()}\tbook`;
//             console.log("✅ PUSH ROW:", row);
//             result.push(row);
//         } else {
//             console.log("⚠️ SKIPPED (too short)");
//         }

//         english = "";
//         korean = "";
//         note = "";
//         mode = null;
//         isNote = false;
//     };

//     const chars = [...text];

//     console.log("🔄 total chars:", chars.length);

//     chars.forEach((char, idx) => {

//         // 🔥 위치 추적
//         if (idx < 30) {
//             console.log(`[${idx}] char:`, char);
//         }

//         // 1. note 시작
//         if (char === "#") {
//             console.log("🔥 NOTE START at index", idx);
//             isNote = true;
//             return;
//         }

//         // 2. note 처리
//         if (isNote) {
//             note += char;
//             return;
//         }

//         const isEnglish = /[A-Za-z]/.test(char);
//         const isKorean = /[가-힣]/.test(char);

//         // 3. 영어
//         if (isEnglish) {

//             if (mode === "korean") {
//                 console.log("🔁 KOREAN → ENGLISH FLUSH");
//                 flush();
//             }

//             mode = "english";
//             english += char;
//             return;
//         }

//         // 4. 한글
//         if (isKorean) {

//             if (mode === "english") {
//                 console.log("🔁 ENGLISH → KOREAN FLUSH");
//                 flush();
//             }

//             mode = "korean";
//             korean += char;
//             return;
//         }

//         // 5. 기타 문자
//         if (mode === "english") english += char;
//         if (mode === "korean") korean += char;
//     });

//     console.log("🏁 FINAL FLUSH");
//     flush();

//     console.log("📦 FINAL RESULT:", result);

//     document.getElementById("ocrOutput").value =
//         result.join("\n");

//     console.log("✅ DONE");
// }

// 안됨
// function convertOcrText() {

//     const input = document.getElementById("ocrInput").value;

//     const text = input
//         .replace(/\n/g, " ")
//         .replace(/\s+/g, " ")
//         .trim();

//     const result = [];

//     let ko = "";
//     let en = "";
//     let note = "";
//     let tag = "book";

//     let mode = null;

//     const flush = () => {

//         if (ko.trim() && en.trim()) {
//             result.push(
//                 `${ko.trim()}\t${en.trim()}\t${note.trim()}\t${tag}`
//             );
//         }

//         ko = "";
//         en = "";
//         note = "";
//         mode = null;
//     };

//     const isKorean = (c) => /[가-힣]/.test(c);
//     const isEnglish = (c) => /[A-Za-z]/.test(c);

//     for (let char of text) {

//         // 1. note 시작 (#)
//         if (char === "#") {
//             flush();
//             mode = "note";
//             continue;
//         }

//         // 2. 영어
//         if (isEnglish(char)) {

//             if (mode === "korean") flush();
//             if (mode === "note") mode = null;

//             mode = "english";
//             en += char;
//             continue;
//         }

//         // 3. 한글
//         if (isKorean(char)) {

//             if (mode === "english") flush();
//             if (mode === "note") mode = null;

//             mode = "korean";
//             ko += char;
//             continue;
//         }

//         // 4. note 수집
//         if (mode === "note") {
//             note += char;
//             continue;
//         }

//         // 5. 기타는 그대로 붙임
//         if (mode === "english") en += char;
//         if (mode === "korean") ko += char;
//     }

//     flush();

//     document.getElementById("ocrOutput").value =
//         result.join("\n");
// }

// 되는데 노트가 다른줄에 붙음
// function convertOcrText() {

//     const input =
//         document.getElementById("ocrInput").value;

//     const text = input
//         .replace(/\n/g, " ")
//         .replace(/\s+/g, " ")
//         .replace(/•/g, " ")
//         .trim();

//     const result = [];

//     let english = "";
//     let korean = "";

//     let mode = null;

//     const chars = [...text];

//     chars.forEach(char => {

//         const isKorean = /[가-힣]/.test(char);
//         const isEnglish = /[A-Za-z]/.test(char);

//         if (isEnglish) {

//             if (mode === "korean") {

//                 if (
//                     english.trim().length > 5 &&
//                     korean.trim().length > 1
//                 ) {
//                     result.push(
//                         `${korean.trim()}\t${english.trim()}\tbook`
//                     );
//                 }

//                 english = "";
//                 korean = "";
//             }

//             mode = "english";
//             english += char;
//         }

//         else if (isKorean) {

//             mode = "korean";
//             korean += char;
//         }

//         else {

//             if (mode === "english") {
//                 english += char;
//             }

//             if (mode === "korean") {
//                 korean += char;
//             }
//         }

//     });

//     if (
//         english.trim().length > 5 &&
//         korean.trim().length > 1
//     ) {
//         result.push(
//             `${korean.trim()}\t${english.trim()}\tlive academy`
//         );
//     }

//     document.getElementById("ocrOutput").value =
//         result.join("\n");
// }

// function convertOcrText() {

//     const input = document.getElementById("ocrInput").value;

//     const text = input
//         .replace(/\n/g, " ")
//         .replace(/\s+/g, " ")
//         .trim();

//     const result = [];

//     let english = "";
//     let korean = "";
//     let mode = null;

//     const flush = () => {
//         if (english.trim() && korean.trim()) {
//             result.push(`${korean.trim()}\t${english.trim()}`);
//         }
//         english = "";
//         korean = "";
//     };

//     for (let char of text) {

//         const isKorean = /[가-힣]/.test(char);
//         const isEnglish = /[A-Za-z]/.test(char);

//         // 1. 영어
//         if (isEnglish) {

//             if (mode === "korean") {
//                 flush();
//             }

//             mode = "english";
//             english += char;
//             continue;
//         }

//         // 2. 한글
//         if (isKorean) {

//             if (mode === "english") {
//                 flush();
//             }

//             mode = "korean";
//             korean += char;
//             continue;
//         }

//         // 3. 기타 문자 (., •, *, # 등)
//         // 👉 그냥 현재 buffer에 붙여줌
//         if (mode === "english") english += char;
//         if (mode === "korean") korean += char;
//     }

//     // 마지막 flush
//     flush();

//     document.getElementById("ocrOutput").value =
//         result.join("\n");
// }

async function copyTsv() {

    const text =
        document.getElementById("ocrOutput").value;

    await navigator.clipboard.writeText(text);

    alert("Copied!");
}