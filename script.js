let characters = [];

let rollHistory = [];
let keptCards = [];
let rollCount = 0;
let autoRolling = false;
let luck = 1;
let currentRoll = null;
let autoRollInterval = null;
let soundEnabled = true;
let isRolling = false;
let potionLuckMultiplier = 1;
let potionEndTime = 0;
let potionTimerInterval = null;
let discoveredCards = [];
let gold = 0;
let rollSpeedMultiplier = 1;
let speedPotionEndTime = 0;
let speedPotionTimerInterval = null;
let completedQuestIds = [];
let claimedQuestIds = [];
let questToastTimeout = null;

const SAVE_KEY = "rng_web_game_save_v4";

const imageBox = document.getElementById("imageBox");
const resultLabel = document.getElementById("resultLabel");
const counterLabel = document.getElementById("counterLabel");
const luckLabel = document.getElementById("luckLabel");
const bestLabel = document.getElementById("bestLabel");
const keptCountLabel = document.getElementById("keptCountLabel");
const rollButton = document.getElementById("rollButton");
const rollHistoryList = document.getElementById("rollHistoryList");
const keptCardsList = document.getElementById("keptCardsList");
const keepButton = document.getElementById("keepButton");
const rarityBadge = document.getElementById("rarityBadge");
const cardShell = document.getElementById("cardShell");
const toggleSoundButton = document.getElementById("toggleSoundButton");
const screenFlash = document.getElementById("screenFlash");
const rarityOverlay = document.getElementById("rarityOverlay");
const goldLabel = document.getElementById("goldLabel");
const galleryGrid = document.getElementById("galleryGrid");
const galleryProgressLabel = document.getElementById("galleryProgressLabel");
const shopSmallPotionButton = document.getElementById("shopSmallPotionButton");
const shopMediumPotionButton = document.getElementById("shopMediumPotionButton");
const shopBigPotionButton = document.getElementById("shopBigPotionButton");
const shopSpeedPotionButton = document.getElementById("shopSpeedPotionButton");
const buyLuckUpgradeButton = document.getElementById("buyLuckUpgradeButton");
const increaseLuckButton = document.getElementById("increaseLuckButton");
const questToast = document.getElementById("questToast");

let audioContext = null;
let holdLuckInterval = null;

let autoStopRarity = "mythic";

const RARITY_ORDER = [
  "mortal",
  "blessed",
  "astral",
  "ascended",
  "mythic",
  "divine",
  "ethereal",
  "celestial",
  "transcendant",
  "primordial",
  "cosmic",
  "eclipse"
];

function isRarityAtOrAbove(rolledRarity, thresholdRarity) {
  return (
    RARITY_ORDER.indexOf(rolledRarity) >= RARITY_ORDER.indexOf(thresholdRarity)
  );
}

const QUEST_POOL = [
  {
    type: "roll",
    title: "Roll 10 times",
    goal: 10,
    reward: { gold: 100 }
  },
  {
    type: "roll",
    title: "Roll 25 times",
    goal: 25,
    reward: { gold: 250 }
  },
  {
    type: "keep",
    title: "Keep 2 cards",
    goal: 2,
    reward: { gold: 150 }
  },
  {
    type: "keep",
    title: "Keep 5 cards",
    goal: 5,
    reward: { gold: 350 }
  },
  {
    type: "discover",
    title: "Discover 3 cards",
    goal: 3,
    reward: { luck: 1 }
  },
  {
    type: "discover",
    title: "Discover 5 cards",
    goal: 5,
    reward: { gold: 200 }
  }
];

let quests = [];

const questList = document.getElementById("questList");

function getCurrentQuestValue(type) {
  if (type === "roll") return rollCount;
  if (type === "keep") return keptCards.length;
  if (type === "discover") return discoveredCards.length;
  return 0;
}

