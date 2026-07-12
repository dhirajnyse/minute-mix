const ROUND_TIME_MS = 15000;
const ROUNDS_PER_MIX = 5;
const TOTAL_TIME_MS = ROUND_TIME_MS * ROUNDS_PER_MIX;
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
const duelInviteView = document.querySelector("#duel-invite-view");
const playView = document.querySelector("#play-view");
const resultView = document.querySelector("#result-view");
const startButton = document.querySelector("#start-button");
const practiceButton = document.querySelector("#practice-button");
const createDuelButton = document.querySelector("#create-duel-button");
const startDuelButton = document.querySelector("#start-duel-button");
const duelHomeButton = document.querySelector("#duel-home-button");
const duelTargetScore = document.querySelector("#duel-target-score");
const replayButton = document.querySelector("#replay-button");
const modeSwitchButton = document.querySelector("#mode-switch-button");
const shareButton = document.querySelector("#share-button");
const soundToggle = document.querySelector("#sound-toggle");
const headerDate = document.querySelector("#header-date");
const lobbyStreak = document.querySelector("#lobby-streak");
const lobbyBest = document.querySelector("#lobby-best");
const playedNote = document.querySelector("#played-note");
const resetCountdown = document.querySelector("#reset-countdown");
const progressDots = document.querySelector("#progress-dots");
const roundRailList = document.querySelector("#round-rail-list");
const toolbarLabel = document.querySelector("#toolbar-label");
const roundRailLabel = document.querySelector("#round-rail-label");
const scoreLabel = document.querySelector("#score-label");
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
const resultEyebrow = document.querySelector("#result-eyebrow");
const resultDate = document.querySelector("#result-date");
const resultTitle = document.querySelector("#result-title");
const resultMessage = document.querySelector("#result-message");
const resultCorrect = document.querySelector("#result-correct");
const resultStreakLabel = document.querySelector("#result-streak-label");
const resultStreak = document.querySelector("#result-streak");
const resultBestLabel = document.querySelector("#result-best-label");
const resultBest = document.querySelector("#result-best");
const shareStatus = document.querySelector("#share-status");

const today = new Date();
const todayKey = dateKey(today);
const todayDisplay = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(today);
const dailyRounds = buildDailyRounds(todayKey);
const incomingDuel = readDuelChallenge();

let soundEnabled = readSoundPreference();
let audioContext = null;
let animationFrame = 0;
let memoryTimeout = 0;
let transitionTimeout = 0;
let practiceRun = 0;
let previousPracticeTypes = [];
let recentPracticeSignatures = [];
let activeDuel = incomingDuel;
let gameMode = "daily";
let rounds = dailyRounds;
let gameState = freshGameState(gameMode);

