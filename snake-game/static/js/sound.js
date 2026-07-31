/* Web Audio-based sound engine. No audio files needed — everything is
   synthesized, so the game has full sound with zero binary assets. */
const SoundFx = (() => {
  let ctx = null;
  let musicEnabled = true;
  let sfxEnabled = true;
  let volume = 0.7;
  let musicTimer = null;
  let musicStep = 0;

  function ensureCtx() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioCtx();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function beep({ freq = 440, duration = 0.09, type = "square", gain = 0.2, slideTo = null }) {
    if (!sfxEnabled) return;
    const c = ensureCtx();
    const osc = c.createOscillator();
    const amp = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) osc.frequency.linearRampToValueAtTime(slideTo, c.currentTime + duration);
    amp.gain.setValueAtTime(gain * volume, c.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    osc.connect(amp).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + duration);
  }

  const sfx = {
    menuMove: () => beep({ freq: 520, duration: 0.05, type: "square", gain: 0.12 }),
    menuSelect: () => beep({ freq: 700, duration: 0.08, type: "square", gain: 0.15 }),
    eat: () => beep({ freq: 660, duration: 0.08, type: "square", gain: 0.2, slideTo: 880 }),
    eatGolden: () => {
      beep({ freq: 880, duration: 0.07, type: "square", gain: 0.2 });
      setTimeout(() => beep({ freq: 1175, duration: 0.09, type: "square", gain: 0.2 }), 70);
    },
    eatPoison: () => beep({ freq: 220, duration: 0.18, type: "sawtooth", gain: 0.2, slideTo: 110 }),
    powerup: () => {
      beep({ freq: 440, duration: 0.06, type: "triangle", gain: 0.18 });
      setTimeout(() => beep({ freq: 660, duration: 0.06, type: "triangle", gain: 0.18 }), 60);
      setTimeout(() => beep({ freq: 880, duration: 0.1, type: "triangle", gain: 0.18 }), 120);
    },
    gameOver: () => {
      beep({ freq: 400, duration: 0.15, type: "sawtooth", gain: 0.22, slideTo: 100 });
      setTimeout(() => beep({ freq: 200, duration: 0.3, type: "sawtooth", gain: 0.22, slideTo: 60 }), 150);
    },
    pause: () => beep({ freq: 350, duration: 0.06, type: "sine", gain: 0.15 }),
  };

  const MUSIC_NOTES = [392, 440, 494, 440, 392, 330, 392, 440];

  function startMusic() {
    if (musicTimer || !musicEnabled) return;
    musicStep = 0;
    musicTimer = setInterval(() => {
      if (!musicEnabled) return;
      beep({ freq: MUSIC_NOTES[musicStep % MUSIC_NOTES.length], duration: 0.12, type: "triangle", gain: 0.05 });
      musicStep++;
    }, 260);
  }

  function stopMusic() {
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = null;
  }

  return {
    sfx,
    setSfxEnabled(v) { sfxEnabled = v; },
    setMusicEnabled(v) { musicEnabled = v; if (!v) stopMusic(); },
    setVolume(v) { volume = v; },
    startMusic,
    stopMusic,
    unlock: ensureCtx,
  };
})();
