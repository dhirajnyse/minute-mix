const ROUND_TIME_MS = 15000;
const TOTAL_TIME_MS = ROUND_TIME_MS * 5;
const STORAGE_KEY = "minutemix-progress-v1";
const SOUND_KEY = "minutemix-sound-v1";

const ACCENTS = {
  coral: "#ff5a50",
  blue: "#165dca",
  yellow: "#f6c945",
  mint: "#84cdb3",
  plum: "#7b4b78"
};

const ROUND_LABELS = ["Colour Clash", "Memory Flash", "Quick Count", "World Snap", "Word Twist"];

const lobbyView = document.querySelector("#lobby-view");
const playView = document.querySelector("#play-view");
const resultView = document.querySelector("#result-view");
const startButton = document.querySelector("#start-button");
const replayButton = document.querySelector("#replay-button");
const shareButton = document.querySelector("#share-button");
const soundToggle = document.querySelector("#sound-toggle");
const headerDate = document.querySelector("#header-date");
const lobbyStreak = document.querySelector("#lobby-streak");
const lobbyBest = document.querySelector("#lobby-best");
const playedNote = document.querySelector("#played-note");
const resetCountdown = document.querySelector("#reset-countdown");
const progressDots = document.querySelector("#progress-dots");
const roundRailList = document.querySelector("#round-rail-list");
const liveScore = document.querySelector("#live-score");
const timerRing = document.querySelector("#timer-ring");
const timerValue = document.querySelector("#timer-value");
const roundKicker = document.querySelector("#round-kicker");
const roundTitle = document.querySelector("#round-title");
const roundInstruction = document.querySelector("#round-instruction");
const stimulus = document.querySelector("#stimulus");
const answerGrid = document.querySelector("#answer-grid");
const correctCount = document.querySelector("#correct-count");
const roundTime = document.querySelector("#round-time");
const feedback = document.querySelector("#feedback");
const resultScore = document.querySelector("#result-score");
const resultMarks = document.querySelector("#result-marks");
const resultDate = document.querySelector("#result-date");
const resultTitle = document.querySelector("#result-title");
const resultMessage = document.querySelector("#result-message");
const resultCorrect = document.querySelector("#result-correct");
const resultStreak = document.querySelector("#result-streak");
const resultBest = document.querySelector("#result-best");
const shareStatus = document.querySelector("#share-status");

const today = new Date();
const todayKey = dateKey(today);
const todayDisplay = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(today);
const rounds = buildDailyRounds(todayKey);

let soundEnabled = readSoundPreference();
let audioContext = null;
let animationFrame = 0;
let memoryTimeout = 0;
let transitionTimeout = 0;
let gameState = freshGameState();