function freshGameState(mode = "daily", options = {}) {
  return {
    mode,
    sourceMode: options.sourceMode || mode,
    seed: options.seed || "",
    target: Number(options.target) || 0,
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

function readDuelChallenge() {
  const params = new URLSearchParams(window.location.search);
  const sourceMode = params.get("duel");
  const seed = params.get("seed") || "";
  const targetText = params.get("target") || "";
  const target = Number(targetText);
  const validSource = sourceMode === "daily" || sourceMode === "practice";
  const validSeed = seed.length > 0 && seed.length <= 120 && /^[a-zA-Z0-9:._-]+$/.test(seed);
  const validTarget = /^\d{1,4}$/.test(targetText) && Number.isInteger(target) && target >= 0 && target <= 1000;
  if (!validSource || !validSeed || !validTarget) return null;
  if (sourceMode === "daily" && !/^\d{4}-\d{2}-\d{2}$/.test(seed)) return null;
  return { sourceMode, seed, target };
}

function roundsForDuel(challenge) {
  return challenge.sourceMode === "daily"
    ? buildDailyRounds(challenge.seed)
    : buildPracticeRounds(challenge.seed);
}

function renderDuelInvite(challenge) {
  activeDuel = challenge;
  duelTargetScore.textContent = String(challenge.target);
  headerDate.textContent = "Friend duel";
  document.title = `MinuteMix Duel | Beat ${challenge.target}`;
  showView(duelInviteView);
}

function clearDuelUrl() {
  const cleanUrl = new URL(window.location.href);
  cleanUrl.search = "";
  cleanUrl.hash = "";
  window.history.replaceState({}, "", cleanUrl.toString());
  document.title = "MinuteMix | Daily Challenges, Practice, and Friend Duels";
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
    { question: "Which gas has the chemical symbol O?", answer: "Oxygen", options: ["Oxygen", "Gold", "Osmium", "Hydrogen"] },
    { question: "Which is the largest mammal on Earth?", answer: "Blue whale", options: ["Blue whale", "Elephant", "Giraffe", "Orca"] },
    { question: "What is the main language spoken in Brazil?", answer: "Portuguese", options: ["Portuguese", "Spanish", "French", "Italian"] },
    { question: "Which element uses the symbol Au?", answer: "Gold", options: ["Gold", "Silver", "Copper", "Argon"] },
    { question: "Which is the fastest land animal?", answer: "Cheetah", options: ["Cheetah", "Falcon", "Horse", "Leopard"] },
    { question: "Which city is home to the Eiffel Tower?", answer: "Paris", options: ["Paris", "Rome", "Brussels", "Madrid"] },
    { question: "Which continent has the most countries?", answer: "Africa", options: ["Africa", "Asia", "Europe", "South America"] },
    { question: "What gas do plants absorb from the air?", answer: "Carbon dioxide", options: ["Carbon dioxide", "Oxygen", "Helium", "Hydrogen"] },
    { question: "How many bones are in a typical adult human body?", answer: "206", options: ["206", "186", "226", "246"] }
  ];
  const trivia = pick(triviaBank, random);

  const wordBank = [
    { word: "SPARK", hint: "A bright idea can begin with one.", distractors: ["SPEAK", "SHARK", "SPRAY"] },
    { word: "BRAIN", hint: "Your puzzle-solving engine.", distractors: ["TRAIN", "BRAVE", "BRICK"] },
    { word: "SMILE", hint: "A very quick way to brighten a room.", distractors: ["SLIDE", "STYLE", "SMALL"] },
    { word: "QUICK", hint: "Exactly how this game moves.", distractors: ["QUIET", "QUILT", "CLICK"] },
    { word: "MUSIC", hint: "Rhythm, melody, and sound.", distractors: ["MAGIC", "MOUSE", "BASIC"] },
    { word: "LOGIC", hint: "Reasoning that connects the clues.", distractors: ["LOCAL", "LIGHT", "COMIC"] },
    { word: "DREAM", hint: "An idea with its eyes closed.", distractors: ["CREAM", "DRAMA", "STEAM"] },
    { word: "FOCUS", hint: "Attention aimed at one clear point.", distractors: ["FORCE", "FOUND", "LOCUS"] },
    { word: "LIGHT", hint: "It helps you see what is around you.", distractors: ["NIGHT", "RIGHT", "SIGHT"] },
    { word: "CLOCK", hint: "It keeps watch over the minutes.", distractors: ["CLICK", "BLOCK", "CLOAK"] },
    { word: "BRAVE", hint: "Ready to face something difficult.", distractors: ["BRAKE", "GRAVE", "BRACE"] },
    { word: "WATER", hint: "Clear, essential, and found in every ocean.", distractors: ["LATER", "WAFER", "WATCH"] },
    { word: "CLOUD", hint: "A soft-looking shape moving across the sky.", distractors: ["COULD", "CROWD", "CLOUT"] },
    { word: "THINK", hint: "What every puzzle quietly asks you to do.", distractors: ["THANK", "THICK", "THING"] },
    { word: "GLOBE", hint: "A small round model of our world.", distractors: ["GLOVE", "GLORY", "GLIDE"] }
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

function buildPracticeRounds(seed) {
  const random = seededRandom(hashString(`MinuteMix:practice:${seed}`));
  const pool = [
    ...buildDailyRounds(`practice:${seed}`),
    buildSequenceRound(random),
    buildOddRound(random),
    buildMathRound(random),
    buildLetterRound(random),
    buildDirectionRound(random),
    buildReverseRound(random)
  ];
  return shuffled(pool, random).slice(0, ROUNDS_PER_MIX);
}

function createFreshPracticeMix() {
  let seed = "";
  let selected = [];

  for (let attempt = 0; attempt < 500; attempt += 1) {
    seed = `${Date.now()}:${practiceRun += 1}`;
    selected = buildPracticeRounds(seed);
    const typesAreFresh = selected.every((round) => !previousPracticeTypes.includes(round.type));
    const puzzlesAreFresh = selected.map(practiceSignature).every((signature) => !recentPracticeSignatures.includes(signature));
    if (typesAreFresh && puzzlesAreFresh) break;
  }

  previousPracticeTypes = selected.map((round) => round.type);
  recentPracticeSignatures = [
    ...recentPracticeSignatures,
    ...selected.map(practiceSignature)
  ].slice(-(ROUNDS_PER_MIX * 3));
  return { rounds: selected, seed };
}

function buildSequenceRound(random) {
  const generators = [
    () => {
      const start = 2 + Math.floor(random() * 7);
      const step = 2 + Math.floor(random() * 5);
      return { values: Array.from({ length: 4 }, (_, index) => start + index * step), answer: start + 4 * step };
    },
    () => {
      const start = 2 + Math.floor(random() * 4);
      return { values: Array.from({ length: 4 }, (_, index) => start * (2 ** index)), answer: start * 16 };
    },
    () => {
      const start = 2 + Math.floor(random() * 6);
      return { values: [start, start + 3, start + 2, start + 5], answer: start + 4 };
    },
    () => {
      const start = 1 + Math.floor(random() * 3);
      return { values: Array.from({ length: 4 }, (_, index) => (start + index) ** 2), answer: (start + 4) ** 2 };
    }
  ];
  const sequence = pick(generators, random)();
  return {
    type: "sequence",
    accent: ACCENTS.blue,
    name: "Sequence Sprint",
    title: "What comes next?",
    instruction: "Spot the number pattern and complete the sequence.",
    sequence: [...sequence.values, "?"],
    answer: sequence.answer,
    options: numberOptions(sequence.answer, random)
  };
}

function buildOddRound(random) {
  const bank = [
    { items: ["Mercury", "Venus", "Mars", "Orion"], answer: "Orion" },
    { items: ["Copper", "Silver", "Gold", "Granite"], answer: "Granite" },
    { items: ["Triangle", "Square", "Circle", "Cube"], answer: "Cube" },
    { items: ["January", "March", "May", "Tuesday"], answer: "Tuesday" },
    { items: ["Falcon", "Eagle", "Hawk", "Dolphin"], answer: "Dolphin" },
    { items: ["Violin", "Cello", "Harp", "Trumpet"], answer: "Trumpet" },
    { items: ["Ruby", "Emerald", "Sapphire", "Marble"], answer: "Marble" },
    { items: ["Cairo", "Tokyo", "Lima", "Amazon"], answer: "Amazon" }
  ];
  const puzzle = pick(bank, random);
  return {
    type: "odd",
    accent: ACCENTS.mint,
    name: "Odd One Out",
    title: "Which one breaks the group?",
    instruction: "Three choices belong together. Find the outsider.",
    answer: puzzle.answer,
    options: shuffled(puzzle.items.map((value) => ({ label: value, value })), random)
  };
}

function buildMathRound(random) {
  const generators = [
    () => {
      const first = 6 + Math.floor(random() * 10);
      const second = 4 + Math.floor(random() * 9);
      const third = 2 + Math.floor(random() * 7);
      return { expression: `${first} + ${second} - ${third}`, answer: first + second - third };
    },
    () => {
      const first = 3 + Math.floor(random() * 7);
      const second = 2 + Math.floor(random() * 6);
      const third = 1 + Math.floor(random() * 5);
      return { expression: `${first} x ${second} - ${third}`, answer: first * second - third };
    },
    () => {
      const first = 3 + Math.floor(random() * 7);
      const second = 2 + Math.floor(random() * 6);
      const multiplier = 2 + Math.floor(random() * 3);
      return { expression: `(${first} + ${second}) x ${multiplier}`, answer: (first + second) * multiplier };
    }
  ];
  const puzzle = pick(generators, random)();
  return {
    type: "math",
    accent: ACCENTS.yellow,
    name: "Number Dash",
    title: "Solve the quick calculation.",
    instruction: "Work it through once and choose the result.",
    expression: puzzle.expression,
    answer: puzzle.answer,
    options: numberOptions(puzzle.answer, random)
  };
}

function buildLetterRound(random) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const step = 2 + Math.floor(random() * 3);
  const maxStart = alphabet.length - 1 - step * 4;
  const start = Math.floor(random() * (maxStart + 1));
  const values = Array.from({ length: 4 }, (_, index) => alphabet[start + index * step]);
  const answer = alphabet[start + 4 * step];
  return {
    type: "letters",
    accent: ACCENTS.plum,
    name: "Letter Leap",
    title: "Which letter comes next?",
    instruction: "Follow the alphabet jump and finish the sequence.",
    sequence: [...values, "?"],
    answer,
    options: letterOptions(answer, random)
  };
}

function buildDirectionRound(random) {
  const directions = ["North", "East", "South", "West"];
  const turns = [
    { delta: 1, text: "Turn right once." },
    { delta: -1, text: "Turn left once." },
    { delta: 2, text: "Turn around." },
    { delta: 2, text: "Turn right twice." },
    { delta: -2, text: "Turn left twice." },
    { delta: 3, text: "Turn right, then turn around." },
    { delta: 1, text: "Turn left, then turn around." }
  ];
  const startIndex = Math.floor(random() * directions.length);
  const turn = pick(turns, random);
  const answerIndex = (startIndex + turn.delta + directions.length * 2) % directions.length;
  return {
    type: "direction",
    accent: ACCENTS.coral,
    name: "Compass Turn",
    title: "Where are you facing?",
    instruction: "Begin at the shown direction, then follow the turn.",
    start: directions[startIndex],
    startIndex,
    turn: turn.text,
    answer: directions[answerIndex],
    options: shuffled(directions.map((value) => ({ label: value, value })), random)
  };
}

function buildReverseRound(random) {
  const bank = [
    { word: "PLANET", distractors: ["PLANTS", "PLATES", "PLENTY"] },
    { word: "BRIGHT", distractors: ["BRIDGE", "RIGHTS", "BIRTHS"] },
    { word: "MARKET", distractors: ["MAKER", "MASTER", "MAGNET"] },
    { word: "PUZZLE", distractors: ["BUNDLE", "MUSCLE", "PURPLE"] },
    { word: "SILVER", distractors: ["RIVER", "LIVER", "SOLVER"] },
    { word: "WINDOW", distractors: ["WONDER", "WINTER", "WIDOW"] },
    { word: "ENERGY", distractors: ["ENJOY", "ENTRY", "ENEMY"] },
    { word: "CAMERA", distractors: ["CAMPER", "CAREER", "CANDLE"] }
  ];
  const puzzle = pick(bank, random);
  return {
    type: "reverse",
    accent: ACCENTS.mint,
    name: "Reverse Relay",
    title: "Read it in reverse.",
    instruction: "Flip the letter order and choose the original word.",
    reversed: puzzle.word.split("").reverse().join(""),
    answer: puzzle.word,
    options: shuffled([puzzle.word, ...puzzle.distractors].map((value) => ({ label: value, value })), random)
  };
}

function letterOptions(answer, random) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const answerIndex = alphabet.indexOf(answer);
  const values = new Set([answer]);
  shuffled([-4, -3, -2, -1, 1, 2, 3, 4], random).forEach((offset) => {
    const index = answerIndex + offset;
    if (values.size < 4 && index >= 0 && index < alphabet.length) values.add(alphabet[index]);
  });
  return shuffled([...values].map((value) => ({ label: value, value })), random);
}

function practiceSignature(round) {
  const sequence = (round.sequence || []).map((value) => value.value || value).join("");
  const pattern = (round.pattern || []).map((value) => value ? "1" : "0").join("");
  return [
    round.type,
    round.word || "",
    round.ink || "",
    round.scrambled || "",
    round.reversed || "",
    round.question || "",
    round.expression || "",
    round.start || "",
    round.turn || "",
    sequence,
    pattern,
    String(round.answer)
  ].join("|");
}

function numberOptions(answer, random) {
  const values = new Set([answer]);
  const offsets = shuffled([-6, -4, -3, -2, -1, 1, 2, 3, 4, 6], random);
  offsets.forEach((offset) => {
    if (values.size < 4 && answer + offset >= 0) values.add(answer + offset);
  });
  return shuffled([...values].map((value) => ({ label: String(value), value })), random);
}

function readProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (parsed && typeof parsed === "object") {
      return {
        lastPlayed: parsed.lastPlayed || "",
        streak: Number(parsed.streak) || 0,
        best: Number(parsed.best) || 0,
        practiceBest: Number(parsed.practiceBest) || 0,
        daily: parsed.daily && typeof parsed.daily === "object" ? parsed.daily : {}
      };
    }
  } catch (error) {
    // Local play still works when storage is unavailable.
  }
  return { lastPlayed: "", streak: 0, best: 0, practiceBest: 0, daily: {} };
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
    playedNote.textContent = `Today's best is ${todayResult.score}. Practice is always fresh.`;
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
  resetCountdown.textContent = `${hours}h ${minutes}m`;
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
  [lobbyView, duelInviteView, playView, resultView].forEach((candidate) => {
    candidate.hidden = candidate !== view;
  });
  window.scrollTo({ top: 0, behavior: "auto" });
}

