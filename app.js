const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const STORAGE_KEY = "toeic-adaptive-oxford-3000:v1";

const vocab = (window.VOCAB_DATA || []).map((entry, index) => ({
  ...entry,
  id: `${entry.level}|${entry.word}|${entry.pos}|${entry.meaning}|${index}`,
}));

const byId = new Map(vocab.map((entry) => [entry.id, entry]));
const byLevel = LEVELS.reduce((acc, level) => {
  acc[level] = vocab.filter((entry) => entry.level === level);
  return acc;
}, {});

const elements = {
  levelSelector: document.querySelector("#levelSelector"),
  modePill: document.querySelector("#modePill"),
  reviewButton: document.querySelector("#reviewButton"),
  savedReviewButton: document.querySelector("#savedReviewButton"),
  resetButton: document.querySelector("#resetButton"),
  saveButton: document.querySelector("#saveButton"),
  wordPos: document.querySelector("#wordPos"),
  wordText: document.querySelector("#wordText"),
  answerGrid: document.querySelector("#answerGrid"),
  feedbackText: document.querySelector("#feedbackText"),
  nextButton: document.querySelector("#nextButton"),
  scoreValue: document.querySelector("#scoreValue"),
  accuracyValue: document.querySelector("#accuracyValue"),
  levelValue: document.querySelector("#levelValue"),
  learnedValue: document.querySelector("#learnedValue"),
  levelAccuracyValue: document.querySelector("#levelAccuracyValue"),
  levelAccuracyMeter: document.querySelector("#levelAccuracyMeter"),
  weakWordsList: document.querySelector("#weakWordsList"),
  weakCount: document.querySelector("#weakCount"),
  savedWordsList: document.querySelector("#savedWordsList"),
  savedCount: document.querySelector("#savedCount"),
};

const state = loadState();
let currentQuestion = null;
let answered = false;

init();

function init() {
  renderLevelSelector();
  bindEvents();
  renderQuestion();
  renderDashboard();
}