function freshGameState() {
  return {
    isPlaying: false,
    locked: false,
    roundIndex: 0,
    score: 0,
    correct: 0,
    roundStartedAt: 0,
    elapsedActive: 0,
    results: []
  };
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(items, random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function pick(items, random) {
  return items[Math.floor(random() * items.length)];
}

function buildDailyRounds(key) {
  const random = seededRandom(hashString(`MinuteMix:${key}`));
  const colours = [
    { name: "Coral", value: "coral", hex: ACCENTS.coral },
    { name: "Blue", value: "blue", hex: ACCENTS.blue },
    { name: "Yellow", value: "yellow", hex: ACCENTS.yellow },
    { name: "Mint", value: "mint", hex: ACCENTS.mint }
  ];
  const colourWords = shuffled(colours, random);
  const displayedWord = colourWords[0];
  const inkColour = colourWords[1];

  const symbols = [
    { value: "circle", glyph: "\u25cf", spoken: "circle" },
    { value: "triangle", glyph: "\u25b2", spoken: "triangle" },
    { value: "square", glyph: "\u25a0", spoken: "square" },
    { value: "diamond", glyph: "\u25c6", spoken: "diamond" },
    { value: "star", glyph: "\u2605", spoken: "star" }
  ];
  const memorySequence = shuffled(symbols, random).slice(0, 4);
  const memoryAnswer = memorySequence[2];
  const memoryOptions = shuffled([memoryAnswer, ...shuffled(symbols.filter((item) => item.value !== memoryAnswer.value), random).slice(0, 3)], random);

  const targetCount = 4 + Math.floor(random() * 5);
  const countPattern = shuffled([
    ...Array.from({ length: targetCount }, () => true),
    ...Array.from({ length: 20 - targetCount }, () => false)
  ], random);
  const countChoices = new Set([targetCount, targetCount + 1, Math.max(1, targetCount - 1), targetCount + 2]);
  while (countChoices.size < 4) countChoices.add(targetCount + countChoices.size);

  const triviaBank = [
    { question: "Which city famously sits in both Europe and Asia?", answer: "Istanbul", options: ["Istanbul", "Lisbon", "Cairo", "Vienna"] },
    { question: "Which is the largest ocean on Earth?", answer: "Pacific", options: ["Pacific", "Atlantic", "Indian", "Arctic"] },
    { question: "What is the capital city of Japan?", answer: "Tokyo", options: ["Tokyo", "Kyoto", "Seoul", "Osaka"] },
    { question: "Which country is often described as boot-shaped?", answer: "Italy", options: ["Italy", "Greece", "Portugal", "Croatia"] },
    { question: "Which continent contains the South Pole?", answer: "Antarctica", options: ["Antarctica", "Australia", "Asia", "South America"] },
    { question: "What is the currency of Japan?", answer: "Yen", options: ["Yen", "Won", "Baht", "Rupee"] },
    { question: "Which planet is known as the Red Planet?", answer: "Mars", options: ["Mars", "Venus", "Jupiter", "Mercury"] },
    { question: "Which is the largest planet in our solar system?", answer: "Jupiter", options: ["Jupiter", "Saturn", "Neptune", "Earth"] },
    { question: "Which desert covers much of northern Africa?", answer: "Sahara", options: ["Sahara", "Gobi", "Atacama", "Kalahari"] },
    { question: "Which gas has the chemical symbol O?", answer: "Oxygen", options: ["Oxygen", "Gold", "Osmium", "Hydrogen"] }
  ];
  const trivia = pick(triviaBank, random);

  const wordBank = [
    { word: "SPARK", hint: "A bright idea can begin with one.", distractors: ["SPEAK", "SHARK", "SPRAY"] },
    { word: "BRAIN", hint: "Your puzzle-solving engine.", distractors: ["TRAIN", "BRAVE", "BRICK"] },
    { word: "SMILE", hint: "A very quick way to brighten a room.", distractors: ["SLIDE", "STYLE", "SMALL"] },
    { word: "QUICK", hint: "Exactly how this game moves.", distractors: ["QUIET", "QUILT", "CLICK"] },
    { word: "MUSIC", hint: "Rhythm, melody, and sound.", distractors: ["MAGIC", "MOUSE", "BASIC"] },
    { word: "LOGIC", hint: "Reasoning that connects the clues.", distractors: ["LOCAL", "LIGHT", "COMIC"] },
    { word: "DREAM", hint: "An idea with its eyes closed.", distractors: ["CREAM", "DRAMA", "STEAM"] }
  ];
  const wordRound = pick(wordBank, random);
  let scrambled = shuffled(wordRound.word.split(""), random).join("");
  if (scrambled === wordRound.word) scrambled = `${wordRound.word.slice(1)}${wordRound.word[0]}`;

  return [
    {
      type: "colour",
      accent: ACCENTS.coral,
      name: ROUND_LABELS[0],
      title: "What colour is the ink?",
      instruction: "Ignore the word itself and choose the colour you can see.",
      word: displayedWord.name.toUpperCase(),
      ink: inkColour.hex,
      answer: inkColour.value,
      options: shuffled(colours.map((colour) => ({ label: colour.name, value: colour.value, swatch: colour.hex })), random)
    },
    {
      type: "memory",
      accent: ACCENTS.blue,
      name: ROUND_LABELS[1],
      title: "Remember this order.",
      instruction: "You will be asked for the third symbol.",
      sequence: memorySequence,
      answer: memoryAnswer.value,
      options: memoryOptions.map((symbol) => ({ label: symbol.glyph, value: symbol.value, spoken: symbol.spoken, symbol: true }))
    },
    {
      type: "count",
      accent: ACCENTS.yellow,
      name: ROUND_LABELS[2],
      title: "How many coral circles?",
      instruction: "Scan the pattern once, then trust your count.",
      pattern: countPattern,
      answer: targetCount,
      options: shuffled([...countChoices].map((value) => ({ label: String(value), value })), random)
    },
    {
      type: "trivia",
      accent: ACCENTS.mint,
      name: ROUND_LABELS[3],
      title: "World snap.",
      instruction: "Choose the answer that lands first in your mind.",
      question: trivia.question,
      answer: trivia.answer,
      options: shuffled(trivia.options.map((value) => ({ label: value, value })), random)
    },
    {
      type: "word",
      accent: ACCENTS.plum,
      name: ROUND_LABELS[4],
      title: "Unscramble the word.",
      instruction: "Put the letters back into a familiar word.",
      scrambled,
      hint: wordRound.hint,
      answer: wordRound.word,
      options: shuffled([wordRound.word, ...wordRound.distractors].map((value) => ({ label: value, value })), random)
    }
  ];
}

function readProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (parsed && typeof parsed === "object") {
      return {
        lastPlayed: parsed.lastPlayed || "",
        streak: Number(parsed.streak) || 0,
        best: Number(parsed.best) || 0,
        daily: parsed.daily && typeof parsed.daily === "object" ? parsed.daily : {}
      };
    }
  } catch (error) {
    // Local play still works when storage is unavailable.
  }
  return { lastPlayed: "", streak: 0, best: 0, daily: {} };
}