function startGame(mode = "daily", challenge = activeDuel) {
  clearGameTimers();
  gameMode = mode;
  let seed = todayKey;
  let sourceMode = "daily";
  let target = 0;

  if (mode === "practice" || mode === "host") {
    const freshMix = createFreshPracticeMix();
    rounds = freshMix.rounds;
    seed = freshMix.seed;
    sourceMode = "practice";
  } else if (mode === "duel") {
    if (!challenge) {
      showDailyLobby();
      return;
    }
    activeDuel = challenge;
    rounds = roundsForDuel(challenge);
    seed = challenge.seed;
    sourceMode = challenge.sourceMode;
    target = challenge.target;
  } else {
    rounds = dailyRounds;
  }

  gameState = freshGameState(mode, { seed, sourceMode, target });
  gameState.isPlaying = true;
  liveScore.textContent = "0";
  correctCount.textContent = "0";
  shareStatus.textContent = "";
  toolbarLabel.textContent = mode === "duel" ? "Friend duel" : mode === "host" ? "Duel builder" : mode === "practice" ? "Practice mix" : "Today's mix";
  roundRailLabel.textContent = mode === "duel" ? "Same five rounds" : mode === "host" ? "Set the target" : mode === "practice" ? "Fresh practice" : "Five rounds";
  scoreLabel.textContent = mode === "duel" ? `Score / ${target}` : mode === "host" ? "Target score" : "Score";
  if (mode === "host") headerDate.textContent = "Duel builder";
  buildProgressUI();
  showView(playView);
  renderRound();
  playTone("start");
  animationFrame = requestAnimationFrame(updateTimer);
}