function loadState() {
  const fallback = {
    memory: {},
    savedWords: [],
    wrongWords: [],
    userStats: {
      score: 0,
      correct: 0,
      totalAnswered: 0,
      currentLevel: "A1",
      mode: "adaptive",
      levelStats: {},
    },
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return fallback;
    return {
      ...fallback,
      ...saved,
      userStats: { ...fallback.userStats, ...(saved.userStats || {}) },
    };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function bindEvents() {
  elements.nextButton.addEventListener("click", renderQuestion);
  elements.saveButton.addEventListener("click", toggleSavedWord);
  elements.reviewButton.addEventListener("click", () => setMode(state.userStats.mode === "review" ? "adaptive" : "review"));
  elements.savedReviewButton.addEventListener("click", () => setMode(state.userStats.mode === "saved" ? "adaptive" : "saved"));
  elements.resetButton.addEventListener("click", resetProgress);
}

function renderLevelSelector() {
  elements.levelSelector.innerHTML = "";
  LEVELS.forEach((level) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "level-button";
    button.textContent = level;
    button.disabled = byLevel[level].length === 0;
    button.title = button.disabled ? "No source data in the provided PDF" : `${byLevel[level].length} words`;
    button.classList.toggle("is-active", state.userStats.currentLevel === level);
    button.addEventListener("click", () => {
      state.userStats.currentLevel = level;
      state.userStats.mode = "adaptive";
      saveState();
      renderLevelSelector();
      renderQuestion();
      renderDashboard();
    });
    elements.levelSelector.appendChild(button);
  });
}

function setMode(mode) {
  state.userStats.mode = mode;
  saveState();
  renderQuestion();
  renderDashboard();
}

function renderQuestion() {
  const entry = selectEntry();
  answered = false;
  elements.nextButton.disabled = true;
  elements.answerGrid.innerHTML = "";

  if (!entry) {
    currentQuestion = null;
    elements.wordPos.textContent = state.userStats.currentLevel;
    elements.wordText.textContent = "ไม่มีคำในชุดนี้";
    elements.feedbackText.textContent = "เปลี่ยน level หรือกลับ Adaptive";
    updateModeControls();
    updateSaveButton();
    return;
  }

  currentQuestion = {
    entry,
    choices: buildChoices(entry),
  };

  elements.wordPos.textContent = `${entry.pos || "-"} · ${entry.level}`;
  elements.wordText.textContent = entry.word;
  elements.feedbackText.textContent = "เลือกคำตอบที่ถูกต้อง";

  currentQuestion.choices.forEach((choice, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-button";
    button.textContent = `${String.fromCharCode(65 + index)}. ${choice}`;
    button.addEventListener("click", () => answerQuestion(choice, button));
    elements.answerGrid.appendChild(button);
  });

  updateModeControls();
  updateSaveButton();
}

function selectEntry() {
  const pool = getActivePool();
  if (pool.length === 0) return null;

  const ranked = pool
    .map((entry) => ({ entry, rank: adaptiveRank(entry) }))
    .sort((a, b) => a.rank - b.rank || a.entry.word.localeCompare(b.entry.word));

  const top = ranked.slice(0, Math.min(6, ranked.length));
  const sameAsCurrent = top.findIndex((item) => item.entry.id === currentQuestion?.entry.id);
  if (sameAsCurrent === 0 && top.length > 1) {
    return top[1].entry;
  }
  return top[0].entry;
}

function getActivePool() {
  const mode = state.userStats.mode;
  if (mode === "saved") {
    return state.savedWords.map((id) => byId.get(id)).filter(Boolean);
  }

  if (mode === "review") {
    const wrong = new Set(state.wrongWords);
    const reviewPool = vocab.filter((entry) => wrong.has(entry.id) || getStrength(entry) < 0.6);
    return reviewPool.length ? reviewPool : byLevel[state.userStats.currentLevel];
  }

  return byLevel[state.userStats.currentLevel] || [];
}

function adaptiveRank(entry) {
  const memory = state.memory[entry.id];
  if (!memory || memory.correct + memory.wrong === 0) return 1;

  const strength = getStrength(entry);
  const hoursSinceSeen = memory.lastSeen ? (Date.now() - memory.lastSeen) / 36e5 : 999;
  const recentlyWrong = memory.lastWrongAt && Date.now() - memory.lastWrongAt < 12 * 36e5;

  if (strength < 0.6) return strength - (recentlyWrong ? 0.2 : 0);
  if (hoursSinceSeen > 24) return 2 - Math.min(hoursSinceSeen / 120, 0.8);
  return 3 + strength + Math.min(memory.correct + memory.wrong, 20) / 100;
}

function buildChoices(entry) {
  const distractorPool = uniqueByMeaning(
    byLevel[entry.level].filter((item) => item.id !== entry.id && item.meaning !== entry.meaning)
  );
  const fallbackPool = uniqueByMeaning(vocab.filter((item) => item.id !== entry.id && item.meaning !== entry.meaning));
  const choices = [entry.meaning];
  const source = distractorPool.length >= 2 ? shuffle(distractorPool) : shuffle(fallbackPool);

  for (const item of source) {
    if (choices.length === 3) break;
    if (!choices.includes(item.meaning)) choices.push(item.meaning);
  }

  return shuffle(choices);
}

function answerQuestion(selectedMeaning, selectedButton) {
  if (answered || !currentQuestion) return;
  answered = true;

  const entry = currentQuestion.entry;
  const correct = selectedMeaning === entry.meaning;
  const memory = ensureMemory(entry);

  memory.lastSeen = Date.now();
  if (correct) {
    memory.correct += 1;
    state.userStats.score += 1;
  } else {
    memory.wrong += 1;
    memory.lastWrongAt = Date.now();
  }
  memory.strength = calculateStrength(memory);

  state.userStats.totalAnswered += 1;
  state.userStats.correct += correct ? 1 : 0;
  updateLevelStats(entry.level, correct);
  updateWrongWords(entry.id, correct, memory.strength);

  [...elements.answerGrid.children].forEach((button) => {
    const rawChoice = button.textContent.replace(/^[A-C]\.\s/, "");
    button.disabled = true;
    if (rawChoice === entry.meaning) button.classList.add("correct");
  });
  if (!correct) selectedButton.classList.add("wrong");

  elements.feedbackText.textContent = correct ? "Correct +1" : `Wrong · ${entry.meaning}`;
  elements.nextButton.disabled = false;

  applyLevelProgression(entry.level);
  saveState();
  renderDashboard();
  updateSaveButton();
}

function ensureMemory(entry) {
  if (!state.memory[entry.id]) {
    state.memory[entry.id] = {
      word: entry.word,
      correct: 0,
      wrong: 0,
      strength: 0,
      lastSeen: null,
      lastWrongAt: null,
    };
  }
  return state.memory[entry.id];
}

function calculateStrength(memory) {
  const total = memory.correct + memory.wrong;
  return total === 0 ? 0 : memory.correct / total;
}

function getStrength(entry) {
  const memory = state.memory[entry.id];
  if (!memory || memory.correct + memory.wrong === 0) return 1;
  return calculateStrength(memory);
}

function updateWrongWords(id, correct, strength) {
  const wrong = new Set(state.wrongWords);
  if (!correct) {
    wrong.add(id);
  } else if (strength >= 0.7) {
    wrong.delete(id);
  }
  state.wrongWords = [...wrong];
}

function updateLevelStats(level, correct) {
  const stats = state.userStats.levelStats[level] || { answered: 0, correct: 0 };
  stats.answered += 1;
  stats.correct += correct ? 1 : 0;
  state.userStats.levelStats[level] = stats;
}

function applyLevelProgression(level) {
  if (state.userStats.mode !== "adaptive") return;

  const stats = state.userStats.levelStats[level];
  if (!stats || stats.answered < 10) return;

  const accuracy = stats.correct / stats.answered;
  const currentIndex = LEVELS.indexOf(level);
  const nextLevel = LEVELS.slice(currentIndex + 1).find((item) => byLevel[item].length > 0);
  const previousLevel = LEVELS.slice(0, currentIndex).reverse().find((item) => byLevel[item].length > 0);

  if (stats.answered >= 20 && accuracy > 0.8 && nextLevel) {
    state.userStats.currentLevel = nextLevel;
    elements.feedbackText.textContent = `Level up · ${nextLevel}`;
    renderLevelSelector();
  } else if (accuracy < 0.5 && state.wrongWords.length >= 3) {
    state.userStats.mode = "review";
    elements.feedbackText.textContent = "Review mode";
  } else if (accuracy < 0.5 && previousLevel) {
    state.userStats.currentLevel = previousLevel;
    elements.feedbackText.textContent = `Level down · ${previousLevel}`;
    renderLevelSelector();
  }
}

function toggleSavedWord() {
  if (!currentQuestion) return;
  const saved = new Set(state.savedWords);
  const id = currentQuestion.entry.id;
  if (saved.has(id)) {
    saved.delete(id);
  } else {
    saved.add(id);
  }
  state.savedWords = [...saved];
  saveState();
  updateSaveButton();
  renderDashboard();
}

function updateSaveButton() {
  const isSaved = currentQuestion && state.savedWords.includes(currentQuestion.entry.id);
  elements.saveButton.classList.toggle("is-saved", Boolean(isSaved));
  elements.saveButton.textContent = isSaved ? "★" : "☆";
}

function updateModeControls() {
  const mode = state.userStats.mode;
  elements.modePill.textContent = mode === "adaptive" ? "Adaptive" : mode === "review" ? "Review" : "Saved";
  elements.reviewButton.classList.toggle("is-active", mode === "review");
  elements.savedReviewButton.classList.toggle("is-active", mode === "saved");
}

function renderDashboard() {
  const stats = state.userStats;
  const accuracy = stats.totalAnswered ? stats.correct / stats.totalAnswered : 0;
  const levelStats = stats.levelStats[stats.currentLevel] || { answered: 0, correct: 0 };
  const levelAccuracy = levelStats.answered ? levelStats.correct / levelStats.answered : 0;
  const learned = Object.values(state.memory).filter((memory) => memory.correct + memory.wrong > 0).length;
  const weakEntries = getWeakEntries();
  const savedEntries = state.savedWords.map((id) => byId.get(id)).filter(Boolean).slice(0, 5);

  elements.scoreValue.textContent = stats.score;
  elements.accuracyValue.textContent = `${Math.round(accuracy * 100)}%`;
  elements.levelValue.textContent = stats.currentLevel;
  elements.learnedValue.textContent = learned;
  elements.levelAccuracyValue.textContent = `${Math.round(levelAccuracy * 100)}%`;
  elements.levelAccuracyMeter.style.width = `${Math.round(levelAccuracy * 100)}%`;
  elements.weakCount.textContent = weakEntries.length;
  elements.savedCount.textContent = state.savedWords.length;

  renderList(elements.weakWordsList, weakEntries.slice(0, 5), (entry) => {
    const strength = Math.round(getStrength(entry) * 100);
    return `${entry.word} (${entry.pos}) · ${strength}%`;
  });

  renderList(elements.savedWordsList, savedEntries, (entry) => `${entry.word} · ${entry.meaning}`);
  renderLevelSelector();
  updateModeControls();
}

function getWeakEntries() {
  return vocab
    .filter((entry) => {
      const memory = state.memory[entry.id];
      return memory && memory.correct + memory.wrong > 0 && calculateStrength(memory) < 0.65;
    })
    .sort((a, b) => getStrength(a) - getStrength(b));
}

function renderList(target, entries, formatter) {
  target.innerHTML = "";
  if (entries.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "ยังไม่มีข้อมูล";
    target.appendChild(empty);
    return;
  }
  entries.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = formatter(entry);
    target.appendChild(item);
  });
}

function resetProgress() {
  if (!window.confirm("Reset all local progress?")) return;
  localStorage.removeItem(STORAGE_KEY);
  Object.assign(state, loadState());
  currentQuestion = null;
  renderLevelSelector();
  renderQuestion();
  renderDashboard();
}

function uniqueByMeaning(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.meaning)) return false;
    seen.add(item.meaning);
    return true;
  });
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