function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (error) {
    // Ignore private-mode or quota failures.
  }
}

function readSoundPreference() {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch (error) {
    return true;
  }
}

function saveSoundPreference() {
  try {
    localStorage.setItem(SOUND_KEY, soundEnabled ? "on" : "off");
  } catch (error) {
    // Sound remains available for the current session.
  }
}

function daysBetween(fromKey, toKey) {
  if (!fromKey || !toKey) return 0;
  const [fromYear, fromMonth, fromDay] = fromKey.split("-").map(Number);
  const [toYear, toMonth, toDay] = toKey.split("-").map(Number);
  const from = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const to = Date.UTC(toYear, toMonth - 1, toDay);
  return Math.round((to - from) / 86400000);
}

function updateLobby() {
  const progress = readProgress();
  const todayResult = progress.daily[todayKey];
  headerDate.textContent = todayDisplay;
  lobbyStreak.textContent = `${progress.streak} ${progress.streak === 1 ? "day" : "days"}`;
  lobbyBest.textContent = String(progress.best);
  soundToggle.checked = soundEnabled;

  if (todayResult) {
    startButton.innerHTML = "Replay today&apos;s mix <span aria-hidden=\"true\">&#8635;</span>";
    playedNote.hidden = false;
    playedNote.textContent = `Today's best is ${todayResult.score}. Replays are just for fun.`;
  } else {
    startButton.innerHTML = "Play today&apos;s mix <span aria-hidden=\"true\">&#9654;</span>";
    playedNote.hidden = true;
  }
}

