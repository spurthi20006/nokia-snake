/* ==========================================================================
   Nokia Snake — UI controller
   Wires the DOM (views, physical keypad, forms) to Auth/Api/SnakeGame.
   ========================================================================== */
(() => {
  const PARENT_VIEW = {
    auth: "home", mode: "home", difficulty: "home", leaderboard: "home",
    dashboard: "home", achievements: "home", daily: "home", settings: "home",
    about: "home", game: "home",
  };

  let currentView = "home";
  let authMode = "login"; // or "register"
  let selectedMode = "classic";
  let selectedDifficulty = "medium";
  let lbPeriod = "global";
  let settings = { theme: "classic", sound_enabled: true, music_enabled: true, volume: 0.7 };
  let fpsOn = false;
  let saveTimer = null;
  let countdownTimer = null;
  let konamiBuffer = [];
  const KONAMI = ["up","up","down","down","left","right","left","right","b","a"];

  const $ = (sel) => document.querySelector(sel);
  const $all = (sel) => Array.from(document.querySelectorAll(sel));

  /* ------------------------------------------------------------- toast */
  let toastTimer = null;
  function toast(msg, ms = 1800) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), ms);
  }

  /* ---------------------------------------------------------- view nav */
  function showView(name) {
    $all(".view").forEach((v) => v.classList.remove("active"));
    $(`#view-${name}`).classList.add("active");
    currentView = name;
    updateSoftkeys();
    if (name === "leaderboard") loadLeaderboard();
    if (name === "dashboard") loadDashboard();
    if (name === "achievements") loadAchievements();
    if (name === "daily") loadDaily();
    if (name === "home") refreshHomeMenu();
  }

  function updateSoftkeys() {
    const left = $("#softLeft"), right = $("#softRight");
    left.textContent = currentView === "home" ? "Exit" : "Back";
    const map = {
      home: "Select", auth: authMode === "login" ? "Login" : "Register",
      mode: "Select", difficulty: "Start", game: SnakeGame.isPaused() ? "Resume" : "Pause",
      leaderboard: "Select", dashboard: "Select", achievements: "Select",
      daily: "Select", settings: "Select", about: "Select",
    };
    right.textContent = map[currentView] || "Select";
  }

  function goBack() {
    if (currentView === "game") { confirmQuitGame(); return; }
    const parent = PARENT_VIEW[currentView] || "home";
    showView(parent);
  }

  /* ------------------------------------------------------- menu helper */
  function getMenuItems() {
    if (currentView === "home") return $all("#view-home .menu-list li");
    if (currentView === "mode") return $all("#view-mode .menu-list li");
    if (currentView === "difficulty") return $all("#view-difficulty .menu-list li");
    return [];
  }

  function moveSelection(delta) {
    const items = getMenuItems();
    if (!items.length) return;
    let idx = items.findIndex((i) => i.classList.contains("selected"));
    if (idx === -1) idx = 0;
    items[idx].classList.remove("selected");
    idx = (idx + delta + items.length) % items.length;
    items[idx].classList.add("selected");
    SoundFx.sfx.menuMove();
  }

  function activateSelection() {
    const items = getMenuItems();
    const el = items.find((i) => i.classList.contains("selected"));
    if (el) handleMenuActivate(el);
  }

  function handleMenuActivate(el) {
    SoundFx.sfx.menuSelect();
    if (currentView === "home") {
      const action = el.dataset.action;
      if (el.dataset.locked === "true" && action !== "continue") return;
      if (action === "new-game") { showView("mode"); }
      else if (action === "continue") { resumeSavedGame(); }
      else if (action === "goto-leaderboard") showView("leaderboard");
      else if (action === "goto-dashboard") showView("dashboard");
      else if (action === "goto-achievements") showView("achievements");
      else if (action === "goto-daily") showView("daily");
      else if (action === "goto-settings") showView("settings");
      else if (action === "goto-about") showView("about");
      else if (action === "goto-auth") {
        if (Auth.isLoggedIn()) { doLogout(); } else { authMode = "login"; renderAuthMode(); showView("auth"); }
      }
    } else if (currentView === "mode") {
      selectedMode = el.dataset.value;
      showView("difficulty");
    } else if (currentView === "difficulty") {
      selectedDifficulty = el.dataset.value;
      beginCountdown();
    }
  }

  function refreshHomeMenu() {
    const hasSave = !!localStorage.getItem("snake_save");
    const li = $('#view-home li[data-action="continue"]');
    li.dataset.locked = hasSave ? "false" : "true";
    loadHomeHighScore();
  }

  async function loadHomeHighScore() {
    $("#homeHighScore").textContent = localStorage.getItem("snake_highscore") || 0;
  }

  /* ------------------------------------------------------------- auth */
  function renderAuthMode() {
    $("#authTitle").textContent = authMode === "login" ? "LOGIN" : "REGISTER";
    $("#fieldEmail").classList.toggle("hidden", authMode === "login");
    $("#authSwitchHint").textContent = authMode === "login"
      ? "No account? Press * to Register"
      : "Have an account? Press * to Login";
    $("#authError").textContent = "";
  }

  async function submitAuth() {
    const username = $("#authUsername").value.trim();
    const email = $("#authEmail").value.trim();
    const password = $("#authPassword").value;
    $("#authError").textContent = "";

    let res;
    if (authMode === "login") {
      res = await Auth.login(username, password);
    } else {
      res = await Auth.register(username, email, password);
    }

    if (!res.success) {
      $("#authError").textContent = res.error || "Something went wrong.";
      return;
    }
    toast(authMode === "login" ? "Welcome back!" : "Account created!");
    await syncSettingsFromServer();
    showView("home");
  }

  async function doLogout() {
    await Auth.logout();
    toast("Logged out.");
    refreshHomeMenu();
  }

  /* --------------------------------------------------------- game flow */
  function beginCountdown() {
    showView("game");
    resetHud();
    $("#countdownOverlay").classList.add("active");
    $("#gameoverOverlay").classList.remove("active");
    $("#pauseOverlay").classList.remove("active");
    let n = 3;
    $("#countdownNum").textContent = n;
    SoundFx.unlock();
    clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(countdownTimer);
        $("#countdownOverlay").classList.remove("active");
        launchGame();
        return;
      }
      $("#countdownNum").textContent = n;
      SoundFx.sfx.menuMove();
    }, 700);
  }

  function launchGame(isAi = false) {
    localStorage.removeItem("snake_save");
    SnakeGame.start(selectedMode, selectedDifficulty, isAi);
    SoundFx.startMusic();
    $("#hudDifficulty").textContent = selectedDifficulty;
    startAutoSave();
    updateSoftkeys();
  }

  function resumeSavedGame() {
    const raw = localStorage.getItem("snake_save");
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      showView("game");
      resetHud();
      $("#hudDifficulty").textContent = saved.difficulty;
      SnakeGame.loadState(saved);
      SoundFx.startMusic();
      startAutoSave();
      updateSoftkeys();
    } catch (e) {
      toast("Save data corrupted.");
      localStorage.removeItem("snake_save");
    }
  }

  function startAutoSave() {
    clearInterval(saveTimer);
    saveTimer = setInterval(() => {
      if (SnakeGame.isRunning()) {
        localStorage.setItem("snake_save", SnakeGame.serialize());
      }
    }, 2000);
  }

  function resetHud() {
    $("#hudScore").textContent = "0";
    $("#hudLength").textContent = "3";
    $("#hudSpeed").textContent = "1.0x";
    $("#hudCombo").textContent = "x1";
    $("#hudPowerup").textContent = "No power-up active";
  }

  function confirmQuitGame() {
    clearInterval(saveTimer);
    if (SnakeGame.isRunning()) {
      localStorage.setItem("snake_save", SnakeGame.serialize());
    }
    SnakeGame.stop();
    SoundFx.stopMusic();
    showView("home");
  }

  function togglePause() {
    if (!SnakeGame.isRunning() && !SnakeGame.isPaused()) return;
    if (SnakeGame.isPaused()) {
      SnakeGame.resume();
      $("#pauseOverlay").classList.remove("active");
    } else {
      SnakeGame.pause();
      $("#pauseOverlay").classList.add("active");
      SoundFx.sfx.pause();
    }
    updateSoftkeys();
  }

  /* --------------------------------------------------------- callbacks */
  SnakeGame.on("scoreChange", (score) => { $("#hudScore").textContent = score; });

  SnakeGame.on("eat", (info) => {
    if (info.type === "golden") SoundFx.sfx.eatGolden();
    else if (info.type === "poison") SoundFx.sfx.eatPoison();
    else SoundFx.sfx.eat();
    $("#hudCombo").textContent = "x" + info.combo;
    $("#hudLength").textContent = SnakeGame.publicState().length;
  });

  SnakeGame.on("powerupChange", (list) => {
    if (!list || !list.length) {
      $("#hudPowerup").textContent = "No power-up active";
    } else {
      SoundFx.sfx.powerup();
      $("#hudPowerup").textContent = list.map((p) => `${p.icon} ${p.label} (${Math.ceil(p.msLeft / 1000)}s)`).join(" · ");
    }
  });

  SnakeGame.on("stateTick", (s) => {
    $("#hudSpeed").textContent = s.speedMultiplier + "x";
    $("#hudLength").textContent = s.length;
  });

  SnakeGame.on("gameOver", async (result) => {
    clearInterval(saveTimer);
    localStorage.removeItem("snake_save");
    SoundFx.stopMusic();
    SoundFx.sfx.gameOver();
    $("#gameoverOverlay").classList.add("active");
    $("#gameoverScore").textContent = `Score: ${result.score}`;
    $("#gameoverNewHigh").textContent = "";
    $("#gameoverAch").textContent = "";
    updateSoftkeys();

    const prevBest = parseInt(localStorage.getItem("snake_highscore") || "0", 10);
    if (result.score > prevBest) localStorage.setItem("snake_highscore", result.score);

    if (Auth.isLoggedIn()) {
      const res = await Api.saveScore({
        score: result.score,
        length: result.length,
        mode: result.mode,
        difficulty: result.difficulty,
        food_eaten: result.foodEaten,
        play_time: Math.round(result.elapsed / 1000),
        max_combo: result.maxCombo,
        golden_eaten_total: result.goldenEatenTotal,
      });
      if (res.success) {
        if (res.is_high_score) $("#gameoverNewHigh").textContent = "New personal best!";
        if (res.unlocked_achievements && res.unlocked_achievements.length) {
          $("#gameoverAch").textContent = "Unlocked: " + res.unlocked_achievements.join(", ");
        }
        checkDailyChallengeCompletion(result);
      }
    } else {
      $("#gameoverAch").textContent = "Log in to save scores & unlock achievements.";
    }
  });

  async function checkDailyChallengeCompletion(result) {
    const res = await Api.dailyChallenge();
    if (!res.success || res.completed) return;
    const c = res.challenge;
    let done = false;
    if (c.key === "eat_20_food" && result.foodEaten >= 20) done = true;
    if (c.key === "score_150" && result.score >= 150) done = true;
    if (c.key === "eat_3_golden" && result.goldenEatenTotal >= 3) done = true;
    if (c.key === "survive_120s" && result.elapsed / 1000 >= 120) done = true;
    if (c.key === "combo_4x" && result.maxCombo >= 4) done = true;
    if (done) {
      await Api.completeDailyChallenge();
      toast("Daily challenge complete!");
    }
  }

  /* --------------------------------------------------------- retry/menu */
  function retryGame() {
    $("#gameoverOverlay").classList.remove("active");
    beginCountdown();
  }

  /* ------------------------------------------------------ leaderboard */
  async function loadLeaderboard() {
    const table = $("#lbTable");
    table.innerHTML = '<div class="lcd-sub" style="font-size:14px;">Loading...</div>';
    const res = await Api.leaderboard(lbPeriod);
    if (!res.success) {
      table.innerHTML = `<div class="lcd-sub" style="font-size:14px;">${res.error || "Could not load."}</div>`;
      return;
    }
    if (!res.entries.length) {
      table.innerHTML = '<div class="lcd-sub" style="font-size:14px;">No scores yet.</div>';
      return;
    }
    table.innerHTML = res.entries.map((e) =>
      `<div class="lb-row"><span class="rank">${e.rank}</span><span class="uname">${escapeHtml(e.username)}</span><span class="score">${e.score}</span></div>`
    ).join("");
  }

  /* -------------------------------------------------------- dashboard */
  async function loadDashboard() {
    const grid = $("#statsGrid");
    if (!Auth.isLoggedIn()) {
      grid.innerHTML = '<div class="lcd-sub" style="font-size:14px;">Login to view stats</div>';
      return;
    }
    const res = await Api.statistics();
    if (!res.success) {
      grid.innerHTML = '<div class="lcd-sub" style="font-size:14px;">Could not load stats.</div>';
      return;
    }
    const s = res.statistics;
    const boxes = [
      ["Highest Score", s.highest_score],
      ["Average Score", s.average_score],
      ["Longest Snake", s.longest_snake],
      ["Games Played", s.games_played],
      ["Food Eaten", s.total_food_eaten],
      ["Play Time (s)", s.total_play_time],
      ["Favorite Mode", s.favorite_mode || "-"],
      ["Win %", s.win_percentage + "%"],
    ];
    grid.innerHTML = boxes.map(([label, val]) =>
      `<div class="stat-box"><div class="label">${label}</div><div class="value">${val}</div></div>`
    ).join("");
  }

  /* ---------------------------------------------------- achievements */
  async function loadAchievements() {
    const grid = $("#achGrid");
    if (!Auth.isLoggedIn()) {
      grid.innerHTML = '<div class="lcd-sub" style="font-size:14px;">Login to view achievements</div>';
      return;
    }
    const res = await Api.achievements();
    if (!res.success) {
      grid.innerHTML = '<div class="lcd-sub" style="font-size:14px;">Could not load.</div>';
      return;
    }
    grid.innerHTML = res.achievements.map((a) =>
      `<div class="ach-card ${a.unlocked ? "unlocked" : ""}">
        <div class="icon">${a.icon}</div>
        <div class="meta"><div class="name">${a.name}</div><div class="desc">${a.description}</div></div>
      </div>`
    ).join("");
  }

  /* -------------------------------------------------------------- daily */
  async function loadDaily() {
    if (!Auth.isLoggedIn()) {
      $("#dailyDesc").textContent = "Login to view today's challenge";
      $("#dailyStatus").textContent = "";
      return;
    }
    const res = await Api.dailyChallenge();
    if (!res.success) return;
    $("#dailyDesc").textContent = res.challenge.description;
    $("#dailyStatus").textContent = res.completed ? "✔ Completed today" : "Not completed yet — play a game!";
  }

  /* -------------------------------------------------------------- settings */
  async function syncSettingsFromServer() {
    if (Auth.isLoggedIn()) {
      const res = await Api.getSettings();
      if (res.success) settings = { ...settings, ...res.settings };
    } else {
      const raw = localStorage.getItem("snake_settings");
      if (raw) settings = { ...settings, ...JSON.parse(raw) };
    }
    applySettingsToUi();
  }

  function applySettingsToUi() {
    document.documentElement.setAttribute("data-theme", settings.theme || "classic");
    $all(".theme-swatches .swatch").forEach((s) => s.classList.toggle("active", s.dataset.theme === settings.theme));
    $("#toggleSound").classList.toggle("on", !!settings.sound_enabled);
    $("#toggleMusic").classList.toggle("on", !!settings.music_enabled);
    $("#volumeSlider").value = settings.volume ?? 0.7;
    SoundFx.setSfxEnabled(!!settings.sound_enabled);
    SoundFx.setMusicEnabled(!!settings.music_enabled);
    SoundFx.setVolume(settings.volume ?? 0.7);
  }

  async function persistSettings() {
    if (Auth.isLoggedIn()) {
      await Api.updateSettings(settings);
    } else {
      localStorage.setItem("snake_settings", JSON.stringify(settings));
    }
  }

  function wireSettingsControls() {
    $all(".theme-swatches .swatch").forEach((sw) => {
      sw.addEventListener("click", () => {
        settings.theme = sw.dataset.theme;
        applySettingsToUi();
        persistSettings();
      });
    });
    $("#toggleSound").addEventListener("click", () => {
      settings.sound_enabled = !settings.sound_enabled;
      applySettingsToUi(); persistSettings();
    });
    $("#toggleMusic").addEventListener("click", () => {
      settings.music_enabled = !settings.music_enabled;
      applySettingsToUi(); persistSettings();
      if (settings.music_enabled && SnakeGame.isRunning()) SoundFx.startMusic();
    });
    $("#volumeSlider").addEventListener("input", (e) => {
      settings.volume = parseFloat(e.target.value);
      SoundFx.setVolume(settings.volume);
      persistSettings();
    });
    $("#toggleFps").addEventListener("click", () => {
      fpsOn = !fpsOn;
      $("#toggleFps").classList.toggle("on", fpsOn);
      SnakeGame.toggleFps(fpsOn);
      localStorage.setItem("snake_fps", fpsOn ? "1" : "0");
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* --------------------------------------------------- leaderboard tabs */
  function wireLeaderboardTabs() {
    $all("#lbTabs button").forEach((btn) => {
      btn.addEventListener("click", () => {
        $all("#lbTabs button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        lbPeriod = btn.dataset.period;
        loadLeaderboard();
      });
    });
  }

  /* ------------------------------------------------------- screenshot */
  function takeScreenshot() {
    const canvas = $("#gameCanvas");
    const link = document.createElement("a");
    link.download = `nokia-snake-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast("Screenshot saved");
  }

  function toggleFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.();
    }
  }

  /* --------------------------------------------------------- replay */
  function playReplay() {
    const frames = SnakeGame.getReplay();
    if (!frames.length) { toast("No replay available yet."); return; }
    toast("Replaying last game...");
    showView("game");
    $("#gameoverOverlay").classList.remove("active");
    const canvas = $("#gameCanvas");
    const ctx = canvas.getContext("2d");
    const cs = canvas.width / (window.devicePixelRatio || 1) / SnakeGame.GRID;
    let i = 0;
    const step = () => {
      if (i >= frames.length) { showView("home"); return; }
      const f = frames[i];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const styles = getComputedStyle(document.documentElement);
      ctx.fillStyle = styles.getPropertyValue("--lcd-fg-dim").trim();
      f.obstacles.forEach((o) => ctx.fillRect(o.x * cs, o.y * cs, cs - 1, cs - 1));
      if (f.food) {
        ctx.fillStyle = styles.getPropertyValue("--lcd-fg").trim();
        ctx.fillRect(f.food.x * cs, f.food.y * cs, cs - 1, cs - 1);
      }
      f.snake.forEach((s, idx) => {
        ctx.fillStyle = idx === 0 ? styles.getPropertyValue("--lcd-fg").trim() : styles.getPropertyValue("--lcd-fg-dim").trim();
        ctx.fillRect(s.x * cs, s.y * cs, cs - 1, cs - 1);
      });
      i += 4; // skip frames for a faster playback
      requestAnimationFrame(() => setTimeout(step, 16));
    };
    step();
  }

  /* --------------------------------------------------------- AI demo */
  function startAiDemo() {
    selectedMode = "classic";
    selectedDifficulty = "medium";
    showView("game");
    resetHud();
    $("#gameoverOverlay").classList.remove("active");
    $("#pauseOverlay").classList.remove("active");
    $("#countdownOverlay").classList.remove("active");
    toast("AI demo — press Back to stop");
    launchGame(true);
  }

  /* ---------------------------------------------------------- keypad */
  function handleDirKey(dir) {
    if (currentView === "game" && !SnakeGame.isPaused()) {
      if (dir === "ok") togglePause();
      else SnakeGame.setDirection(dir);
      return;
    }
    if (currentView === "game" && SnakeGame.isPaused()) {
      if (dir === "ok") togglePause();
      return;
    }
    if (dir === "up") moveSelection(-1);
    else if (dir === "down") moveSelection(1);
    else if (dir === "left" && currentView === "leaderboard") cycleTab(-1);
    else if (dir === "right" && currentView === "leaderboard") cycleTab(1);
    else if (dir === "ok") activateSelection();
  }

  function cycleTab(delta) {
    const tabs = $all("#lbTabs button");
    let idx = tabs.findIndex((t) => t.classList.contains("active"));
    idx = (idx + delta + tabs.length) % tabs.length;
    tabs[idx].click();
  }

  function handleNumberKey(key) {
    if (key === "1") { settings.sound_enabled = !settings.sound_enabled; applySettingsToUi(); persistSettings(); toast(settings.sound_enabled ? "Sound on" : "Sound off"); }
    else if (key === "3") { $("#toggleFps").click(); toast(fpsOn ? "FPS shown" : "FPS hidden"); }
    else if (key === "7") cycleTheme();
    else if (key === "9") { if (currentView === "game") takeScreenshot(); }
    else if (key === "*") {
      if (currentView === "auth") { authMode = authMode === "login" ? "register" : "login"; renderAuthMode(); }
      else if (currentView === "home") startAiDemo();
    } else if (key === "0") toggleFullscreen();
    else if (key === "#") playReplay();
  }

  function cycleTheme() {
    const order = ["classic", "dark", "neon", "blue"];
    const idx = order.indexOf(settings.theme);
    settings.theme = order[(idx + 1) % order.length];
    applySettingsToUi();
    persistSettings();
    toast("Theme: " + settings.theme);
  }

  function wireKeypad() {
    $all("[data-dir]").forEach((btn) => {
      btn.addEventListener("click", () => handleDirKey(btn.dataset.dir));
    });
    $("#dpadCenter").addEventListener("click", () => handleDirKey("ok"));
    $all("[data-key]").forEach((btn) => {
      btn.addEventListener("click", () => handleNumberKey(btn.dataset.key));
    });
    $("#softLeft").addEventListener("click", goBack);
    $("#softRight").addEventListener("click", () => {
      if (currentView === "home") activateSelection();
      else if (currentView === "auth") submitAuth();
      else if (currentView === "mode") activateSelection();
      else if (currentView === "difficulty") activateSelection();
      else if (currentView === "game") togglePause();
      else activateSelection();
    });
  }

  /* ------------------------------------------------------ keyboard */
  function wireKeyboard() {
    window.addEventListener("keydown", (e) => {
      const k = e.key;
      let dirKey = null;
      if (k === "ArrowUp" || k === "w" || k === "W") dirKey = "up";
      else if (k === "ArrowDown" || k === "s" || k === "S") dirKey = "down";
      else if (k === "ArrowLeft" || k === "a" || k === "A") dirKey = "left";
      else if (k === "ArrowRight" || k === "d" || k === "D") dirKey = "right";

      trackKonami(dirKey || k);

      if (dirKey) { e.preventDefault(); handleDirKey(dirKey); return; }
      if (k === "Enter" || k === " ") { e.preventDefault(); handleDirKey("ok"); }
      if (k === "Escape") { e.preventDefault(); goBack(); }
      if (currentView === "auth" && k === "*") handleNumberKey("*");
    });

    // touch swipe on canvas
    let touchStart = null;
    const canvas = $("#gameCanvas");
    canvas.addEventListener("touchstart", (e) => {
      const t = e.touches[0];
      touchStart = { x: t.clientX, y: t.clientY };
    }, { passive: true });
    canvas.addEventListener("touchend", (e) => {
      if (!touchStart) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) { touchStart = null; return; }
      if (Math.abs(dx) > Math.abs(dy)) handleDirKey(dx > 0 ? "right" : "left");
      else handleDirKey(dy > 0 ? "down" : "up");
      touchStart = null;
    }, { passive: true });
  }

  function trackKonami(key) {
    const norm = (key || "").toLowerCase();
    const map = { arrowup: "up", arrowdown: "down", arrowleft: "left", arrowright: "right" };
    const k = map[norm] || norm;
    konamiBuffer.push(k);
    if (konamiBuffer.length > KONAMI.length) konamiBuffer.shift();
    if (konamiBuffer.join(",") === KONAMI.join(",")) {
      SnakeGame.setRainbow(true);
      toast("🌈 Easter egg unlocked: rainbow snake!");
      konamiBuffer = [];
    }
  }

  /* --------------------------------------------------------- overlays */
  function wireOverlays() {
    $("#gameoverOverlay").addEventListener("click", () => {});
  }

  /* -------------------------------------------------------------- init */
  async function init() {
    SnakeGame.init($("#gameCanvas"));
    wireKeypad();
    wireKeyboard();
    wireSettingsControls();
    wireLeaderboardTabs();
    wireOverlays();

    fpsOn = localStorage.getItem("snake_fps") === "1";
    $("#toggleFps").classList.toggle("on", fpsOn);
    SnakeGame.toggleFps(fpsOn);

    await Auth.refresh();
    await syncSettingsFromServer();
    refreshHomeMenu();

    // override softRight for gameover/pause contexts via overlay-aware click
    $("#gameoverOverlay").addEventListener("dblclick", retryGame);

    // Use softkeys contextually for gameover screen too
    document.addEventListener("keydown", (e) => {
      if ($("#gameoverOverlay").classList.contains("active")) {
        if (e.key === "Enter") retryGame();
      }
    });

    // Wire softRight specifically for retry when gameover is active
    const origSoftRight = $("#softRight");
    origSoftRight.addEventListener("click", () => {
      if ($("#gameoverOverlay").classList.contains("active")) retryGame();
    });
    $("#softLeft").addEventListener("click", () => {
      if ($("#gameoverOverlay").classList.contains("active")) {
        $("#gameoverOverlay").classList.remove("active");
        showView("home");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
