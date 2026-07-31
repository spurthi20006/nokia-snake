/* ==========================================================================
   Nokia Snake — game engine
   Grid-based snake with 4 modes, 3 difficulties, 3 food types, 6 power-ups,
   dynamic obstacles, combo multiplier, particles, replay recording and a
   simple greedy AI auto-play mode.
   ========================================================================== */
const SnakeGame = (() => {
  const GRID = 20; // 20x20 logical grid, canvas is square and scales to it

  const DIFFICULTY_INTERVAL = { easy: 170, medium: 125, hard: 90 };
  const MIN_INTERVAL = 55;

  const POWERUP_TYPES = {
    shield: { icon: "🛡", label: "Shield", duration: 8000 },
    speed: { icon: "⚡", label: "Speed Boost", duration: 6000 },
    slow: { icon: "🐢", label: "Slow Motion", duration: 6000 },
    magnet: { icon: "🧲", label: "Magnet", duration: 8000 },
    double: { icon: "💎", label: "Double Score", duration: 10000 },
    ghost: { icon: "👻", label: "Ghost Mode", duration: 6000 },
  };

  const MAZE_LAYOUT = (() => {
    // A small fixed obstacle ring used only in Maze mode.
    const cells = [];
    for (let x = 5; x <= 14; x++) { cells.push([x, 5]); cells.push([x, 14]); }
    for (let y = 6; y <= 13; y++) { cells.push([5, y]); cells.push([14, y]); }
    return cells.filter((_, i) => i % 2 === 0); // make it porous, not a sealed box
  })();

  let canvas, ctx;
  let state = null;
  let rafId = null;
  let lastFrameTime = 0;
  let tickAccumulator = 0;
  let fpsVisible = false;
  let fpsValue = 0;
  let fpsAccum = { frames: 0, time: 0 };
  let rainbowMode = false;
  let rainbowHue = 0;

  const callbacks = {
    onScoreChange: () => {},
    onEat: () => {},
    onPowerupChange: () => {},
    onGameOver: () => {},
    onCountdownTick: () => {},
    onStateTick: () => {},
  };

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext("2d");
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
  }

  function resizeCanvas() {
    const wrap = canvas.parentElement;
    const size = Math.min(wrap.clientWidth, wrap.clientHeight) || 300;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function cellSize() {
    return (canvas.width / (window.devicePixelRatio || 1)) / GRID;
  }

  function newState(mode, difficulty, isAi = false) {
    const mid = Math.floor(GRID / 2);
    return {
      mode, difficulty, isAi,
      snake: [{ x: mid - 1, y: mid }, { x: mid - 2, y: mid }, { x: mid - 3, y: mid }],
      direction: "right",
      pendingDirection: "right",
      score: 0,
      foodEaten: 0,
      goldenEatenTotal: 0,
      combo: 1,
      maxCombo: 1,
      lastEatAt: 0,
      obstacles: mode === "maze" ? MAZE_LAYOUT.map(([x, y]) => ({ x, y })) : [],
      food: null,
      powerupOnBoard: null,
      activePowerups: {}, // type -> expiry timestamp (ms, game clock)
      shieldCharges: 0,
      elapsed: 0,
      running: false,
      paused: false,
      gameOver: false,
      baseInterval: DIFFICULTY_INTERVAL[difficulty] || DIFFICULTY_INTERVAL.medium,
      currentInterval: DIFFICULTY_INTERVAL[difficulty] || DIFFICULTY_INTERVAL.medium,
      particles: [],
      replay: [],
      lastPowerupSpawnAt: 0,
    };
  }

  function start(mode, difficulty, isAi = false) {
    state = newState(mode, difficulty, isAi);
    spawnFood();
    state.running = true;
    lastFrameTime = performance.now();
    tickAccumulator = 0;
    loop(lastFrameTime);
  }

  function loadState(saved) {
    state = saved;
    state.running = true;
    state.gameOver = false;
    state.paused = false;
    // Any performance.now()-based timestamps from a previous page load are
    // no longer meaningful (the clock resets on reload), so clear anything
    // time-relative rather than risk misfiring expiry/spawn logic.
    state.activePowerups = {};
    state.shieldCharges = 0;
    state.powerupOnBoard = null;
    state.lastEatAt = 0;
    state.lastPowerupSpawnAt = performance.now();
    lastFrameTime = performance.now();
    tickAccumulator = 0;
    loop(lastFrameTime);
  }

  function stop() {
    state.running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function pause() {
    if (!state) return;
    state.paused = true;
  }
  function resume() {
    if (!state) return;
    state.paused = false;
    lastFrameTime = performance.now();
  }
  function isPaused() { return state && state.paused; }
  function isRunning() { return state && state.running && !state.gameOver; }

  function setDirection(dir) {
    if (!state || state.gameOver) return;
    const opposite = { up: "down", down: "up", left: "right", right: "left" };
    if (state.snake.length > 1 && opposite[dir] === state.direction) return;
    state.pendingDirection = dir;
  }

  function toggleFps(v) { fpsVisible = v; }
  function setRainbow(v) { rainbowMode = v; }

  /* ---------------------------------------------------------------- loop */
  function loop(now) {
    rafId = requestAnimationFrame(loop);
    const dt = now - lastFrameTime;
    lastFrameTime = now;

    // fps
    fpsAccum.frames++; fpsAccum.time += dt;
    if (fpsAccum.time >= 500) {
      fpsValue = Math.round((fpsAccum.frames * 1000) / fpsAccum.time);
      fpsAccum = { frames: 0, time: 0 };
    }

    if (!state.running || state.gameOver) return;

    updateParticles(dt);

    if (!state.paused) {
      state.elapsed += dt;
      tickAccumulator += dt;
      expirePowerups(now);

      const interval = currentInterval();
      while (tickAccumulator >= interval) {
        tickAccumulator -= interval;
        step();
        if (state.gameOver) break;
      }
    }

    render();
  }

  function currentInterval() {
    let interval = state.baseInterval;
    const speedLevel = Math.floor(state.foodEaten / 5);
    interval -= speedLevel * 8;
    if (state.activePowerups.speed) interval *= 0.55;
    if (state.activePowerups.slow) interval *= 1.8;
    return Math.max(MIN_INTERVAL, interval);
  }

  /* --------------------------------------------------------------- step */
  function step() {
    state.direction = state.pendingDirection;
    if (state.isAi) aiDecide();

    const head = state.snake[0];
    let nx = head.x, ny = head.y;
    if (state.direction === "up") ny -= 1;
    if (state.direction === "down") ny += 1;
    if (state.direction === "left") nx -= 1;
    if (state.direction === "right") nx += 1;

    const wrapsWalls = state.mode === "wrap" || state.mode === "endless" || state.activePowerups.ghost;

    let wallDeath = false;
    if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) {
      if (wrapsWalls) {
        nx = (nx + GRID) % GRID;
        ny = (ny + GRID) % GRID;
      } else {
        wallDeath = true;
      }
    }

    const ghost = !!state.activePowerups.ghost;
    const selfHit = !ghost && state.snake.some((seg, i) => i !== state.snake.length - 1 && seg.x === nx && seg.y === ny);
    const obstacleHit = !ghost && state.obstacles.some((o) => o.x === nx && o.y === ny);

    if (wallDeath || selfHit || obstacleHit) {
      if (state.shieldCharges > 0) {
        state.shieldCharges -= 1;
        if (state.shieldCharges <= 0) delete state.activePowerups.shield;
        callbacks.onPowerupChange(activePowerupSummary());
        recordReplayFrame();
        return; // survive this tick, snake does not move
      }
      endGame();
      return;
    }

    state.snake.unshift({ x: nx, y: ny });

    let ate = false;
    if (state.food && state.food.x === nx && state.food.y === ny) {
      ate = true;
      handleFoodEaten(state.food);
      spawnFood();
    }

    if (state.powerupOnBoard && state.powerupOnBoard.x === nx && state.powerupOnBoard.y === ny) {
      activatePowerup(state.powerupOnBoard.type);
      state.powerupOnBoard = null;
    }

    if (!ate) {
      state.snake.pop();
    }

    maybeSpawnObstacle();
    maybeSpawnPowerup();
    applyMagnet();
    recordReplayFrame();
    callbacks.onStateTick(publicState());
  }

  function handleFoodEaten(food) {
    const now = performance.now();
    if (now - state.lastEatAt < 3000) {
      state.combo = Math.min(5, state.combo + 1);
    } else {
      state.combo = 1;
    }
    state.lastEatAt = now;
    state.maxCombo = Math.max(state.maxCombo, state.combo);

    let base = 0;
    if (food.type === "normal") base = 10;
    if (food.type === "golden") { base = 50; state.goldenEatenTotal += 1; }
    if (food.type === "poison") base = -10;

    let points = base;
    if (base > 0) {
      points *= state.combo;
      if (state.activePowerups.double) points *= 2;
    }

    state.score = Math.max(0, state.score + Math.round(points));
    state.foodEaten += 1;

    if (food.type === "poison") {
      shrinkToMin(3);
    } else {
      // growth already handled by not popping tail in step()
    }

    spawnParticles(food.x, food.y, food.type);
    callbacks.onEat({ type: food.type, points: Math.round(points), combo: state.combo });
    callbacks.onScoreChange(state.score);
  }

  function shrinkToMin(minLen) {
    while (state.snake.length > minLen) state.snake.pop();
  }

  function spawnFood() {
    const free = freeCells();
    if (!free.length) return;
    const roll = Math.random();
    let type = "normal";
    if (roll < 0.12) type = "poison";
    else if (roll < 0.30) type = "golden";
    const cell = free[Math.floor(Math.random() * free.length)];
    state.food = { ...cell, type, spawnedAt: performance.now() };
    if (type === "golden") {
      const token = state.food;
      setTimeout(() => {
        if (state.food === token) spawnFood();
      }, 5000);
    }
  }

  function maybeSpawnPowerup() {
    if (state.powerupOnBoard) return;
    if (performance.now() - state.lastPowerupSpawnAt < 9000) return;
    if (Math.random() > 0.012) return; // small chance each tick once cooldown passed
    const free = freeCells();
    if (!free.length) return;
    const types = Object.keys(POWERUP_TYPES);
    const type = types[Math.floor(Math.random() * types.length)];
    const cell = free[Math.floor(Math.random() * free.length)];
    state.powerupOnBoard = { ...cell, type, spawnedAt: performance.now() };
    state.lastPowerupSpawnAt = performance.now();
    const token = state.powerupOnBoard;
    setTimeout(() => {
      if (state.powerupOnBoard === token) state.powerupOnBoard = null;
    }, 6000);
  }

  function activatePowerup(type) {
    const meta = POWERUP_TYPES[type];
    state.activePowerups[type] = performance.now() + meta.duration;
    if (type === "shield") state.shieldCharges = 1;
    callbacks.onPowerupChange(activePowerupSummary());
  }

  function expirePowerups(now) {
    let changed = false;
    for (const key of Object.keys(state.activePowerups)) {
      if (now >= state.activePowerups[key]) {
        delete state.activePowerups[key];
        if (key === "shield") state.shieldCharges = 0;
        changed = true;
      }
    }
    if (changed) callbacks.onPowerupChange(activePowerupSummary());
  }

  function activePowerupSummary() {
    const keys = Object.keys(state.activePowerups);
    if (!keys.length) return null;
    return keys.map((k) => ({
      type: k,
      icon: POWERUP_TYPES[k].icon,
      label: POWERUP_TYPES[k].label,
      msLeft: Math.max(0, Math.round(state.activePowerups[k] - performance.now())),
    }));
  }

  function applyMagnet() {
    if (!state.activePowerups.magnet || !state.food) return;
    const head = state.snake[0];
    const dist = Math.abs(head.x - state.food.x) + Math.abs(head.y - state.food.y);
    if (dist <= 6 && dist > 0) {
      if (state.food.x < head.x) state.food.x++;
      else if (state.food.x > head.x) state.food.x--;
      if (state.food.y < head.y) state.food.y++;
      else if (state.food.y > head.y) state.food.y--;
    }
  }

  function maybeSpawnObstacle() {
    if (state.mode === "endless") return; // endless never adds hazards
    if (state.score < 100) return;
    const maxObstacles = Math.min(14, 4 + Math.floor(state.score / 100));
    if (state.obstacles.length >= maxObstacles) return;
    if (Math.random() > 0.02) return;
    const free = freeCells();
    if (!free.length) return;
    const cell = free[Math.floor(Math.random() * free.length)];
    state.obstacles.push(cell);
  }

  function freeCells() {
    const occupied = new Set();
    state.snake.forEach((s) => occupied.add(`${s.x},${s.y}`));
    state.obstacles.forEach((o) => occupied.add(`${o.x},${o.y}`));
    if (state.food) occupied.add(`${state.food.x},${state.food.y}`);
    if (state.powerupOnBoard) occupied.add(`${state.powerupOnBoard.x},${state.powerupOnBoard.y}`);
    const cells = [];
    for (let x = 0; x < GRID; x++) {
      for (let y = 0; y < GRID; y++) {
        if (!occupied.has(`${x},${y}`)) cells.push({ x, y });
      }
    }
    return cells;
  }

  function endGame() {
    state.gameOver = true;
    state.running = false;
    recordReplayFrame();
    callbacks.onGameOver(publicState());
  }

  /* ------------------------------------------------------------ AI demo */
  function aiDecide() {
    if (!state.food) return;
    const head = state.snake[0];
    const dirs = ["up", "down", "left", "right"];
    const opposite = { up: "down", down: "up", left: "right", right: "left" };
    let best = state.direction;
    let bestDist = Infinity;
    for (const d of dirs) {
      if (opposite[d] === state.direction) continue;
      let nx = head.x, ny = head.y;
      if (d === "up") ny -= 1;
      if (d === "down") ny += 1;
      if (d === "left") nx -= 1;
      if (d === "right") nx += 1;
      const wrapped = ((nx % GRID) + GRID) % GRID;
      const wrappedY = ((ny % GRID) + GRID) % GRID;
      const collides = state.snake.some((s) => s.x === wrapped && s.y === wrappedY);
      if (collides) continue;
      const dist = Math.abs(wrapped - state.food.x) + Math.abs(wrappedY - state.food.y);
      if (dist < bestDist) { bestDist = dist; best = d; }
    }
    state.pendingDirection = best;
  }

  /* ---------------------------------------------------------- particles */
  function spawnParticles(gx, gy, type) {
    const colors = { normal: "#0f380f", golden: "#e0c200", poison: "#5a1b1b" };
    const cs = cellSize();
    const cx = gx * cs + cs / 2, cy = gy * cs + cs / 2;
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * 2 * i) / 10;
      state.particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * 0.06, vy: Math.sin(angle) * 0.06,
        life: 400, maxLife: 400, color: colors[type] || "#0f380f",
      });
    }
  }

  function updateParticles(dt) {
    if (!state) return;
    state.particles = state.particles.filter((p) => p.life > 0);
    for (const p of state.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    }
  }

  /* -------------------------------------------------------------- replay */
  function recordReplayFrame() {
    if (state.replay.length > 1800) state.replay.shift();
    state.replay.push({
      snake: state.snake.map((s) => ({ ...s })),
      food: state.food ? { ...state.food } : null,
      obstacles: state.obstacles.map((o) => ({ ...o })),
      score: state.score,
    });
  }

  function getReplay() { return state ? state.replay : []; }

  /* --------------------------------------------------------------- draw */
  function render() {
    if (!ctx) return;
    const cs = cellSize();
    const size = cs * GRID;
    const styles = getComputedStyle(document.documentElement);
    const fg = styles.getPropertyValue("--lcd-fg").trim() || "#0f380f";
    const fgDim = styles.getPropertyValue("--lcd-fg-dim").trim() || "#306230";
    const danger = styles.getPropertyValue("--lcd-danger").trim() || "#4a0f0f";

    ctx.clearRect(0, 0, size, size);

    // obstacles
    ctx.fillStyle = fgDim;
    state.obstacles.forEach((o) => {
      ctx.fillRect(o.x * cs + 1, o.y * cs + 1, cs - 2, cs - 2);
    });

    // food
    if (state.food) {
      const icon = state.food.type === "golden" ? "★" : state.food.type === "poison" ? "☠" : "●";
      ctx.fillStyle = state.food.type === "poison" ? danger : state.food.type === "golden" ? "#e0c200" : fg;
      ctx.font = `${cs * 0.8}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(icon, state.food.x * cs + cs / 2, state.food.y * cs + cs / 2 + 1);
    }

    // powerup pickup
    if (state.powerupOnBoard) {
      const meta = POWERUP_TYPES[state.powerupOnBoard.type];
      ctx.font = `${cs * 0.75}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(meta.icon, state.powerupOnBoard.x * cs + cs / 2, state.powerupOnBoard.y * cs + cs / 2 + 1);
    }

    // snake
    state.snake.forEach((seg, i) => {
      if (rainbowMode) {
        ctx.fillStyle = `hsl(${(rainbowHue + i * 18) % 360}, 70%, 40%)`;
      } else {
        ctx.fillStyle = i === 0 ? fg : fgDim;
      }
      const pad = i === 0 ? 0.5 : 1.2;
      ctx.fillRect(seg.x * cs + pad, seg.y * cs + pad, cs - pad * 2, cs - pad * 2);
    });
    if (rainbowMode) rainbowHue = (rainbowHue + 4) % 360;

    if (state.activePowerups.ghost) {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = fg;
      state.snake.forEach((seg) => ctx.fillRect(seg.x * cs, seg.y * cs, cs, cs));
      ctx.globalAlpha = 1;
    }

    // particles
    state.particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    });
    ctx.globalAlpha = 1;

    if (fpsVisible) {
      ctx.fillStyle = fg;
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`${fpsValue} fps`, 2, 2);
    }
  }

  /* --------------------------------------------------------- public API */
  function publicState() {
    if (!state) return null;
    return {
      score: state.score,
      length: state.snake.length,
      foodEaten: state.foodEaten,
      goldenEatenTotal: state.goldenEatenTotal,
      combo: state.combo,
      maxCombo: state.maxCombo,
      mode: state.mode,
      difficulty: state.difficulty,
      elapsed: state.elapsed,
      speedMultiplier: (state.baseInterval / currentInterval()).toFixed(1),
      gameOver: state.gameOver,
    };
  }

  function serialize() {
    return JSON.stringify(state);
  }

  function on(event, fn) {
    const key = "on" + event.charAt(0).toUpperCase() + event.slice(1);
    if (callbacks[key] !== undefined) callbacks[key] = fn;
  }

  return {
    init, start, stop, pause, resume, isPaused, isRunning,
    setDirection, toggleFps, setRainbow,
    publicState, serialize, loadState, getReplay, on,
    GRID,
  };
})();