function updateResetCountdown() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const remaining = Math.max(0, midnight.getTime() - now.getTime());
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  resetCountdown.textContent = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function buildProgressUI() {
  progressDots.innerHTML = "";
  roundRailList.innerHTML = "";

  rounds.forEach((round, index) => {
    const dot = document.createElement("span");
    dot.className = "progress-dot";
    dot.setAttribute("aria-label", `Round ${index + 1}: ${round.name}`);
    dot.style.setProperty("--round-accent", round.accent);
    progressDots.appendChild(dot);

    const item = document.createElement("li");
    item.innerHTML = `<span>${String(index + 1).padStart(2, "0")}</span><strong>${round.name}</strong>`;
    item.style.setProperty("--round-accent", round.accent);
    roundRailList.appendChild(item);
  });
}

function showView(view) {
  [lobbyView, playView, resultView].forEach((candidate) => {
    candidate.hidden = candidate !== view;
  });
  window.scrollTo({ top: 0, behavior: "auto" });
}

function startGame() {
  clearGameTimers();
  gameState = freshGameState();
  gameState.isPlaying = true;
  liveScore.textContent = "0";
  correctCount.textContent = "0";
  shareStatus.textContent = "";
  showView(playView);
  renderRound();
  playTone("start");
  animationFrame = requestAnimationFrame(updateTimer);
}

function renderRound() {
  window.clearTimeout(memoryTimeout);
  const round = rounds[gameState.roundIndex];
  const now = performance.now();
  gameState.locked = false;
  gameState.roundStartedAt = now;
  playView.style.setProperty("--round-accent", round.accent);
  roundKicker.textContent = `Round ${gameState.roundIndex + 1} of 5 | ${round.name}`;
  roundTitle.textContent = round.title;
  roundInstruction.textContent = round.instruction;
  feedback.className = "feedback";
  feedback.textContent = "Stay sharp.";
  answerGrid.classList.remove("is-waiting");
  answerGrid.innerHTML = "";
  renderStimulus(round);
  updateProgressUI();

  if (round.type === "memory") {
    answerGrid.classList.add("is-waiting");
    memoryTimeout = window.setTimeout(() => {
      if (!gameState.isPlaying || gameState.roundIndex !== 1 || gameState.locked) return;
      roundTitle.textContent = "Which symbol was third?";
      roundInstruction.textContent = "Choose the third symbol from the sequence you just saw.";
      stimulus.innerHTML = '<div class="memory-cover">Sequence hidden.<br>Trust your first recall.</div>';
      answerGrid.classList.remove("is-waiting");
      renderAnswers(round);
      playTone("reveal");
    }, 1900);
  } else {
    renderAnswers(round);
  }
}

function renderStimulus(round) {
  stimulus.innerHTML = "";

  if (round.type === "colour") {
    const word = document.createElement("div");
    word.className = "stroop-word";
    word.style.color = round.ink;
    word.textContent = round.word;
    stimulus.appendChild(word);
    return;
  }

  if (round.type === "memory") {
    const sequence = document.createElement("div");
    sequence.className = "memory-sequence";
    const sequenceColours = [ACCENTS.yellow, ACCENTS.mint, ACCENTS.coral, ACCENTS.blue];
    round.sequence.forEach((symbol, index) => {
      const tile = document.createElement("span");
      tile.className = "memory-symbol";
      tile.style.setProperty("--symbol-accent", sequenceColours[index]);
      tile.textContent = symbol.glyph;
      tile.setAttribute("aria-label", `${index + 1}: ${symbol.spoken}`);
      sequence.appendChild(tile);
    });
    stimulus.appendChild(sequence);
    return;
  }

  if (round.type === "count") {
    const stage = document.createElement("div");
    stage.className = "count-stage";
    round.pattern.forEach((isTarget) => {
      const shape = document.createElement("span");
      shape.className = `count-shape${isTarget ? " is-target" : ""}`;
      shape.setAttribute("aria-hidden", "true");
      stage.appendChild(shape);
    });
    stimulus.appendChild(stage);
    return;
  }

  if (round.type === "trivia") {
    const stage = document.createElement("div");
    stage.className = "world-stage";
    stage.innerHTML = `<span class="world-symbol" aria-hidden="true">&#9678;</span><p>${round.question}</p>`;
    stimulus.appendChild(stage);
    return;
  }

  const stage = document.createElement("div");
  stage.className = "scramble-stage";
  const tiles = document.createElement("div");
  tiles.className = "letter-tiles";
  round.scrambled.split("").forEach((letter) => {
    const tile = document.createElement("span");
    tile.className = "letter-tile";
    tile.textContent = letter;
    tiles.appendChild(tile);
  });
  const hint = document.createElement("p");
  hint.className = "scramble-hint";
  hint.textContent = round.hint;
  stage.append(tiles, hint);
  stimulus.appendChild(stage);
}

