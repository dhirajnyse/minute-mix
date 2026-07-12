(function () {
  "use strict";

  const HISTORY_KEY = "minutemix-history-v1";
  const PROGRESS_KEY = "minutemix-progress-v1";
  const MAX_LOCAL_ATTEMPTS = 500;
  const RECENT_ATTEMPTS_SHOWN = 12;
  const SUPABASE_MODULE_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.2/+esm";
  const VALID_MODES = new Set(["daily", "practice", "duel", "host"]);

  const historyButton = document.querySelector("#history-button");
  const historySyncDot = document.querySelector("#history-sync-dot");
  const historyDialog = document.querySelector("#history-dialog");
  const historyCloseButton = document.querySelector("#history-close-button");
  const historySessions = document.querySelector("#history-sessions");
  const historyBest = document.querySelector("#history-best");
  const historyAverage = document.querySelector("#history-average");
  const historyAccuracy = document.querySelector("#history-accuracy");
  const historyList = document.querySelector("#history-list");
  const emptyHistory = document.querySelector("#empty-history");
  const historyStorageLabel = document.querySelector("#history-storage-label");
  const footerStorageNote = document.querySelector("#footer-storage-note");
  const accountEyebrow = document.querySelector("#account-eyebrow");
  const accountTitle = document.querySelector("#account-title");
  const accountCopy = document.querySelector("#account-copy");
  const accountStatus = document.querySelector("#account-status");
  const signInForm = document.querySelector("#signin-form");
  const signInEmail = document.querySelector("#signin-email");
  const signInSubmitButton = document.querySelector("#signin-submit-button");
  const signedInRow = document.querySelector("#signed-in-row");
  const signedInEmail = document.querySelector("#signed-in-email");
  const signOutButton = document.querySelector("#signout-button");

  let cloudClientPromise = null;
  let cloudClient = null;
  let currentUser = null;
  let syncPromise = null;

  function createClientId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }

  function safeIsoDate(value) {
    try {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
    } catch (error) {
      return new Date().toISOString();
    }
  }

  function normaliseAttempt(value) {
    if (!value || typeof value !== "object") return null;
    const mode = VALID_MODES.has(value.mode) ? value.mode : "daily";
    const score = Math.max(0, Math.min(1000, Math.round(Number(value.score) || 0)));
    const correct = Math.max(0, Math.min(5, Math.round(Number(value.correct) || 0)));
    return {
      clientId: String(value.clientId || value.client_id || createClientId()).slice(0, 160),
      playedAt: safeIsoDate(value.playedAt || value.played_at || new Date()),
      mode,
      score,
      correct,
      seed: String(value.seed || "").slice(0, 160),
      target: value.target === null || value.target === undefined ? null : Math.max(0, Math.min(1000, Math.round(Number(value.target) || 0))),
      rounds: Array.isArray(value.rounds)
        ? value.rounds.slice(0, 5).map((round) => ({
          round: String(round.round || "Round").slice(0, 80),
          correct: Boolean(round.correct)
        }))
        : [],
      ownerId: String(value.ownerId || "").slice(0, 80)
    };
  }

  function readAttempts() {
    try {
      const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY));
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(normaliseAttempt)
        .filter(Boolean)
        .sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt))
        .slice(0, MAX_LOCAL_ATTEMPTS);
    } catch (error) {
      return [];
    }
  }

  function saveAttempts(attempts) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(attempts.slice(0, MAX_LOCAL_ATTEMPTS)));
    } catch (error) {
      setAccountStatus("History could not be saved in this browser.", "error");
    }
  }

  function migrateDailyProgress() {
    try {
      const progress = JSON.parse(localStorage.getItem(PROGRESS_KEY));
      if (!progress || !progress.daily || typeof progress.daily !== "object") return;
      const attempts = readAttempts();
      const knownIds = new Set(attempts.map((attempt) => attempt.clientId));
      let changed = false;

      Object.entries(progress.daily).forEach(([day, result]) => {
        const clientId = `legacy-daily-${day}`;
        if (knownIds.has(clientId) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
        const attempt = normaliseAttempt({
          clientId,
          playedAt: `${day}T12:00:00.000Z`,
          mode: "daily",
          score: result && result.score,
          correct: result && result.correct,
          seed: day,
          rounds: []
        });
        if (attempt) {
          attempts.push(attempt);
          changed = true;
        }
      });

      if (changed) {
        attempts.sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt));
        saveAttempts(attempts);
      }
    } catch (error) {
      // Existing game progress remains untouched when migration is unavailable.
    }
  }

  function modeLabel(mode) {
    if (mode === "practice") return "Practice";
    if (mode === "duel") return "Duel";
    if (mode === "host") return "Duel builder";
    return "Daily";
  }

  function sessionTitle(attempt) {
    if (attempt.mode === "duel") return attempt.target === null ? "Friend duel" : `Friend duel | Target ${attempt.target}`;
    if (attempt.mode === "host") return "Challenge score created";
    if (attempt.mode === "practice") return "Fresh practice mix";
    return "Daily MinuteMix";
  }

  function formatPlayedAt(value) {
    const date = new Date(value);
    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    if (sameDay) {
      return `Today, ${new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(date)}`;
    }
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: date.getFullYear() === today.getFullYear() ? undefined : "numeric" }).format(date);
  }

  function renderHistory() {
    const attempts = readAttempts();
    const sessions = attempts.length;
    const best = sessions ? Math.max(...attempts.map((attempt) => attempt.score)) : 0;
    const average = sessions ? Math.round(attempts.reduce((total, attempt) => total + attempt.score, 0) / sessions) : 0;
    const correct = attempts.reduce((total, attempt) => total + attempt.correct, 0);
    const accuracy = sessions ? Math.round((correct / (sessions * 5)) * 100) : 0;

    historySessions.textContent = String(sessions);
    historyBest.textContent = String(best);
    historyAverage.textContent = String(average);
    historyAccuracy.textContent = `${accuracy}%`;
    historyList.innerHTML = "";

    attempts.slice(0, RECENT_ATTEMPTS_SHOWN).forEach((attempt) => {
      const item = document.createElement("li");
      item.className = "history-item";

      const mode = document.createElement("span");
      mode.className = "history-mode";
      mode.dataset.mode = attempt.mode;
      mode.textContent = modeLabel(attempt.mode);

      const copy = document.createElement("div");
      copy.className = "history-item-copy";
      const title = document.createElement("strong");
      title.textContent = sessionTitle(attempt);
      const time = document.createElement("time");
      time.dateTime = attempt.playedAt;
      time.textContent = formatPlayedAt(attempt.playedAt);
      copy.append(title, time);

      const score = document.createElement("div");
      score.className = "history-item-score";
      const scoreValue = document.createElement("strong");
      scoreValue.textContent = String(attempt.score);
      const correctValue = document.createElement("span");
      correctValue.textContent = `${attempt.correct}/5 correct`;
      score.append(scoreValue, correctValue);

      item.append(mode, copy, score);
      historyList.appendChild(item);
    });

    emptyHistory.hidden = sessions > 0;
  }

  function setAccountStatus(message, type = "") {
    accountStatus.textContent = message;
    accountStatus.className = `account-status${type ? ` is-${type}` : ""}`;
  }

  function renderAccount() {
    const signedIn = Boolean(currentUser);
    signInForm.hidden = signedIn;
    signedInRow.hidden = !signedIn;
    historySyncDot.classList.toggle("is-synced", signedIn);
    historyStorageLabel.textContent = signedIn ? "Synced across devices" : "On this device";
    footerStorageNote.textContent = signedIn ? "Your play history is synced across devices." : "Your scores and streak stay on this device.";

    if (signedIn) {
      accountEyebrow.textContent = "Cloud history on";
      accountTitle.textContent = "Your progress is synced.";
      accountCopy.textContent = "New sessions are saved here and securely added to your account.";
      signedInEmail.textContent = currentUser.email || "Signed in";
      return;
    }

    accountEyebrow.textContent = "Optional account";
    accountTitle.textContent = "Keep playing as a guest.";
    accountCopy.textContent = "History is saved on this device. Sign in to keep it synced across your devices.";
    signedInEmail.textContent = "";
  }

  function recordAttempt(value) {
    const attempt = normaliseAttempt({
      ...value,
      clientId: createClientId(),
      playedAt: new Date().toISOString(),
      ownerId: currentUser ? currentUser.id : ""
    });
    if (!attempt) return;
    const attempts = readAttempts();
    attempts.unshift(attempt);
    saveAttempts(attempts);
    renderHistory();
    if (currentUser) syncHistory();
  }

  async function getCloudClient() {
    if (cloudClient) return cloudClient;
    if (cloudClientPromise) return cloudClientPromise;
    const config = window.MINUTEMIX_CLOUD_CONFIG || {};
    if (!config.url || !config.publishableKey) throw new Error("Cloud sync is not configured.");

    cloudClientPromise = import(SUPABASE_MODULE_URL).then(({ createClient }) => {
      cloudClient = createClient(config.url, config.publishableKey, {
        auth: {
          storageKey: "minutemix-auth-v1",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      return cloudClient;
    });
    return cloudClientPromise;
  }

  function rowToAttempt(row, userId) {
    return normaliseAttempt({
      clientId: row.client_id,
      playedAt: row.played_at,
      mode: row.mode,
      score: row.score,
      correct: row.correct,
      seed: row.seed,
      target: row.target,
      rounds: row.rounds,
      ownerId: userId
    });
  }

  async function syncHistory() {
    if (!currentUser) return;
    if (syncPromise) return syncPromise;

    syncPromise = (async () => {
      const client = await getCloudClient();
      const localAttempts = readAttempts();
      const eligibleAttempts = localAttempts.filter((attempt) => !attempt.ownerId || attempt.ownerId === currentUser.id);
      setAccountStatus("Syncing history...");

      if (eligibleAttempts.length) {
        const payload = eligibleAttempts.map((attempt) => ({
          user_id: currentUser.id,
          client_id: attempt.clientId,
          played_at: attempt.playedAt,
          mode: attempt.mode,
          score: attempt.score,
          correct: attempt.correct,
          seed: attempt.seed,
          target: attempt.target,
          rounds: attempt.rounds
        }));
        const { error: uploadError } = await client.from("play_history").upsert(payload, { onConflict: "user_id,client_id" });
        if (uploadError) throw uploadError;
      }

      const { data, error: downloadError } = await client
        .from("play_history")
        .select("client_id,played_at,mode,score,correct,seed,target,rounds")
        .order("played_at", { ascending: false })
        .limit(MAX_LOCAL_ATTEMPTS);
      if (downloadError) throw downloadError;

      const merged = new Map();
      localAttempts.forEach((attempt) => merged.set(attempt.clientId, {
        ...attempt,
        ownerId: attempt.ownerId || currentUser.id
      }));
      (data || []).forEach((row) => {
        const attempt = rowToAttempt(row, currentUser.id);
        if (attempt) merged.set(attempt.clientId, attempt);
      });

      saveAttempts([...merged.values()].sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt)));
      renderHistory();
      setAccountStatus("History synced.", "success");
    })().catch(() => {
      setAccountStatus("Cloud sync is temporarily unavailable. Local history is safe.", "error");
    }).finally(() => {
      syncPromise = null;
    });

    return syncPromise;
  }

  async function handleSession(session) {
    currentUser = session && session.user ? session.user : null;
    renderAccount();
    if (currentUser) await syncHistory();
  }

  async function initCloud() {
    try {
      const client = await getCloudClient();
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      await handleSession(data.session);
      client.auth.onAuthStateChange((event, session) => {
        window.setTimeout(() => handleSession(session), 0);
      });
    } catch (error) {
      renderAccount();
      setAccountStatus("Cloud sync is temporarily unavailable. Local history still works.", "error");
    }
  }

  async function submitSignIn(event) {
    event.preventDefault();
    if (!signInForm.reportValidity()) return;
    signInSubmitButton.disabled = true;
    signInSubmitButton.textContent = "Sending...";
    setAccountStatus("Sending your secure sign-in link...");

    try {
      const client = await getCloudClient();
      const email = signInEmail.value.trim();
      const redirectUrl = `${window.location.origin}${window.location.pathname}`;
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectUrl }
      });
      if (error) throw error;
      signInForm.reset();
      setAccountStatus("Check your email and open the MinuteMix sign-in link.", "success");
    } catch (error) {
      setAccountStatus("The sign-in link could not be sent. Please try again.", "error");
    } finally {
      signInSubmitButton.disabled = false;
      signInSubmitButton.textContent = "Send sign-in link";
    }
  }

  async function signOut() {
    signOutButton.disabled = true;
    try {
      const client = await getCloudClient();
      const { error } = await client.auth.signOut();
      if (error) throw error;
      currentUser = null;
      renderAccount();
      setAccountStatus("Signed out. This device still keeps its local history.", "success");
    } catch (error) {
      setAccountStatus("Could not sign out. Please try again.", "error");
    } finally {
      signOutButton.disabled = false;
    }
  }

  function openHistory() {
    renderHistory();
    renderAccount();
    if (typeof historyDialog.showModal === "function") historyDialog.showModal();
    else historyDialog.setAttribute("open", "");
    historyCloseButton.focus();
  }

  function closeHistory() {
    if (typeof historyDialog.close === "function") historyDialog.close();
    else historyDialog.removeAttribute("open");
    historyButton.focus();
  }

  historyButton.addEventListener("click", openHistory);
  historyCloseButton.addEventListener("click", closeHistory);
  historyDialog.addEventListener("click", (event) => {
    if (event.target === historyDialog) closeHistory();
  });
  signInForm.addEventListener("submit", submitSignIn);
  signOutButton.addEventListener("click", signOut);

  migrateDailyProgress();
  renderHistory();
  renderAccount();
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(initCloud);
  else window.setTimeout(initCloud, 0);

  window.MinuteMixHistory = Object.freeze({
    recordAttempt,
    open: openHistory
  });
}());