function generateQuest() {
  const template = QUEST_POOL[Math.floor(Math.random() * QUEST_POOL.length)];

  return {
    id: `${template.type}_${template.goal}_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
    type: template.type,
    title: template.title,
    goal: template.goal,
    startValue: getCurrentQuestValue(template.type),
    reward: { ...template.reward },
    claimed: false
  };
}

function ensureQuestSlots() {
  while (quests.length < 3) {
    quests.push(generateQuest());
  }
}

function getQuestProgress(quest) {
  const currentValue = getCurrentQuestValue(quest.type);
  return Math.max(0, currentValue - (quest.startValue || 0));
}

function claimQuest(questId) {
  const index = quests.findIndex((quest) => quest.id === questId);
  if (index === -1) return;

  const quest = quests[index];
  const progress = getQuestProgress(quest);

  if (quest.claimed || progress < quest.goal) return;

  if (quest.reward.gold) {
    gold += quest.reward.gold;
  }

  if (quest.reward.luck) {
    luck += quest.reward.luck;
  }

  quest.claimed = true;
  completedQuestIds = completedQuestIds.filter((id) => id !== quest.id);
  claimedQuestIds.push(quest.id);

  const oldTitle = quest.title;
  quests[index] = generateQuest();

  updateStats();
  updateQuests();
  saveGame();
  showQuestToast(`Reward Claimed: ${oldTitle}`);
  resultLabel.textContent = `Claimed reward for: ${oldTitle}`;
}

function updateQuests() {
  if (!questList) return;

  ensureQuestSlots();
  questList.innerHTML = "";

  quests.forEach((quest) => {
    const progress = getQuestProgress(quest);
    const completed = progress >= quest.goal;

    checkQuestCompletion(quest);

    const div = document.createElement("div");
    div.className = "list-item";

    div.innerHTML = `
      <strong>${quest.title}</strong>
      <small>${Math.min(progress, quest.goal)} / ${quest.goal}</small>
    `;

    if (completed && !quest.claimed) {
      const btn = document.createElement("button");
      btn.textContent = "Claim";
      btn.addEventListener("click", () => claimQuest(quest.id));
      div.appendChild(btn);
    }

    questList.appendChild(div);
  });
}

function showQuestToast(message) {
  if (!questToast) return;

  questToast.textContent = message;
  questToast.classList.add("show");

  if (questToastTimeout) {
    clearTimeout(questToastTimeout);
  }

  questToastTimeout = setTimeout(() => {
    questToast.classList.remove("show");
  }, 2200);
}

function checkQuestCompletion(quest) {
  const progress = getQuestProgress(quest);
  const isComplete = progress >= quest.goal;

  if (isComplete && !quest.claimed && !completedQuestIds.includes(quest.id)) {
    completedQuestIds.push(quest.id);
    showQuestToast(`Quest Complete: ${quest.title}`);
  }
}

function isVideoFile(path) {
  return /\.(mp4|webm|ogg)$/i.test(path);
}

function getMediaPath(filename) {
  if (/^(https?:)?\/\//i.test(filename) || filename.includes("/")) {
    return filename;
  }

  return isVideoFile(filename) ? `videos/${filename}` : `images/${filename}`;
}

async function loadCharacters() {
  const response = await fetch("./cards.json");

  if (!response.ok) {
    throw new Error(`Failed to load cards.json (${response.status})`);
  }

  const data = await response.json();

  characters = data.map((card) => ({
    name: card.name,
    odds: card.odds,
    image: getMediaPath(card.image)
  }));
}

function formatOdds(odds) {
  return `1 in ${odds.toLocaleString()}`;
}

function getRarity(character) {
  const odds = character.odds;

  if (odds <= 50) return "mortal";
  if (odds <= 150) return "blessed";
  if (odds <= 4000) return "astral";
  if (odds <= 10000) return "ascended";
  if (odds <= 30000) return "mythic";
  if (odds <= 100000) return "divine";
  if (odds <= 200000) return "ethereal";
  if (odds <= 300000) return "celestial";
  if (odds <= 500000) return "transcendant";
  if (odds <= 650000) return "primordial";
  if (odds <= 750000) return "cosmic";
  return "eclipse";
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function rarityClass(rarity) {
  return `rarity-${rarity}`;
}

function borderClass(rarity) {
  return `${rarity}-border`;
}

function getCardId(character) {
  return `${character.name}__${character.odds}__${character.image}`;
}

function ownsCard(character) {
  const id = getCardId(character);
  return keptCards.some((card) => getCardId(card) === id);
}

function getUniqueGalleryCards() {
  const seen = new Set();
  const unique = [];

  for (const character of characters) {
    const id = getCardId(character);
    if (!seen.has(id)) {
      seen.add(id);
      unique.push(character);
    }
  }

  return unique;
}

function discoverCard(character) {
  const id = getCardId(character);

  if (!discoveredCards.includes(id)) {
    discoveredCards.push(id);

    updateQuests();
  }
}

function hasDiscovered(character) {
  return discoveredCards.includes(getCardId(character));
}

function getGoldReward(character) {
  const rarity = getRarity(character);

  if (rarity === "mortal") return 2;
  if (rarity === "blessed") return 4;
  if (rarity === "astral") return 10;
  if (rarity === "ascended") return 18;
  if (rarity === "mythic") return 28;
  if (rarity === "divine") return 45;
  if (rarity === "ethereal") return 70;
  if (rarity === "celestial") return 110;
  if (rarity === "transcendant") return 180;
  if (rarity === "primordial") return 260;
  if (rarity === "cosmic") return 400;
  return 650;
}

function getBestRoll() {
  if (rollHistory.length === 0) return null;

  return rollHistory.reduce((best, current) => {
    return current.odds > best.odds ? current : best;
  });
}

function updateStats() {
  const activeLuck = getActiveLuck();
  const totalPotionMultiplier = getTotalPotionMultiplier();
  const potionSecondsLeft = getPotionSecondsLeft();
  const speedSecondsLeft = getSpeedSecondsLeft();

  counterLabel.textContent = `Rolls: ${rollCount}`;
  keptCountLabel.textContent = `Kept: ${keptCards.length}`;

  let luckText = `Luck: ${luck}x`;

  if (totalPotionMultiplier > 1 && potionSecondsLeft > 0) {
    luckText = `Luck: ${luck}x base • ${activeLuck}x active • Potion: ${totalPotionMultiplier}x • ${potionSecondsLeft}s`;
  }

  if (rollSpeedMultiplier > 1 && speedSecondsLeft > 0) {
    luckText += ` • Speed: ${rollSpeedMultiplier}x • ${speedSecondsLeft}s`;
  }

  luckLabel.textContent = luckText;

  if (goldLabel) {
    goldLabel.textContent = `Gold: ${gold.toLocaleString()}`;
  }

  const best = getBestRoll();
  bestLabel.textContent = best ? `Best: ${best.name} (${formatOdds(best.odds)})` : "Best: None";

  if (toggleSoundButton) {
    toggleSoundButton.textContent = `Sound: ${soundEnabled ? "ON" : "OFF"}`;
  }
}

function setCardRarity(rarity) {
  cardShell.className = `card-shell ${rarityClass(rarity)}`;
  rarityBadge.className = `rarity-badge ${rarityClass(rarity)}`;
  rarityBadge.textContent = capitalize(rarity);
}

function clearMediaBox() {
  imageBox.innerHTML = `<div id="sparkle" class="sparkle"></div>`;
}

function resetDisplayedCard() {
  imageBox.innerHTML = `<span id="imagePlaceholder">Roll to see a character</span><div id="sparkle" class="sparkle"></div>`;
  rarityBadge.className = "rarity-badge";
  rarityBadge.textContent = "No card yet";
  cardShell.className = "card-shell rarity-mortal";
}

function renderMedia(character, extraClass = "reveal") {
  clearMediaBox();

  if (isVideoFile(character.image)) {
    const video = document.createElement("video");
    video.src = character.image;
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.classList.add(extraClass);
    imageBox.appendChild(video);
    return;
  }

  const img = document.createElement("img");
  img.src = character.image;
  img.alt = character.name;
  img.classList.add(extraClass);

  img.onerror = function () {
    imageBox.innerHTML = `<span>Media not found</span><div id="sparkle" class="sparkle"></div>`;
  };

  imageBox.appendChild(img);
}

function displayCharacter(character, prefix = "You rolled:") {
  const rarity = getRarity(character);
  resultLabel.textContent = `${prefix} ${character.name} (${formatOdds(character.odds)})`;
  setCardRarity(rarity);

  renderMedia(character, "reveal");

  const sparkle = document.getElementById("sparkle");

  if (
    rarity === "ascended" ||
    rarity === "mythic" ||
    rarity === "divine" ||
    rarity === "ethereal" ||
    rarity === "celestial" ||
    rarity === "transcendant" ||
    rarity === "primordial" ||
    rarity === "cosmic" ||
    rarity === "eclipse"
  ) {
    sparkle.className = `sparkle active ${rarity}`;
    triggerRarePullAnimation(rarity);
  }
}

function updateRollHistory() {
  rollHistoryList.innerHTML = "";

  if (rollHistory.length === 0) {
    rollHistoryList.innerHTML = '<div class="empty">No rolls yet.</div>';
    return;
  }

  rollHistory
    .slice()
    .reverse()
    .forEach((item) => {
      const rarity = getRarity(item);
      const div = document.createElement("div");
      div.className = `list-item ${borderClass(rarity)}`;
      div.innerHTML = `
        <strong>${item.name}</strong>
        <small>${capitalize(rarity)} • ${formatOdds(item.odds)}</small>
      `;

      div.addEventListener("click", () => {
        displayCharacter(item, "Viewing roll:");
        playRevealSound(item);
      });

      rollHistoryList.appendChild(div);
    });
}

function removeKeptCardById(cardId) {
  const index = keptCards.findIndex((card) => getCardId(card) === cardId);
  if (index === -1) return;

  const [removed] = keptCards.splice(index, 1);

  updateKeptCards();
  updateGallery();
  updateStats();
  saveGame();

  if (currentRoll && getCardId(currentRoll) === cardId) {
    keepButton.disabled = false;
  }

  resultLabel.textContent = `Deleted ${removed.name} from kept cards.`;
}

function removeDiscoveredCardById(cardId) {
  const character = characters.find((card) => getCardId(card) === cardId);

  discoveredCards = discoveredCards.filter((id) => id !== cardId);
  keptCards = keptCards.filter((card) => getCardId(card) !== cardId);
  rollHistory = rollHistory.filter((card) => getCardId(card) !== cardId);

  if (currentRoll && getCardId(currentRoll) === cardId) {
    currentRoll = null;
    keepButton.disabled = true;
    resultLabel.textContent = "Card deleted from collection.";
    resetDisplayedCard();
  } else if (character) {
    resultLabel.textContent = `Deleted ${character.name} from collection.`;
  } else {
    resultLabel.textContent = "Card deleted from collection.";
  }

  updateRollHistory();
  updateKeptCards();
  updateGallery();
  updateStats();
  saveGame();
}

function updateKeptCards() {
  keptCardsList.innerHTML = "";

  if (keptCards.length === 0) {
    keptCardsList.innerHTML = '<div class="empty">No kept cards yet.</div>';
    return;
  }

  keptCards.forEach((item) => {
    const rarity = getRarity(item);

    const div = document.createElement("div");
    div.className = `list-item ${borderClass(rarity)}`;

    const info = document.createElement("div");
    info.className = "list-item-info";
    info.innerHTML = `
      <strong>${item.name}</strong>
      <small>${capitalize(rarity)} • ${formatOdds(item.odds)}</small>
    `;

    info.addEventListener("click", () => {
      displayCharacter(item, "Viewing kept card:");
      playRevealSound(item);
    });

    div.appendChild(info);
    keptCardsList.appendChild(div);
  });
}

function updateGallery() {
  if (!galleryGrid || !galleryProgressLabel) return;

  const galleryCards = getUniqueGalleryCards();
  galleryGrid.innerHTML = "";

  galleryCards.forEach((item) => {
    const discovered = hasDiscovered(item);
    const rarity = getRarity(item);
    const owned = ownsCard(item);
    const cardId = getCardId(item);

    const div = document.createElement("div");
    div.className = `gallery-card ${borderClass(rarity)} ${discovered ? "" : "locked"} ${owned ? "owned" : ""}`;

    if (discovered) {
      const details = document.createElement("div");
      details.className = "gallery-details";
      details.innerHTML = `
        <div class="gallery-name">${item.name}</div>
        <div class="gallery-rarity">${capitalize(rarity)}</div>
        <div class="gallery-odds">${formatOdds(item.odds)}</div>
        <div class="gallery-status">${owned ? "Owned" : "Seen"}</div>
      `;

      details.addEventListener("click", () => {
        displayCharacter(item, "Viewing gallery card:");
        playRevealSound(item);
      });

      div.appendChild(details);
    } else {
      div.innerHTML = `
        <div class="gallery-name">???</div>
        <div class="gallery-rarity">Undiscovered</div>
        <div class="gallery-odds">???</div>
        <div class="gallery-status">Locked</div>
      `;
    }

    galleryGrid.appendChild(div);
  });

  galleryProgressLabel.textContent = `Discovered: ${discoveredCards.length} / ${galleryCards.length}`;
}

function weightedRandomChoice(items, weights) {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let randomNum = Math.random() * totalWeight;

  for (let i = 0; i < items.length; i++) {
    if (randomNum < weights[i]) {
      return items[i];
    }
    randomNum -= weights[i];
  }

  return items[items.length - 1];
}

function rollCharacter(luckValue = getActiveLuck()) {
  const effectiveLuck = Math.max(1, luckValue);

  const weights = characters.map((character) => {
    const adjustedOdds = Math.max(1, character.odds / effectiveLuck);
    return 1 / adjustedOdds;
  });

  return weightedRandomChoice(characters, weights);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function flashBeam(rarity) {
  rarityOverlay.className = `rarity-overlay show beam-${rarity}`;
  rarityOverlay.innerHTML = `<span>${formatRarityLabel(rarity)}</span>`;
}

function clearBeam() {
  rarityOverlay.className = "rarity-overlay";
  rarityOverlay.innerHTML = "";
}

function triggerScreenShake(intensity = "light") {
  document.body.classList.remove("shake-light", "shake-heavy");
  void document.body.offsetWidth;
  document.body.classList.add(intensity === "heavy" ? "shake-heavy" : "shake-light");

  setTimeout(() => {
    document.body.classList.remove("shake-light", "shake-heavy");
  }, intensity === "heavy" ? 650 : 350);
}

function getPreviewCycleDelay() {
  return Math.max(60, Math.floor(180 / rollSpeedMultiplier));
}

function showRollingPreview() {
  if (!characters.length) return null;

  const showRandomPreview = () => {
    const preview = characters[Math.floor(Math.random() * characters.length)];
    const rarity = getRarity(preview);

    resultLabel.textContent = "Rolling...";
    setCardRarity(rarity);
    renderMedia(preview, "reveal");
  };

  showRandomPreview();

  return setInterval(() => {
    showRandomPreview();
  }, getPreviewCycleDelay());
}

async function playRarityRevealSequence(character) {
  const rarity = getRarity(character);

  if (rarity === "ascended" || rarity === "mythic" || rarity === "divine") {
    flashBeam(rarity);
    triggerScreenShake("light");
    await sleep(220);
    clearBeam();
    return;
  }

  if (rarity === "ethereal" || rarity === "celestial" || rarity === "transcendant") {
    flashBeam(rarity);
    triggerScreenShake("light");
    await sleep(320);
    clearBeam();
    return;
  }

  if (rarity === "primordial" || rarity === "cosmic") {
    flashBeam(rarity);
    triggerScreenShake("heavy");
    await sleep(450);
    clearBeam();
    return;
  }

  if (rarity === "eclipse") {
    flashBeam("cosmic");
    triggerScreenShake("heavy");
    await sleep(260);
    clearBeam();

    flashBeam("eclipse");
    triggerScreenShake("heavy");
    await sleep(420);
    clearBeam();
  }
}

async function doRoll() {
  if (isRolling || !characters.length) return;

  isRolling = true;
  keepButton.disabled = true;
  startRollingAnimation();
  playRollSound();

  const previewInterval = showRollingPreview();

  await sleep(getRollDelay());

  if (previewInterval) {
    clearInterval(previewInterval);
  }

  const nextRollNumber = rollCount + 1;
  const isBoostedRoll = nextRollNumber % 10 === 0;

  const activeLuck = getActiveLuck();
  const finalLuck = isBoostedRoll ? activeLuck * 10 : activeLuck;

  const rolled = rollCharacter(finalLuck);
  const reward = getGoldReward(rolled);
  const alreadyOwned = ownsCard(rolled);
  const rolledRarity = getRarity(rolled);

  currentRoll = rolled;
  rollCount++;
  rollHistory.push(rolled);
  discoverCard(rolled);
  gold += reward;

  await playRarityRevealSequence(rolled);

  stopRollingAnimation();
  displayCharacter(
    rolled,
    isBoostedRoll ? "LUCKY ROLL x10! You rolled:" : "You rolled:"
  );

  resultLabel.textContent += ` • +${reward} Gold`;

  if (alreadyOwned) {
    resultLabel.textContent += " • Already owned";
  }

  playRevealSound(rolled);

  keepButton.disabled = alreadyOwned;
  updateRollHistory();
  updateGallery();
  updateStats();
  saveGame();
  updateQuests();

  if (
    autoRolling &&
    !alreadyOwned &&
    isRarityAtOrAbove(rolledRarity, autoStopRarity)
  ) {
    stopAutoRoll();
    resultLabel.textContent += ` • Auto-roll stopped at new ${capitalize(rolledRarity)}+ card`;
  }

  isRolling = false;
}

function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

function playTone(freq = 440, duration = 0.08, type = "sine", volume = 0.03) {
  if (!soundEnabled) return;

  const ctx = ensureAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;

  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.start(now);
  osc.stop(now + duration);
}

function playRollSound() {
  if (!soundEnabled) return;

  playTone(380, 0.05, "square", 0.02);
  setTimeout(() => playTone(520, 0.05, "square", 0.015), 40);
  setTimeout(() => playTone(680, 0.05, "square", 0.012), 80);
}

function playRevealSound(character) {
  if (!soundEnabled) return;

  const rarity = getRarity(character);

  if (rarity === "ascended") {
    playTone(300, 0.12, "sine", 0.035);
    setTimeout(() => playTone(659, 0.12, "sine", 0.032), 100);
    setTimeout(() => playTone(784, 0.18, "sine", 0.03), 220);
  } else if (rarity === "mythic") {
    playTone(523, 0.12, "sine", 0.035);
    setTimeout(() => playTone(659, 0.12, "sine", 0.032), 100);
    setTimeout(() => playTone(784, 0.18, "sine", 0.03), 220);
  } else if (rarity === "divine") {
    playTone(587, 0.12, "sine", 0.04);
    setTimeout(() => playTone(740, 0.12, "sine", 0.038), 100);
    setTimeout(() => playTone(880, 0.2, "sine", 0.035), 220);
  } else if (rarity === "ethereal") {
    playTone(659, 0.12, "triangle", 0.04);
    setTimeout(() => playTone(831, 0.12, "triangle", 0.038), 90);
    setTimeout(() => playTone(988, 0.2, "triangle", 0.034), 200);
  } else if (rarity === "celestial") {
    playTone(698, 0.12, "triangle", 0.045);
    setTimeout(() => playTone(880, 0.14, "triangle", 0.04), 90);
    setTimeout(() => playTone(1047, 0.22, "triangle", 0.036), 200);
  } else if (rarity === "transcendant") {
    playTone(784, 0.14, "sine", 0.045);
    setTimeout(() => playTone(988, 0.14, "sine", 0.042), 90);
    setTimeout(() => playTone(1175, 0.24, "sine", 0.038), 210);
  } else if (rarity === "primordial") {
    playTone(880, 0.14, "sawtooth", 0.045);
    setTimeout(() => playTone(1109, 0.16, "sawtooth", 0.042), 100);
    setTimeout(() => playTone(1319, 0.26, "sawtooth", 0.038), 220);
  } else if (rarity === "cosmic") {
    playTone(988, 0.16, "sawtooth", 0.05);
    setTimeout(() => playTone(1245, 0.18, "sawtooth", 0.045), 100);
    setTimeout(() => playTone(1480, 0.28, "sawtooth", 0.04), 220);
  } else if (rarity === "eclipse") {
    playTone(1047, 0.18, "square", 0.05);
    setTimeout(() => playTone(1319, 0.2, "square", 0.048), 110);
    setTimeout(() => playTone(1568, 0.32, "square", 0.045), 240);
  }
}

function playKeepSound() {
  if (!soundEnabled) return;

  playTone(600, 0.06, "triangle", 0.025);
  setTimeout(() => playTone(800, 0.1, "triangle", 0.02), 70);
}

function saveGame() {
  const data = {
    rollHistory,
    keptCards,
    rollCount,
    luck,
    currentRoll,
    soundEnabled,
    potionLuckMultiplier,
    potionEndTime,
    discoveredCards,
    gold,
    rollSpeedMultiplier,
    speedPotionEndTime,
    quests,
    completedQuestIds,
    claimedQuestIds
  };

  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;

  try {
    const data = JSON.parse(raw);

    rollHistory = Array.isArray(data.rollHistory) ? data.rollHistory : [];
    keptCards = Array.isArray(data.keptCards) ? data.keptCards : [];
    rollCount = Number.isFinite(data.rollCount) ? data.rollCount : 0;
    luck = Number.isFinite(data.luck) ? data.luck : 1;
    currentRoll = data.currentRoll || null;
    soundEnabled = typeof data.soundEnabled === "boolean" ? data.soundEnabled : true;
    potionLuckMultiplier = Number.isFinite(data.potionLuckMultiplier) ? data.potionLuckMultiplier : 1;
    potionEndTime = Number.isFinite(data.potionEndTime) ? data.potionEndTime : 0;
    discoveredCards = Array.isArray(data.discoveredCards) ? data.discoveredCards : [];
    gold = Number.isFinite(data.gold) ? data.gold : 0;
    rollSpeedMultiplier = Number.isFinite(data.rollSpeedMultiplier) ? data.rollSpeedMultiplier : 1;
    speedPotionEndTime = Number.isFinite(data.speedPotionEndTime) ? data.speedPotionEndTime : 0;
    quests = Array.isArray(data.quests) ? data.quests : [];
    completedQuestIds = Array.isArray(data.completedQuestIds) ? data.completedQuestIds : [];
    claimedQuestIds = Array.isArray(data.claimedQuestIds) ? data.claimedQuestIds : [];

    ensureQuestSlots();

    clearExpiredSpeedPotion();
    if (getSpeedSecondsLeft() > 0) {
      startSpeedPotionTimer();
    }

    clearExpiredPotions();
    if (getPotionSecondsLeft() > 0) {
      startPotionTimer();
    }

    updateRollHistory();
    updateKeptCards();
    updateGallery();
    updateStats();

    if (currentRoll) {
      displayCharacter(currentRoll, "Last rolled:");
      keepButton.disabled = ownsCard(currentRoll);
    }
  } catch (err) {
    console.error("Failed to load save data:", err);
  }
}

function useQuicksilverPotion() {
  useSpeedPotion(2, 60000);
  resultLabel.textContent = "Quicksilver Potion activated! Rolls are 2x faster for 60s";
}

function resetSave() {
  stopAutoRoll();
  localStorage.removeItem(SAVE_KEY);

  rollHistory = [];
  keptCards = [];
  rollCount = 0;
  luck = 1;
  currentRoll = null;
  soundEnabled = true;
  isRolling = false;
  potionLuckMultiplier = 1;
  potionEndTime = 0;
  discoveredCards = [];
  gold = 0;
  rollSpeedMultiplier = 1;
  speedPotionEndTime = 0;
  quests = [];
  completedQuestIds = [];
  claimedQuestIds = [];

  if (potionTimerInterval) {
    clearInterval(potionTimerInterval);
    potionTimerInterval = null;
  }

  if (speedPotionTimerInterval) {
    clearInterval(speedPotionTimerInterval);
    speedPotionTimerInterval = null;
  }

  resultLabel.textContent = "Press ROLL to begin";
  resetDisplayedCard();

  keepButton.disabled = true;

  ensureQuestSlots();
  updateRollHistory();
  updateKeptCards();
  updateGallery();
  updateStats();
  updateQuests();
  saveGame();
}

function startRollingAnimation() {
  imageBox.classList.remove("rolling");
  void imageBox.offsetWidth;
  imageBox.classList.add("rolling");
  resultLabel.textContent = "Rolling...";
}

function stopRollingAnimation() {
  imageBox.classList.remove("rolling");
}

function keepCurrentCard() {
  if (!currentRoll) return;

  if (ownsCard(currentRoll)) {
    resultLabel.textContent = `You already own ${currentRoll.name}. Duplicate cards cannot be kept.`;
    keepButton.disabled = true;
    return;
  }

  keptCards.push(currentRoll);
  updateKeptCards();
  updateGallery();
  updateStats();
  playKeepSound();
  saveGame();
  updateQuests();

  resultLabel.textContent = `Kept ${currentRoll.name}!`;
  keepButton.disabled = true;
}

function startAutoRoll() {
  if (autoRolling) return;

  autoRolling = true;
  doRoll();

  autoRollInterval = setInterval(() => {
    if (!document.hidden && !isRolling) {
      doRoll();
    }
  }, getAutoRollDelay());
}

function stopAutoRoll() {
  autoRolling = false;
  clearInterval(autoRollInterval);
  autoRollInterval = null;
}

function increaseLuck() {
  luck++;
  updateStats();
  saveGame();
}

function resetLuck() {
  luck = 1;
  updateStats();
  saveGame();
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  updateStats();
  saveGame();
}

function formatRarityLabel(rarity) {
  if (rarity === "transcendant") return "Transcendant";
  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}

function clearRareEffects() {
  screenFlash.className = "screen-flash";
  rarityOverlay.className = "rarity-overlay";
  rarityOverlay.innerHTML = "";
  cardShell.classList.remove("pulse-rare");
}

function triggerRarePullAnimation(rarity) {
  clearRareEffects();

  const rareTiers = [
    "ascended",
    "mythic",
    "divine",
    "ethereal",
    "celestial",
    "transcendant",
    "primordial",
    "cosmic",
    "eclipse"
  ];

  if (!rareTiers.includes(rarity)) {
    return;
  }

  screenFlash.classList.add(`active-${rarity}`);
  rarityOverlay.classList.add("show", rarity);
  rarityOverlay.innerHTML = `<span>${formatRarityLabel(rarity)}</span>`;
  cardShell.classList.add("pulse-rare");

  setTimeout(() => {
    clearRareEffects();
  }, rarity === "eclipse" ? 1200 : 900);
}

function startHoldLuck() {
  if (holdLuckInterval) return;

  increaseLuck();
  holdLuckInterval = setInterval(() => {
    increaseLuck();
  }, 120);
}

function stopHoldLuck() {
  clearInterval(holdLuckInterval);
  holdLuckInterval = null;
}

function useLuckPotion(multiplier = 2, durationMs = 60000) {
  const now = Date.now();

  potionLuckMultiplier += multiplier - 1;

  if (potionEndTime > now) {
    potionEndTime += durationMs;
  } else {
    potionEndTime = now + durationMs;
  }

  startPotionTimer();
  updateStats();
  saveGame();
}

function useSmallPotion() {
  useLuckPotion(5, 60000);
}

function useMediumPotion() {
  useLuckPotion(20, 60000);
}

function useBigPotion() {
  useLuckPotion(50, 60000);
}

function getTotalPotionMultiplier() {
  if (getPotionSecondsLeft() <= 0) {
    return 1;
  }
  return potionLuckMultiplier;
}

function getPotionSecondsLeft() {
  if (potionEndTime <= 0) return 0;
  return Math.max(0, Math.ceil((potionEndTime - Date.now()) / 1000));
}

function getActiveLuck() {
  return luck * getTotalPotionMultiplier();
}

function clearExpiredPotions() {
  if (potionEndTime > 0 && Date.now() >= potionEndTime) {
    clearPotionEffect();
  }
}

function startPotionTimer() {
  if (potionTimerInterval) return;

  potionTimerInterval = setInterval(() => {
    clearExpiredPotions();
    updateStats();
    saveGame();
  }, 250);
}

function clearPotionEffect() {
  potionLuckMultiplier = 1;
  potionEndTime = 0;

  if (potionTimerInterval) {
    clearInterval(potionTimerInterval);
    potionTimerInterval = null;
  }

  updateStats();
  saveGame();
}

function getSpeedSecondsLeft() {
  if (speedPotionEndTime <= 0) return 0;
  return Math.max(0, Math.ceil((speedPotionEndTime - Date.now()) / 1000));
}

function getRollDelay() {
  return Math.max(500, Math.floor(900 / rollSpeedMultiplier));
}

function getAutoRollDelay() {
  return Math.max(900, Math.floor(1500 / rollSpeedMultiplier));
}

function clearExpiredSpeedPotion() {
  if (speedPotionEndTime > 0 && Date.now() >= speedPotionEndTime) {
    clearSpeedPotionEffect();
  }
}

function startSpeedPotionTimer() {
  if (speedPotionTimerInterval) return;

  speedPotionTimerInterval = setInterval(() => {
    clearExpiredSpeedPotion();
    updateStats();
    saveGame();
  }, 250);
}

function clearSpeedPotionEffect() {
  rollSpeedMultiplier = 1;
  speedPotionEndTime = 0;

  if (speedPotionTimerInterval) {
    clearInterval(speedPotionTimerInterval);
    speedPotionTimerInterval = null;
  }

  if (autoRolling) {
    stopAutoRoll();
    startAutoRoll();
  }

  updateStats();
  saveGame();
}

function useSpeedPotion(multiplier = 2, durationMs = 60000) {
  const now = Date.now();

  rollSpeedMultiplier += multiplier - 1;

  if (speedPotionEndTime > now) {
    speedPotionEndTime += durationMs;
  } else {
    speedPotionEndTime = now + durationMs;
  }

  startSpeedPotionTimer();

  if (autoRolling) {
    stopAutoRoll();
    startAutoRoll();
  }

  updateStats();
  saveGame();
}

function spendGold(amount) {
  if (gold < amount) {
    resultLabel.textContent = `Not enough gold. You need ${amount.toLocaleString()} Gold.`;
    return false;
  }

  gold -= amount;
  updateStats();
  saveGame();
  return true;
}

function buySmallPotionFromShop() {
  if (!spendGold(250)) return;
  useSmallPotion();
  resultLabel.textContent = "Bought Blessed Fortune Draught! 5x luck for 60s";
}

function buyMediumPotionFromShop() {
  if (!spendGold(900)) return;
  useMediumPotion();
  resultLabel.textContent = "Bought Divine Fortune Elixir! 20x luck for 60s";
}

function buyBigPotionFromShop() {
  if (!spendGold(2000)) return;
  useBigPotion();
  resultLabel.textContent = "Bought Celestial Fate Tonic! 50x luck for 60s";
}

function buyPermanentLuckUpgrade() {
  if (!spendGold(1500)) return;
  luck += 3;
  updateStats();
  saveGame();
  resultLabel.textContent = "Bought Permanent +3 Base Luck!";
}

function buySpeedPotionFromShop() {
  if (!spendGold(800)) return;
  useSpeedPotion();
  resultLabel.textContent = "Bought Quicksilver Potion! 2x speed for 60s";
}

document.getElementById("smallPotionButton").addEventListener("click", () => {
  useSmallPotion();
  resultLabel.textContent = "Blessed Fortune Draught activated! 5x luck for 60s";
});

document.getElementById("mediumPotionButton").addEventListener("click", () => {
  useMediumPotion();
  resultLabel.textContent = "Divine Fortune Elixir activated! 20x luck for 60s";
});

document.getElementById("bigPotionButton").addEventListener("click", () => {
  useBigPotion();
  resultLabel.textContent = "Celestial Fate Tonic activated! 50x luck for 60s";
});

if (increaseLuckButton) {
  increaseLuckButton.addEventListener("mousedown", startHoldLuck);
  increaseLuckButton.addEventListener("mouseup", stopHoldLuck);
  increaseLuckButton.addEventListener("mouseleave", stopHoldLuck);
  increaseLuckButton.addEventListener("touchstart", startHoldLuck);
  increaseLuckButton.addEventListener("touchend", stopHoldLuck);
}

document.getElementById("rollButton").addEventListener("click", () => {
  ensureAudioContext();
  doRoll();
});

document.getElementById("speedPotionButton").addEventListener("click", () => {
  useQuicksilverPotion();
});

document.getElementById("startAutoButton").addEventListener("click", () => {
  ensureAudioContext();
  startAutoRoll();
});

document.getElementById("stopAutoButton").addEventListener("click", stopAutoRoll);
document.getElementById("keepButton").addEventListener("click", keepCurrentCard);
document.getElementById("resetLuckButton").addEventListener("click", resetLuck);
document.getElementById("toggleSoundButton").addEventListener("click", () => {
  ensureAudioContext();
  toggleSound();
});
document.getElementById("resetSaveButton").addEventListener("click", resetSave);

if (shopSmallPotionButton) {
  shopSmallPotionButton.addEventListener("click", buySmallPotionFromShop);
}

if (shopMediumPotionButton) {
  shopMediumPotionButton.addEventListener("click", buyMediumPotionFromShop);
}

if (shopBigPotionButton) {
  shopBigPotionButton.addEventListener("click", buyBigPotionFromShop);
}

if (shopSpeedPotionButton) {
  shopSpeedPotionButton.addEventListener("click", buySpeedPotionFromShop);
}

if (buyLuckUpgradeButton) {
  buyLuckUpgradeButton.addEventListener("click", buyPermanentLuckUpgrade);
}

async function startGame() {
  try {
    await loadCharacters();
    loadGame();
    ensureQuestSlots();
    updateGallery();
    updateStats();
    updateQuests();
  } catch (error) {
    console.error(error);
    resultLabel.textContent = "Failed to load cards.json";
  }
}

startGame();