function renderAnswers(round) {
  answerGrid.innerHTML = "";
  round.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.className = "answer-button";
    button.type = "button";
    button.dataset.correct = String(option.value === round.answer);
    const number = document.createElement("span");
    number.className = "answer-number";
    number.textContent = String(index + 1);
    button.appendChild(number);

    if (option.swatch) {
      const swatch = document.createElement("span");
      swatch.className = "answer-swatch";
      swatch.style.setProperty("--swatch", option.swatch);
      swatch.setAttribute("aria-hidden", "true");
      button.appendChild(swatch);
    }

    const label = document.createElement("span");
    label.className = option.symbol ? "answer-choice-symbol" : "answer-label";
    label.textContent = option.label;
    button.appendChild(label);
    button.setAttribute("aria-label", `${index + 1}. ${option.spoken || option.label}`);
    button.addEventListener("click", () => answerRound(option, button));
    answerGrid.appendChild(button);
  });
}

function answerRound(option, selectedButton) {
  if (!gameState.isPlaying || gameState.locked || answerGrid.classList.contains("is-waiting")) return;
  gameState.locked = true;
  const round = rounds[gameState.roundIndex];
  const elapsed = performance.now() - gameState.roundStartedAt;
  gameState.elapsedActive += Math.min(elapsed, ROUND_TIME_MS);
  const isCorrect = option.value === round.answer;
  const buttons = [...answerGrid.querySelectorAll("button")];
  buttons.forEach((button) => {
    button.disabled = true;
    if (button.dataset.correct === "true") button.classList.add("is-correct");
  });

  if (isCorrect) {
    const speedRatio = Math.max(0, 1 - elapsed / ROUND_TIME_MS);
    const points = 100 + Math.round(speedRatio * 100);
    gameState.score += points;
    gameState.correct += 1;
    selectedButton.classList.add("is-correct");
    feedback.className = "feedback is-positive";
    feedback.textContent = `Quick win. +${points} points.`;
    playTone("correct");
    vibrate(28);
  } else {
    selectedButton.classList.add("is-wrong");
    feedback.className = "feedback is-negative";
    feedback.textContent = `Not this time. The answer was ${answerLabel(round)}.`;
    playTone("wrong");
    vibrate([40, 35, 40]);
  }

  gameState.results.push({ correct: isCorrect, round: round.name });
  liveScore.textContent = String(gameState.score);
  correctCount.textContent = String(gameState.correct);
  updateProgressUI();
  transitionTimeout = window.setTimeout(advanceRound, 650);
}

function timeOutRound() {
  if (gameState.locked || !gameState.isPlaying) return;
  gameState.locked = true;
  window.clearTimeout(memoryTimeout);
  const round = rounds[gameState.roundIndex];
  gameState.elapsedActive += ROUND_TIME_MS;
  if (answerGrid.childElementCount === 0) renderAnswers(round);
  answerGrid.classList.remove("is-waiting");
  [...answerGrid.querySelectorAll("button")].forEach((button) => {
    button.disabled = true;
    if (button.dataset.correct === "true") button.classList.add("is-correct");
  });
  feedback.className = "feedback is-negative";
  feedback.textContent = `Time. The answer was ${answerLabel(round)}.`;
  gameState.results.push({ correct: false, round: round.name });
  playTone("wrong");
  updateProgressUI();
  transitionTimeout = window.setTimeout(advanceRound, 650);
}