function renderRound() {
  window.clearTimeout(memoryTimeout);
  const round = rounds[gameState.roundIndex];
  const activeRoundIndex = gameState.roundIndex;
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
      if (!gameState.isPlaying || gameState.roundIndex !== activeRoundIndex || gameState.locked) return;
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

  if (round.type === "sequence" || round.type === "letters") {
    const stage = document.createElement("div");
    stage.className = `sequence-stage${round.type === "letters" ? " is-letters" : ""}`;
    round.sequence.forEach((value) => {
      const tile = document.createElement("span");
      tile.className = `sequence-tile${value === "?" ? " is-missing" : ""}`;
      tile.textContent = String(value);
      stage.appendChild(tile);
    });
    stimulus.appendChild(stage);
    return;
  }

  if (round.type === "direction") {
    const stage = document.createElement("div");
    stage.className = "direction-stage";
    const compass = document.createElement("div");
    compass.className = "compass-face";
    compass.innerHTML = '<span class="compass-north">N</span><span class="compass-east">E</span><span class="compass-south">S</span><span class="compass-west">W</span>';
    const pointer = document.createElement("span");
    pointer.className = "compass-pointer";
    pointer.style.setProperty("--compass-rotation", `${round.startIndex * 90}deg`);
    pointer.textContent = "\u2191";
    compass.appendChild(pointer);
    const copy = document.createElement("div");
    const start = document.createElement("strong");
    start.textContent = `Start ${round.start}`;
    const turn = document.createElement("p");
    turn.textContent = round.turn;
    copy.append(start, turn);
    stage.append(compass, copy);
    stimulus.appendChild(stage);
    return;
  }

  if (round.type === "odd") {
    const stage = document.createElement("div");
    stage.className = "logic-stage";
    const badge = document.createElement("span");
    badge.className = "logic-badge";
    badge.textContent = "1/4";
    const copy = document.createElement("p");
    copy.textContent = "One choice does not belong with the other three.";
    stage.append(badge, copy);
    stimulus.appendChild(stage);
    return;
  }

  if (round.type === "math") {
    const stage = document.createElement("div");
    stage.className = "math-stage";
    stage.textContent = `${round.expression} = ?`;
    stimulus.appendChild(stage);
    return;
  }

  if (round.type === "reverse") {
    const stage = document.createElement("div");
    stage.className = "scramble-stage reverse-stage";
    const tiles = document.createElement("div");
    tiles.className = "letter-tiles";
    round.reversed.split("").forEach((letter) => {
      const tile = document.createElement("span");
      tile.className = "letter-tile";
      tile.textContent = letter;
      tiles.appendChild(tile);
    });
    const hint = document.createElement("p");
    hint.className = "scramble-hint";
    hint.textContent = "Read from right to left.";
    stage.append(tiles, hint);
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
  const isPractice = gameState.mode === "practice";
  const isDuel = gameState.mode === "duel";
  const isHost = gameState.mode === "host";
  if (gameState.mode === "daily") {
    const previousResult = progress.daily[todayKey];
    if (progress.lastPlayed !== todayKey) {
      progress.streak = daysBetween(progress.lastPlayed, todayKey) === 1 ? progress.streak + 1 : 1;
      progress.lastPlayed = todayKey;
    }
    const bestToday = Math.max(previousResult ? previousResult.score : 0, gameState.score);
    progress.daily[todayKey] = { score: bestToday, correct: Math.max(previousResult ? previousResult.correct : 0, gameState.correct) };
    progress.best = Math.max(progress.best, gameState.score);
  } else if (isPractice) {
    progress.practiceBest = Math.max(progress.practiceBest, gameState.score);
  }
  saveProgress(progress);

  resultView.dataset.mode = gameState.mode;
  resultScore.textContent = String(gameState.score);
  resultCorrect.textContent = `${gameState.correct}/${ROUNDS_PER_MIX}`;

  if (isDuel) {
    const outcome = duelOutcome(gameState.score, gameState.target);
    resultEyebrow.textContent = "Duel complete";
    resultDate.textContent = `Friend duel | Target ${gameState.target}`;
    resultStreakLabel.textContent = "Target score";
    resultStreak.textContent = String(gameState.target);
    resultBestLabel.textContent = "Outcome";
    resultBest.textContent = outcome.label;
    resultTitle.textContent = outcome.title;
    resultMessage.textContent = expired ? `Time called. ${outcome.copy}` : outcome.copy;
    shareButton.innerHTML = "Challenge back <span aria-hidden=\"true\">&#8599;</span>";
    replayButton.innerHTML = "Retry duel <span aria-hidden=\"true\">&#8635;</span>";
    modeSwitchButton.innerHTML = "Daily home <span aria-hidden=\"true\">&#8592;</span>";
  } else if (isHost) {
    resultEyebrow.textContent = "Challenge ready";
    resultDate.textContent = `MinuteMix Duel | Target ${gameState.score}`;
    resultStreakLabel.textContent = "Score to beat";
    resultStreak.textContent = String(gameState.score);
    resultBestLabel.textContent = "Status";
    resultBest.textContent = "Ready";
    resultTitle.textContent = "Set the score to beat.";
    resultMessage.textContent = expired
      ? "Time called. Your exact five rounds are still ready to share as a duel."
      : "Your exact five rounds are locked in. Send the duel and see who can top your score.";
    shareButton.innerHTML = "Send duel <span aria-hidden=\"true\">&#8599;</span>";
    replayButton.innerHTML = "Build another <span aria-hidden=\"true\">&#8635;</span>";
    modeSwitchButton.innerHTML = "Daily home <span aria-hidden=\"true\">&#8592;</span>";
  } else {
    resultEyebrow.textContent = isPractice ? "Practice complete" : "Mix complete";
    resultDate.textContent = isPractice ? "Fresh practice | MinuteMix" : `${todayDisplay} | Today's MinuteMix`;
    resultStreakLabel.textContent = isPractice ? "Mode" : "Daily streak";
    resultStreak.textContent = isPractice ? "Practice" : `${progress.streak} ${progress.streak === 1 ? "day" : "days"}`;
    resultBestLabel.textContent = isPractice ? "Practice best" : "Best score";
    resultBest.textContent = String(isPractice ? progress.practiceBest : progress.best);
    resultTitle.textContent = resultHeading(gameState.correct, gameState.mode);
    resultMessage.textContent = expired
      ? isPractice
        ? "The final bell called time. A fresh practice mix is ready when you are."
        : "The final bell called time. Your next mix arrives tomorrow."
      : resultCopy(gameState.correct, gameState.mode);
    shareButton.innerHTML = "Challenge a friend <span aria-hidden=\"true\">&#8599;</span>";
    replayButton.innerHTML = isPractice
      ? "Another fresh mix <span aria-hidden=\"true\">&#8635;</span>"
      : "Fresh mix <span aria-hidden=\"true\">&#8635;</span>";
    modeSwitchButton.innerHTML = isPractice
      ? "Daily home <span aria-hidden=\"true\">&#8592;</span>"
      : "Replay today&apos;s mix <span aria-hidden=\"true\">&#8635;</span>";
  }
  renderResultMarks();
  updateLobby();
  showView(resultView);
  playTone("finish");
}

function duelOutcome(score, target) {
  const gap = Math.abs(score - target);
  if (score > target) {
    return {
      label: `Won +${gap}`,
      title: "You won the duel.",
      copy: `You cleared the target by ${gap} points. Send the challenge back and raise the stakes.`
    };
  }
  if (score === target) {
    return {
      label: "Tie",
      title: "Dead heat.",
      copy: "Exactly level. Challenge back and let the rematch settle it."
    };
  }
  return {
    label: `${gap} short`,
    title: "So close.",
    copy: `You finished ${gap} points behind the target. The same five are ready for another try.`
  };
}

function resultHeading(correct, mode) {
  if (mode === "practice") {
    if (correct === 5) return "Practice mastered.";
    if (correct === 4) return "Sharp practice.";
    if (correct === 3) return "Nicely mixed.";
    if (correct === 2) return "Warming up.";
    return "Ready for another?";
  }
  if (correct === 5) return "Perfectly mixed.";
  if (correct === 4) return "Sharp blend.";
  if (correct === 3) return "Nicely mixed.";
  if (correct === 2) return "Good warm-up.";
  return "Tomorrow wants a rematch.";
}

function resultCopy(correct, mode) {
  if (mode === "practice") {
    if (correct === 5) return "Five clean answers. Your next fresh mix is one click away.";
    if (correct >= 3) return "A sharp practice run. Try another mix and chase that personal best.";
    return "A useful warm-up. Every new practice mix brings a different combination.";
  }
  if (correct === 5) return "Five clean answers. That mix barely stood a chance.";
  if (correct >= 3) return "A lively daily result. A fresh practice mix is ready when you are.";
  return "Some days are quick, some are curious. Try a fresh mix and keep moving.";
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
  const marks = gameState.results.map((result) => result.correct ? "\u{1f7e9}" : "\u2b1c").join("");
  const challengeUrl = buildChallengeUrl();
  if (!challengeUrl) {
    shareStatus.textContent = "This challenge link could not be prepared.";
    return;
  }
  const shareHeading = gameState.mode === "duel"
    ? "MinuteMix Duel | Challenge back"
    : gameState.mode === "host" ? "MinuteMix Duel | Score to beat" : "MinuteMix Duel | Challenge a friend";
  const text = [
    shareHeading,
    marks,
    `I scored ${gameState.score}/1000 with ${gameState.correct}/5 correct.`,
    "Can you beat it on the exact same five challenges?"
  ].join("\n");

  if (typeof navigator.share === "function") {
    navigator.share({ title: "MinuteMix Duel", text, url: challengeUrl })
      .then(() => { shareStatus.textContent = "Challenge shared."; })
      .catch((error) => {
        if (!error || error.name !== "AbortError") copyResult(`${text}\n${challengeUrl}`);
      });
    return;
  }
  copyResult(`${text}\n${challengeUrl}`);
}

function buildChallengeUrl() {
  if (!gameState.seed) return "";
  const sourceMode = gameState.mode === "daily"
    ? "daily"
    : gameState.sourceMode === "daily" ? "daily" : "practice";
  const challengeUrl = new URL(window.location.href);
  challengeUrl.search = "";
  challengeUrl.hash = "";
  challengeUrl.searchParams.set("duel", sourceMode);
  challengeUrl.searchParams.set("seed", gameState.seed);
  challengeUrl.searchParams.set("target", String(gameState.score));
  return challengeUrl.toString();
}

function copyResult(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    navigator.clipboard.writeText(text)
      .then(() => { shareStatus.textContent = "Challenge link copied to your clipboard."; })
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

function showDailyLobby() {
  clearGameTimers();
  clearDuelUrl();
  activeDuel = null;
  gameMode = "daily";
  rounds = dailyRounds;
  gameState = freshGameState("daily");
  buildProgressUI();
  updateLobby();
  showView(lobbyView);
}

startButton.addEventListener("click", () => startGame("daily"));
practiceButton.addEventListener("click", () => startGame("practice"));
createDuelButton.addEventListener("click", () => startGame("host"));
startDuelButton.addEventListener("click", () => startGame("duel", activeDuel));
duelHomeButton.addEventListener("click", showDailyLobby);
replayButton.addEventListener("click", () => {
  if (gameMode === "duel") {
    startGame("duel", {
      sourceMode: gameState.sourceMode,
      seed: gameState.seed,
      target: gameState.target
    });
  } else if (gameMode === "host") {
    startGame("host");
  } else {
    startGame("practice");
  }
});
modeSwitchButton.addEventListener("click", () => {
  if (gameMode === "practice" || gameMode === "duel" || gameMode === "host") showDailyLobby();
  else startGame("daily");
});
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
    if (!lobbyView.hidden) startGame("daily");
    else if (!duelInviteView.hidden) startGame("duel", activeDuel);
    else if (!resultView.hidden) {
      if (gameMode === "duel") {
        startGame("duel", {
          sourceMode: gameState.sourceMode,
          seed: gameState.seed,
          target: gameState.target
        });
      } else if (gameMode === "host") {
        startGame("host");
      } else {
        startGame("practice");
      }
    }
  }
});

window.addEventListener("beforeunload", clearGameTimers);

buildProgressUI();
updateLobby();
updateResetCountdown();
window.setInterval(updateResetCountdown, 30000);
if (incomingDuel) renderDuelInvite(incomingDuel);
