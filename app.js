// 구글 시트에서 불러온 전체 문장 목록
let sentences = [];

// 현재 화면에 표시 중인 문장
let currentSentence = null;


// 구글 시트 데이터 불러오기
async function loadSentences() {

    const response = await fetch(
        "https://opensheet.elk.sh/1gD6OEDDVH1gBIBO1iNS4_tXVJhlTdGZX5Gk8lpyHces/Sheet1"
    );

    const data = await response.json();

    sentences = data;

    console.log("문장 개수:", sentences.length);

    showRandomSentence();
}


// 랜덤 문장 출제
function showRandomSentence() {

    const randomIndex =
        Math.floor(
            Math.random() * sentences.length
        );

    currentSentence =
        sentences[randomIndex];

    // 문제 번호
    document.getElementById(
        "sentenceId"
    ).innerText =
        "#" + currentSentence.ID;

    // 한국어 문제
    document.getElementById(
        "koreanSentence"
    ).innerText =
        currentSentence.Korean;

    // 정답 영역 초기화
    document.getElementById(
        "englishSentence"
    ).innerHTML = "";

    // 태그 표시
    document.getElementById(
        "tag"
    ).innerText =
        "태그: " + currentSentence.Tags;
}


// 정답 보기
function showAnswer() {

    const answers =
        currentSentence.English
            .split("|");

    document.getElementById(
        "englishSentence"
    ).innerHTML =
        answers.join("<br><br>");
}


// 앱 시작
loadSentences();