function answerLabel(round) {
  const option = round.options.find((candidate) => candidate.value === round.answer);
  return option ? option.spoken || option.label : String(round.answer);
}

function advanceRound() {
  if (!gameState.isPlaying) return;
  gameState.roundIndex += 1;
  if (gameState.roundIndex >= rounds.length) {
    finishGame();
    return;
  }
  renderRound();
}

function updateTimer(now) {
  if (!gameState.isPlaying) return;
  const currentRoundElapsed = Math.min(ROUND_TIME_MS, now - gameState.roundStartedAt);
  const activeElapsed = gameState.elapsedActive + (gameState.locked ? 0 : currentRoundElapsed);
  const totalRemaining = Math.max(0, TOTAL_TIME_MS - activeElapsed);
  const currentRoundRemaining = Math.max(0, ROUND_TIME_MS - currentRoundElapsed);
  const totalSeconds = Math.ceil(totalRemaining / 1000);
  timerValue.textContent = String(totalSeconds);
  timerRing.style.setProperty("--timer-progress", String(totalRemaining / TOTAL_TIME_MS));
  timerRing.style.setProperty("--timer-color", totalRemaining <= ROUND_TIME_MS ? ACCENTS.coral : ACCENTS.blue);
  timerRing.setAttribute("aria-label", `${totalSeconds} seconds remaining`);
  roundTime.textContent = (currentRoundRemaining / 1000).toFixed(1);

  if (totalRemaining <= 0) {
    finishGame(true);
    return;
  }

  if (currentRoundRemaining <= 0 && !gameState.locked) timeOutRound();
  animationFrame = requestAnimationFrame(updateTimer);
}

function updateProgressUI() {
  [...progressDots.children].forEach((dot, index) => {
    dot.classList.toggle("is-current", index === gameState.roundIndex && gameState.isPlaying);
    dot.classList.toggle("is-complete", index < gameState.results.length);
  });
  [...roundRailList.children].forEach((item, index) => {
    item.classList.toggle("is-current", index === gameState.roundIndex && gameState.isPlaying);
    item.classList.toggle("is-complete", index < gameState.results.length);
  });
}

function finishGame(expired = false) {
  if (!gameState.isPlaying) return;
  gameState.isPlaying = false;
  clearGameTimers();
  while (gameState.results.length < rounds.length) {
    gameState.results.push({ correct: false, round: rounds[gameState.results.length].name });
  }

  const progress = readProgress();
  const previousResult = progress.daily[todayKey];
  if (progress.lastPlayed !== todayKey) {
    progress.streak = daysBetween(progress.lastPlayed, todayKey) === 1 ? progress.streak + 1 : 1;
    progress.lastPlayed = todayKey;
  }
  const bestToday = Math.max(previousResult ? previousResult.score : 0, gameState.score);
  progress.daily[todayKey] = { score: bestToday, correct: Math.max(previousResult ? previousResult.correct : 0, gameState.correct) };
  progress.best = Math.max(progress.best, gameState.score);
  saveProgress(progress);

  resultScore.textContent = String(gameState.score);
  resultDate.textContent = `${todayDisplay} | Today's MinuteMix`;
  resultCorrect.textContent = `${gameState.correct}/5`;
  resultStreak.textContent = `${progress.streak} ${progress.streak === 1 ? "day" : "days"}`;
  resultBest.textContent = String(progress.best);
  resultTitle.textContent = resultHeading(gameState.correct);
  resultMessage.textContent = expired
    ? "The final bell called time. Your next mix arrives tomorrow."
    : resultCopy(gameState.correct);
  renderResultMarks();
  updateLobby();
  showView(resultView);
  playTone("finish");
}

function resultHeading(correct) {
  if (correct === 5) return "Perfectly mixed.";
  if (correct === 4) return "Sharp blend.";
  if (correct === 3) return "Nicely mixed.";
  if (correct === 2) return "Good warm-up.";
  return "Tomorrow wants a rematch.";
}

function resultCopy(correct) {
  if (correct === 5) return "Five clean answers. That mix barely stood a chance.";
  if (correct >= 3) return "A lively result with room for one more clever day tomorrow.";
  return "Some days are quick, some are curious. Your streak has officially started.";
}

function renderResultMarks() {
  resultMarks.innerHTML = "";
  gameState.results.forEach((result, index) => {
    const mark = document.createElement("span");
    mark.className = `result-mark${result.correct ? " is-correct" : ""}`;
    mark.setAttribute("aria-label", `Round ${index + 1}: ${result.correct ? "correct" : "incorrect"}`);
    resultMarks.appendChild(mark);
  });
}

function shareResult() {
  const progress = readProgress();
  const marks = gameState.results.map((result) => result.correct ? "\u{1f7e9}" : "\u2b1c").join("");
  const text = [
    `MinuteMix | ${todayDisplay}`,
    marks,
    `${gameState.score}/1000 | ${gameState.correct}/5 | ${progress.streak}-day streak`,
    "Five tiny challenges. Fifteen seconds each."
  ].join("\n");

  if (typeof navigator.share === "function") {
    navigator.share({ title: "My MinuteMix result", text, url: window.location.href })
      .then(() => { shareStatus.textContent = "Result shared."; })
      .catch((error) => {
        if (!error || error.name !== "AbortError") copyResult(text);
      });
    return;
  }
  copyResult(text);
}

function copyResult(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    navigator.clipboard.writeText(text)
      .then(() => { shareStatus.textContent = "Result copied to your clipboard."; })
      .catch(() => { shareStatus.textContent = "Sharing is unavailable in this browser."; });
  } else {
    shareStatus.textContent = "Sharing is unavailable in this browser.";
  }
}

function playTone(type) {
  if (!soundEnabled) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === "suspended") audioContext.resume();

  const frequencies = {
    start: [330, 440],
    reveal: [520],
    correct: [520, 660],
    wrong: [220, 170],
    finish: [392, 523, 659]
  };
  const notes = frequencies[type] || [330];
  notes.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const startAt = audioContext.currentTime + index * 0.075;
    oscillator.type = type === "wrong" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.055, startAt + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.14);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.15);
  });
}

function vibrate(pattern) {
  if (typeof navigator.vibrate === "function") navigator.vibrate(pattern);
}

function clearGameTimers() {
  cancelAnimationFrame(animationFrame);
  window.clearTimeout(memoryTimeout);
  window.clearTimeout(transitionTimeout);
}

startButton.addEventListener("click", startGame);
replayButton.addEventListener("click", startGame);
shareButton.addEventListener("click", shareResult);
soundToggle.addEventListener("change", () => {
  soundEnabled = soundToggle.checked;
  saveSoundPreference();
  if (soundEnabled) playTone("reveal");
});

document.addEventListener("keydown", (event) => {
  if (gameState.isPlaying && /^[1-4]$/.test(event.key)) {
    const buttons = [...answerGrid.querySelectorAll("button:not(:disabled)")];
    const selected = buttons[Number(event.key) - 1];
    if (selected) {
      event.preventDefault();
      selected.click();
    }
  }

  if (event.key === "Enter" && document.activeElement === document.body) {
    if (!lobbyView.hidden) startGame();
    else if (!resultView.hidden) startGame();
  }
});

window.addEventListener("beforeunload", clearGameTimers);

buildProgressUI();
updateLobby();
updateResetCountdown();
window.setInterval(updateResetCountdown, 30000);
