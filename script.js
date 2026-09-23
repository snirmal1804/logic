/**
 * MIND HACK - Game Engine, Anti-Cheat & Admin Controller
 * Includes real-time tab-switch detection, 3-strike automatic elimination,
 * participant identity management, and proctor command center.
 */

// ==========================================================================
// 1. CONSTANTS & CONFIGURATION
// ==========================================================================
const CONFIG = {
  TOTAL_DURATION_SECONDS: 20 * 60, // 20 minutes = 1200 seconds
  TOTAL_QUESTIONS: 50,
  MAX_TAB_SWITCHES: 3,             // 3 warnings allowed; 4th switch triggers automatic elimination
  WARNING_THRESHOLD_SECONDS: 300,  // 5 minutes remaining
  CRITICAL_THRESHOLD_SECONDS: 60,  // 1 minute remaining
  SESSION_STORAGE_KEY: 'mindhack_active_session',
  RESULT_STORAGE_KEY: 'mindhack_last_result',
  PARTICIPANTS_STORAGE_KEY: 'mindhack_participants',
  CURRENT_USER_KEY: 'mindhack_current_user',
  SOUND_PREF_KEY: 'mindhack_sound_muted'
};

function getQuestionBank() {
  if (typeof window !== 'undefined' && Array.isArray(window.MIND_HACK_QUESTIONS) && window.MIND_HACK_QUESTIONS.length) {
    return window.MIND_HACK_QUESTIONS;
  }
  if (typeof MIND_HACK_QUESTIONS !== 'undefined' && Array.isArray(MIND_HACK_QUESTIONS) && MIND_HACK_QUESTIONS.length) {
    return MIND_HACK_QUESTIONS;
  }
  return [];
}

// ==========================================================================
// 2. WEB AUDIO API SYNTHESIZER
// ==========================================================================
class SoundSynth {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem(CONFIG.SOUND_PREF_KEY) === 'true';
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem(CONFIG.SOUND_PREF_KEY, this.muted);
    } catch (e) {}
    return this.muted;
  }

  playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.15) {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio synthesis error:", e);
    }
  }

  click() {
    this.playTone(850, 'triangle', 0.05, 0.1);
  }

  selectOption() {
    this.playTone(1100, 'sine', 0.08, 0.15);
  }

  navigate() {
    this.playTone(600, 'sine', 0.06, 0.08);
  }

  warning() {
    if (this.muted) return;
    this.playTone(480, 'sawtooth', 0.2, 0.3);
    setTimeout(() => this.playTone(720, 'sawtooth', 0.25, 0.3), 160);
  }

  buzzer() {
    if (this.muted) return;
    this.playTone(220, 'sawtooth', 0.4, 0.4);
    setTimeout(() => this.playTone(180, 'sawtooth', 0.6, 0.45), 200);
  }

  criticalTick() {
    this.playTone(900, 'triangle', 0.04, 0.15);
  }

  fanfare() {
    if (this.muted) return;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'triangle', 0.25, 0.2);
      }, idx * 110);
    });
  }
}

const sound = new SoundSynth();

// ==========================================================================
// 3. STORAGE & PARTICIPANTS DATA MANAGER
// ==========================================================================
const GameStorage = {
  saveSession(session) {
    try {
      localStorage.setItem(CONFIG.SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
      console.error("Failed to save session:", e);
    }
  },

  getSession() {
    try {
      const data = localStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error("Failed to parse session:", e);
      return null;
    }
  },

  clearSession() {
    try {
      localStorage.removeItem(CONFIG.SESSION_STORAGE_KEY);
    } catch (e) {}
  },

  saveResult(result) {
    try {
      localStorage.setItem(CONFIG.RESULT_STORAGE_KEY, JSON.stringify(result));
    } catch (e) {
      console.error("Failed to save result:", e);
    }
  },

  getResult() {
    try {
      const data = localStorage.getItem(CONFIG.RESULT_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error("Failed to parse result:", e);
      return null;
    }
  },

  // Participant Management
  getParticipants() {
    try {
      const data = localStorage.getItem(CONFIG.PARTICIPANTS_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  async fetchParticipants() {
    try {
      const res = await fetch('/api/participants');
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) {
          this.saveParticipants(list);
          return list;
        }
      }
    } catch (e) {
      // Local fallback
    }
    return this.getParticipants();
  },

  async getRemoteParticipant(id, name) {
    try {
      const q = id ? `id=${encodeURIComponent(id)}` : `name=${encodeURIComponent(name || '')}`;
      const res = await fetch(`/api/participant-status?${q}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.found) {
          return data.participant;
        }
      }
    } catch (e) {
      // Local fallback
    }
    return null;
  },

  saveParticipants(list) {
    try {
      localStorage.setItem(CONFIG.PARTICIPANTS_STORAGE_KEY, JSON.stringify(list));
      // Dispatch storage event locally for same-window updates if needed
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof Event !== 'undefined') {
        window.dispatchEvent(new Event('mindhack_storage_updated'));
      }
    } catch (e) {
      console.error("Failed to save participants list:", e);
    }
  },

  getCurrentUser() {
    try {
      const data = localStorage.getItem(CONFIG.CURRENT_USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  isTeamNameTaken(teamName) {
    if (!teamName || typeof teamName !== 'string') return false;
    const target = teamName.trim().toLowerCase();
    const participants = this.getParticipants();
    return participants.some(p => {
      const existing = (p.teamName || p.name || '').trim().toLowerCase();
      return existing === target;
    });
  },

  setCurrentUser(user) {
    try {
      localStorage.setItem(CONFIG.CURRENT_USER_KEY, JSON.stringify(user));
    } catch (e) {}
  },

  registerParticipant(details) {
    const participants = this.getParticipants();
    const existingIndex = participants.findIndex(p => p.id === details.id);

    const displayName = details.teamName || details.name || 'Anonymous Team';
    const candidate = {
      id: details.id || `TEAM-${Math.floor(1000 + Math.random() * 9000)}`,
      name: displayName,
      teamName: displayName,
      college: details.college || 'Engineering Institute',
      registeredAt: new Date().toISOString(),
      status: 'in_progress', // 'in_progress' | 'completed' | 'eliminated'
      score: 0,
      totalQuestions: CONFIG.TOTAL_QUESTIONS,
      answeredCount: 0,
      percentage: 0,
      timeUsedSeconds: 0,
      tabSwitches: 0,
      tabSwitchLogs: [],
      eliminatedAt: null,
      eliminationReason: null,
      completedAt: null
    };

    if (existingIndex !== -1) {
      participants[existingIndex] = Object.assign(participants[existingIndex], candidate);
    } else {
      participants.unshift(candidate);
    }

    this.saveParticipants(participants);
    this.setCurrentUser(candidate);

    // Sync with central server in background
    try {
      fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidate)
      }).catch(() => {});
    } catch (e) {}

    return candidate;
  },

  updateParticipant(id, updates) {
    const participants = this.getParticipants();
    const idx = participants.findIndex(p => p.id === id);
    if (idx !== -1) {
      participants[idx] = Object.assign(participants[idx], updates);
      this.saveParticipants(participants);
    }

    // Sync updates with central server in background
    try {
      fetch('/api/update-participant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, updates })
      }).catch(() => {});
    } catch (e) {}
  },

  seedSampleParticipants() {
    const samples = [
      {
        id: "TEAM-2026-001",
        name: "Team Cyber Hawks",
        teamName: "Team Cyber Hawks",
        college: "Dept of AI & Data Science",
        registeredAt: new Date(Date.now() - 15 * 60000).toISOString(),
        completedAt: new Date(Date.now() - 2 * 60000).toISOString(),
        status: "completed",
        score: 48,
        totalQuestions: 50,
        answeredCount: 50,
        percentage: 96,
        timeUsedSeconds: 780,
        tabSwitches: 0,
        tabSwitchLogs: []
      },
      {
        id: "TEAM-2026-014",
        name: "Byte Busters",
        teamName: "Byte Busters",
        college: "Computer Science & Engg",
        registeredAt: new Date(Date.now() - 18 * 60000).toISOString(),
        completedAt: new Date(Date.now() - 4 * 60000).toISOString(),
        status: "completed",
        score: 42,
        totalQuestions: 50,
        answeredCount: 50,
        percentage: 84,
        timeUsedSeconds: 890,
        tabSwitches: 0,
        tabSwitchLogs: []
      },
      {
        id: "TEAM-2026-029",
        name: "Neural Phantoms",
        teamName: "Neural Phantoms",
        college: "Information Technology",
        registeredAt: new Date(Date.now() - 10 * 60000).toISOString(),
        status: "in_progress",
        score: 28,
        totalQuestions: 50,
        answeredCount: 32,
        percentage: 56,
        timeUsedSeconds: 610,
        tabSwitches: 0,
        tabSwitchLogs: []
      },
      {
        id: "TEAM-2026-035",
        name: "Algoriddims",
        teamName: "Algoriddims",
        college: "Electronics & Communication",
        registeredAt: new Date(Date.now() - 12 * 60000).toISOString(),
        status: "in_progress",
        score: 22,
        totalQuestions: 50,
        answeredCount: 26,
        percentage: 44,
        timeUsedSeconds: 710,
        tabSwitches: 0,
        tabSwitchLogs: []
      },
      {
        id: "TEAM-2026-042",
        name: "Binary Titans",
        teamName: "Binary Titans",
        college: "Mechanical Engg / Cyber Club",
        registeredAt: new Date(Date.now() - 25 * 60000).toISOString(),
        eliminatedAt: new Date(Date.now() - 19 * 60000).toISOString(),
        status: "eliminated",
        eliminationReason: "Tab switch / window minimized detected. Immediate disqualification enforced.",
        score: 0,
        totalQuestions: 50,
        answeredCount: 16,
        percentage: 0,
        timeUsedSeconds: 380,
        tabSwitches: 1,
        tabSwitchLogs: [
          "22:15:10 - Tab switched / window departure detected -> IMMEDIATELY ELIMINATED"
        ]
      },
      {
        id: "TEAM-2026-057",
        name: "Quantum Logic",
        teamName: "Quantum Logic",
        college: "School of Computing",
        registeredAt: new Date(Date.now() - 14 * 60000).toISOString(),
        completedAt: new Date(Date.now() - 1 * 60000).toISOString(),
        status: "completed",
        score: 36,
        totalQuestions: 50,
        answeredCount: 48,
        percentage: 72,
        timeUsedSeconds: 810,
        tabSwitches: 0,
        tabSwitchLogs: []
      }
    ];

    const existing = this.getParticipants();
    // Prepend without duplicating sample IDs
    const merged = [...samples.filter(s => !existing.some(e => e.id === s.id)), ...existing];
    this.saveParticipants(merged);
    return merged;
  }
};

// Robust Modal Helper with DOM fallback
const ModalHelper = {
  show(modalTarget) {
    const el = (typeof modalTarget === 'string') ? document.getElementById(modalTarget) : modalTarget;
    if (!el) return;

    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      try {
        const inst = bootstrap.Modal.getInstance(el) || new bootstrap.Modal(el);
        inst.show();
        return;
      } catch (err) {
        console.warn("Bootstrap modal show error, using fallback:", err);
      }
    }

    el.classList.add('show');
    el.style.display = 'block';
    el.removeAttribute('aria-hidden');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('role', 'dialog');

    let backdrop = document.getElementById('customModalBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'customModalBackdrop';
      backdrop.className = 'modal-backdrop fade show';
      document.body.appendChild(backdrop);
    }
  },

  hide(modalTarget) {
    const el = (typeof modalTarget === 'string') ? document.getElementById(modalTarget) : modalTarget;
    if (!el) return;

    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      try {
        const inst = bootstrap.Modal.getInstance(el);
        if (inst) {
          inst.hide();
          return;
        }
      } catch (err) {
        console.warn("Bootstrap modal hide error:", err);
      }
    }

    el.classList.remove('show');
    el.style.display = 'none';
    el.setAttribute('aria-hidden', 'true');
    el.removeAttribute('aria-modal');

    const backdrop = document.getElementById('customModalBackdrop');
    if (backdrop) backdrop.remove();
    document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
  }
};

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Generate new session object with unique randomized 50 questions per participant
// The first 49 questions are uniquely shuffled for each participant, while Question 50 (Final Boss) is always in the 50th position for all players
function createNewSessionData(user) {
  const pool = getQuestionBank();
  
  // Find the Final Boss question (id: 50 or marked with 'FINAL BOSS')
  const bossQuestion = pool.find(q => q.id === 50 || (q.question && q.question.includes('FINAL BOSS'))) || pool[pool.length - 1];
  const bossId = bossQuestion ? bossQuestion.id : 50;

  // The remaining 49 questions are uniquely randomized per candidate
  const nonBossQuestions = pool.filter(q => q.id !== bossId);
  const shuffledNonBoss = shuffleArray(nonBossQuestions);

  // Combine: 49 randomly shuffled questions + Final Boss locked as the 50th question for all players
  const finalPool = bossQuestion 
    ? [...shuffledNonBoss.slice(0, CONFIG.TOTAL_QUESTIONS - 1), bossQuestion]
    : shuffledNonBoss;
  const questionIds = finalPool.map(q => q.id);
  const now = Date.now();

  return {
    id: 'MINDHACK_' + now,
    userId: user ? user.id : 'MH-' + Math.floor(1000 + Math.random() * 9000),
    startTime: now,
    endTime: now + (CONFIG.TOTAL_DURATION_SECONDS * 1000),
    totalDuration: CONFIG.TOTAL_DURATION_SECONDS,
    questionIds: questionIds,
    currentIndex: 0,
    answers: {},
    marked: [],
    visited: questionIds.length ? [questionIds[0]] : [],
    tabSwitches: 0,
    tabSwitchLogs: [],
    warningTriggered: false,
    status: 'in_progress',
    graceGiven: false,
    eliminatedAtIndex: 0
  };
}

// ==========================================================================
// 4. GAME INITIALIZATION & LAUNCHPAD
// ==========================================================================
function startNewMindHackChallenge(candidateInfo) {
  sound.click();

  const pool = getQuestionBank();
  if (!pool || !pool.length) {
    alert("Error: Question bank is still loading. Please refresh the page.");
    return;
  }

  // Official team registration is strictly required to enter the user portal
  let user = candidateInfo || GameStorage.getCurrentUser();
  if (!user || !user.teamName) {
    const regModal = document.getElementById('candidateRegModal');
    if (regModal) {
      ModalHelper.show('candidateRegModal');
    } else {
      window.location.href = 'index.html';
    }
    return;
  }

  const registeredUser = GameStorage.registerParticipant(user);
  const session = createNewSessionData(registeredUser);
  GameStorage.saveSession(session);
  window.location.href = 'game.html';
}

// ==========================================================================
// 5. GAME ARENA CONTROLLER (game.html)
// ==========================================================================
class GameArena {
  constructor() {
    this.session = null;
    this.currentUser = null;
    this.questions = [];
    this.timerInterval = null;
    this.isSubmitting = false;
    this.lastTabSwitchTime = 0;

    // DOM Elements
    this.timerDisplay = document.getElementById('timerDisplay');
    this.timerContainer = document.getElementById('timerContainer');
    this.tabSwitchBadge = document.getElementById('tabSwitchCounter');
    this.questionNumberEl = document.getElementById('currentQuestionNum');
    this.categoryBadge = document.getElementById('categoryBadge');
    this.difficultyBadge = document.getElementById('difficultyBadge');
    this.progressBar = document.getElementById('quizProgressBar');
    this.answeredCounter = document.getElementById('answeredCountText');
    this.questionText = document.getElementById('questionText');
    this.optionsContainer = document.getElementById('optionsContainer');
    this.paletteGrid = document.getElementById('paletteGrid');

    // Controls
    this.prevBtn = document.getElementById('prevBtn');
    this.nextBtn = document.getElementById('nextBtn');
    this.skipBtn = document.getElementById('skipBtn');
    this.clearBtn = document.getElementById('clearBtn');
    this.submitBtn = document.getElementById('submitBtn');
    this.quickSubmitBtn = document.getElementById('quickSubmitBtn');
    this.soundToggleBtn = document.getElementById('soundToggleBtn');
    this.fullscreenBtn = document.getElementById('fullscreenBtn');
  }

  init() {
    const bank = getQuestionBank();
    const now = Date.now();

    // 1. Security Gate: Only show user portal AFTER team has registered!
    this.currentUser = GameStorage.getCurrentUser();
    if (!this.currentUser || !this.currentUser.teamName) {
      console.warn("Unauthorized access: Team registration required. Redirecting to index.html");
      window.location.href = 'index.html';
      return;
    }

    this.session = GameStorage.getSession();
    const isExpired = this.session && this.session.endTime && (this.session.endTime <= now);

    // If session is marked eliminated, check if admin gave grace on the server before kicking them out
    if (this.session && this.session.status === 'eliminated') {
      GameStorage.getRemoteParticipant(this.currentUser.id, this.currentUser.teamName).then(remote => {
        if (remote && remote.status === 'in_progress' && remote.graceGiven) {
          this.session.status = 'in_progress';
          this.session.graceGiven = true;
          this.session.tabSwitches = remote.tabSwitches || CONFIG.MAX_TAB_SWITCHES;
          const resumeIdx = typeof remote.eliminatedAtIndex === 'number' 
            ? remote.eliminatedAtIndex 
            : (typeof this.session.eliminatedAtIndex === 'number' ? this.session.eliminatedAtIndex : (this.session.currentIndex || 0));
          this.session.currentIndex = resumeIdx;
          this.session.eliminatedAtIndex = resumeIdx;
          this.session.endTime = Date.now() + Math.max(300, CONFIG.TOTAL_DURATION_SECONDS - (this.session.timeUsedSeconds || 0)) * 1000;
          GameStorage.saveSession(this.session);
          window.location.reload();
        } else {
          window.location.href = 'result.html';
        }
      }).catch(() => {
        window.location.href = 'result.html';
      });
      return;
    }

    // If session is completed or expired (without grace), redirect to result page
    if (this.session && this.session.status === 'completed') {
      window.location.href = 'result.html';
      return;
    }

    if (isExpired && !(this.session && this.session.graceGiven)) {
      window.location.href = 'result.html';
      return;
    }

    // If resuming from Proctor Grace Chance, ensure timer is renewed and candidate starts on the eliminated question!
    if (this.session && this.session.graceGiven) {
      if (typeof this.session.eliminatedAtIndex === 'number') {
        this.session.currentIndex = this.session.eliminatedAtIndex;
      }
      if (isExpired || !this.session.endTime) {
        const remainingSeconds = Math.max(300, CONFIG.TOTAL_DURATION_SECONDS - (this.session.timeUsedSeconds || 0));
        this.session.endTime = now + (remainingSeconds * 1000);
        GameStorage.saveSession(this.session);
      }
    }

    if (!this.session || this.session.status !== 'in_progress' || !this.session.questionIds || !this.session.questionIds.length) {
      console.log("Starting fresh 20-minute challenge session for team: " + this.currentUser.teamName);
      this.session = createNewSessionData(this.currentUser);
      GameStorage.saveSession(this.session);
    }

    // 2. Map questions from database
    this.questions = this.session.questionIds.map(id => {
      return bank.find(q => q.id === id);
    }).filter(Boolean);

    if (this.questions.length !== CONFIG.TOTAL_QUESTIONS) {
      this.session = createNewSessionData(this.currentUser);
      GameStorage.saveSession(this.session);
      this.questions = this.session.questionIds.map(id => {
        return bank.find(q => q.id === id);
      }).filter(Boolean);
    }

    // Ensure currentIndex is clamped within valid bounds and points to eliminated question if resumed
    if (typeof this.session.currentIndex !== 'number' || this.session.currentIndex < 0 || this.session.currentIndex >= this.questions.length) {
      this.session.currentIndex = 0;
    }

    // 3. Setup event listeners & Anti-Cheat Tab Monitor
    this.bindEvents();
    this.initAntiCheatTabMonitor();

    // 4. Render initial UI
    this.updateSoundIcon();
    this.updateTabSwitchBadge();
    this.renderPalette();
    this.renderCurrentQuestion();
    this.startTimer();

    // 5. Unload guard
    window.addEventListener('beforeunload', (e) => {
      if (!this.isSubmitting && this.session && this.session.status === 'in_progress') {
        e.preventDefault();
        e.returnValue = 'You have an active MIND HACK challenge. Navigating away will record a policy violation!';
      }
    });
  }

  // Anti-Cheat Tab Switch Detection (3 Warnings, 4th = Elimination)
  initAntiCheatTabMonitor() {
    const handleSwitch = () => {
      const now = Date.now();
      if (this.isSubmitting || !this.session || this.session.status !== 'in_progress') return;

      // Debounce: ignore rapid double-fire from OS blur+visibility events within 1s
      if (now - this.lastTabSwitchTime < 1000) return;
      this.lastTabSwitchTime = now;

      // Increment switch count in session
      this.session.tabSwitches = (this.session.tabSwitches || 0) + 1;
      const switchCount = this.session.tabSwitches;
      const timeStr = new Date().toLocaleTimeString();
      const logEntry = `[Switch #${switchCount}] ${timeStr} — Tab switch / window focus lost detected`;

      this.session.tabSwitchLogs = this.session.tabSwitchLogs || [];
      this.session.tabSwitchLogs.push(logEntry);
      GameStorage.saveSession(this.session);

      // Sync switch count to participants list
      GameStorage.updateParticipant(this.currentUser.id, {
        tabSwitches: switchCount,
        tabSwitchLogs: this.session.tabSwitchLogs
      });

      this.updateTabSwitchBadge();

      const limit = CONFIG.MAX_TAB_SWITCHES; // 3

      // If admin already granted a grace chance, ANY further switch = immediate elimination (no more chances)
      if (this.session.graceGiven) {
        this.eliminateParticipant(
          `PERMANENTLY ELIMINATED: Tab switch detected after Proctor Grace Chance was given. No further warnings allowed. Score forfeited.`
        );
      } else if (switchCount <= limit) {
        // Warning — not yet eliminated
        const remaining = limit - switchCount;
        this.showTabWarning(switchCount, remaining);
      } else {
        // 4th switch (or beyond): ELIMINATE immediately
        this.eliminateParticipant(
          `DISQUALIFIED: Tab switch #${switchCount} detected. Maximum ${limit} warnings exceeded. College Tech Arena Zero-Tolerance Policy enforced.`
        );
      }
    };

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        handleSwitch();
      } else {
        if (this.session && this.session.status === 'eliminated') {
          window.location.href = 'result.html';
        }
      }
    });

    window.addEventListener('blur', () => {
      handleSwitch();
    });
  }

  updateTabSwitchBadge() {
    const badge = document.getElementById('tabSwitchCounter');
    if (!badge) return;

    const switchCount = (this.session && this.session.tabSwitches) || 0;
    const isEliminated = this.session && this.session.status === 'eliminated';
    const limit = CONFIG.MAX_TAB_SWITCHES; // 3

    badge.className = `tab-counter-badge ${switchCount >= limit ? 'danger-2' : ''} ${isEliminated ? 'danger-3' : ''}`;

    if (isEliminated) {
      badge.innerHTML = `
        <i class="fa-solid fa-shield-halved text-danger"></i>
        <span>Anti-Cheat: <strong>DISQUALIFIED</strong></span>
      `;
    } else if (switchCount === 0) {
      badge.innerHTML = `
        <i class="fa-solid fa-shield-halved text-neon-cyan"></i>
        <span>Anti-Cheat: <strong>Active — 0 / ${limit} Warnings</strong></span>
      `;
    } else {
      const colorClass = switchCount >= limit ? 'text-danger' : switchCount >= 2 ? 'text-warning' : 'text-orange';
      badge.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation ${colorClass}"></i>
        <span>Anti-Cheat: <strong class="${colorClass}">Warning ${switchCount} / ${limit}</strong></span>
      `;
    }
  }

  showTabWarning(strike, remaining) {
    sound.warning();

    const overlay = document.getElementById('eliminationOverlay');
    const candidateNameEl = document.getElementById('eliminatedCandidateName');
    const candidateIdEl = document.getElementById('eliminatedCandidateId');
    const reasonEl = document.getElementById('eliminationReasonText');

    const displayName = this.currentUser.teamName || this.currentUser.name || 'Your Team';
    if (candidateNameEl) candidateNameEl.textContent = displayName;
    if (candidateIdEl) candidateIdEl.textContent = `Team ID: ${this.currentUser.id}`;

    const warningMsg = remaining > 0
      ? `⚠️ WARNING ${strike} of ${CONFIG.MAX_TAB_SWITCHES}: Tab switch detected! You have ${remaining} warning${remaining !== 1 ? 's' : ''} remaining before AUTOMATIC ELIMINATION.`
      : `🚨 FINAL WARNING (${strike} of ${CONFIG.MAX_TAB_SWITCHES}): This is your LAST warning. The NEXT tab switch will IMMEDIATELY ELIMINATE your team!`;

    if (reasonEl) reasonEl.textContent = warningMsg;

    // Temporarily show warning overlay (not the elimination one)
    if (overlay) {
      // Patch the overlay header temporarily to show "Warning" not "Eliminated"
      const titleEl = overlay.querySelector('h1, .elim-title, [id*="Title"]');
      if (titleEl) {
        titleEl._originalText = titleEl.textContent;
        titleEl.textContent = remaining > 0 ? `⚠️ TAB SWITCH WARNING ${strike}` : '🚨 FINAL WARNING';
      }
      overlay.classList.remove('d-none');
      overlay.style.display = 'flex';
      overlay.style.background = 'rgba(255, 140, 0, 0.18)';

      // Auto-hide after 4 seconds and restore
      setTimeout(() => {
        overlay.classList.add('d-none');
        overlay.style.display = '';
        overlay.style.background = '';
        if (titleEl) titleEl.textContent = titleEl._originalText || 'ELIMINATED';
      }, 4000);
    }
  }

  eliminateParticipant(reason) {
    this.isSubmitting = true;
    if (this.timerInterval) clearInterval(this.timerInterval);

    sound.buzzer();

    const timestamp = new Date().toISOString();
    const switchCount = (this.session.tabSwitches) || (CONFIG.MAX_TAB_SWITCHES + 1);
    const graceWasGiven = this.session.graceGiven || false;
    this.session.status = 'eliminated';
    this.session.eliminationReason = reason;
    this.session.eliminatedAt = timestamp;
    // Save the exact question index candidate was on when eliminated so Grace Chance can resume it!
    this.session.eliminatedAtIndex = this.session.currentIndex || 0;

    const displayName = this.currentUser.teamName || this.currentUser.name || 'Your Team';

    GameStorage.saveSession(this.session);
    GameStorage.updateParticipant(this.currentUser.id, {
      status: 'eliminated',
      eliminatedAt: timestamp,
      eliminationReason: reason,
      eliminatedAtIndex: this.session.eliminatedAtIndex,
      tabSwitches: switchCount,
      score: 0,
      percentage: 0,
      graceGiven: graceWasGiven,
      tabSwitchLogs: this.session.tabSwitchLogs
    });

    // Save forfeited result payload
    GameStorage.saveResult({
      completedAt: timestamp,
      eliminated: true,
      eliminationReason: reason,
      candidateName: displayName,
      teamName: displayName,
      candidateId: this.currentUser.id,
      college: this.currentUser.college,
      totalQuestions: CONFIG.TOTAL_QUESTIONS,
      correctCount: 0,
      wrongCount: 0,
      skippedCount: CONFIG.TOTAL_QUESTIONS,
      finalScore: 0,
      percentage: 0,
      timeUsedSeconds: Math.min(CONFIG.TOTAL_DURATION_SECONDS, Math.floor((Date.now() - this.session.startTime) / 1000)),
      avgTimePerQuestion: "0.0",
      tier: "DISQUALIFIED",
      tierClass: "tier-disqualified",
      message: graceWasGiven
        ? `PERMANENTLY ELIMINATED: Team switched tabs again after receiving a Proctor Grace Chance. No further appeals allowed. Score forfeited.`
        : `AUTOMATICALLY ELIMINATED: Team exceeded the maximum ${CONFIG.MAX_TAB_SWITCHES} tab-switch warnings (Switch #${switchCount}). Challenge terminated and score forfeited.`,
      tabSwitchLogs: this.session.tabSwitchLogs || [],
      review: []
    });

    this.showEliminationScreen(reason);

    // Auto navigate to result page after showing elimination reaction (3s to read the screen)
    setTimeout(() => {
      window.location.href = 'result.html';
    }, 3000);
  }

  showEliminationScreen(reason) {
    const overlay = document.getElementById('eliminationOverlay');
    const candidateNameEl = document.getElementById('eliminatedCandidateName');
    const candidateIdEl = document.getElementById('eliminatedCandidateId');
    const reasonEl = document.getElementById('eliminationReasonText');
    const timelineEl = document.getElementById('eliminationAuditTimeline');

    const displayName = this.currentUser.teamName || this.currentUser.name || 'Your Team';
    if (candidateNameEl) candidateNameEl.textContent = displayName;
    if (candidateIdEl) candidateIdEl.textContent = `Team ID: ${this.currentUser.id}`;
    if (reasonEl) reasonEl.textContent = reason;

    if (timelineEl && this.session && this.session.tabSwitchLogs) {
      timelineEl.innerHTML = this.session.tabSwitchLogs.map(log => {
        return `<div class="audit-timeline-item"><i class="fa-solid fa-xmark text-danger"></i> ${log}</div>`;
      }).join('');
    }

    if (overlay) {
      overlay.classList.remove('d-none');
      overlay.style.display = 'flex';
    }
  }

  bindEvents() {
    if (this.prevBtn) {
      this.prevBtn.onclick = () => this.goToPreviousQuestion();
    }
    if (this.nextBtn) {
      this.nextBtn.onclick = () => this.goToNextQuestion();
    }
    if (this.skipBtn) {
      this.skipBtn.onclick = () => this.toggleSkipMark();
    }
    if (this.clearBtn) {
      this.clearBtn.onclick = () => this.clearSelection();
    }
    if (this.submitBtn) {
      this.submitBtn.onclick = () => this.openSubmitModal();
    }
    if (this.quickSubmitBtn) {
      this.quickSubmitBtn.onclick = () => this.openSubmitModal();
    }

    const confirmSubmitBtn = document.getElementById('confirmSubmitBtn');
    if (confirmSubmitBtn) {
      confirmSubmitBtn.onclick = () => {
        ModalHelper.hide('submitConfirmModal');
        this.submitChallenge(false);
      };
    }

    if (this.soundToggleBtn) {
      this.soundToggleBtn.onclick = () => this.toggleSound();
    }

    if (this.fullscreenBtn) {
      this.fullscreenBtn.onclick = () => this.toggleFullscreen();
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      if (['input', 'textarea'].includes(document.activeElement.tagName.toLowerCase())) return;

      const key = e.key.toUpperCase();
      if (['1', 'A'].includes(key)) {
        this.selectOptionByIndex(0);
      } else if (['2', 'B'].includes(key)) {
        this.selectOptionByIndex(1);
      } else if (['3', 'C'].includes(key)) {
        this.selectOptionByIndex(2);
      } else if (['4', 'D'].includes(key)) {
        this.selectOptionByIndex(3);
      } else if (e.key === 'ArrowRight' || key === 'N') {
        this.goToNextQuestion();
      } else if (e.key === 'ArrowLeft' || key === 'P') {
        this.goToPreviousQuestion();
      } else if (key === 'S') {
        this.toggleSkipMark();
      }
    });
  }

  toggleSound() {
    const isMuted = sound.toggleMute();
    this.updateSoundIcon();
    if (!isMuted) sound.click();
  }

  updateSoundIcon() {
    if (!this.soundToggleBtn) return;
    const icon = this.soundToggleBtn.querySelector('i');
    if (!icon) return;
    if (sound.muted) {
      icon.className = 'fa-solid fa-volume-xmark';
      this.soundToggleBtn.title = 'Unmute Sound';
    } else {
      icon.className = 'fa-solid fa-volume-high';
      this.soundToggleBtn.title = 'Mute Sound';
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(err => {
          console.warn("Fullscreen request error:", err);
        });
      }
      if (this.fullscreenBtn) {
        this.fullscreenBtn.innerHTML = '<i class="fa-solid fa-compress"></i>';
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        if (this.fullscreenBtn) {
          this.fullscreenBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
        }
      }
    }
  }

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    const update = () => {
      const now = Date.now();
      const remainingSeconds = Math.max(0, Math.floor((this.session.endTime - now) / 1000));

      if (this.timerDisplay) {
        this.timerDisplay.textContent = formatTime(remainingSeconds);
      }

      // Sync time used
      const elapsed = Math.floor((now - this.session.startTime) / 1000);
      GameStorage.updateParticipant(this.currentUser.id, { timeUsedSeconds: elapsed });

      // 5-minute warning check
      if (remainingSeconds <= CONFIG.WARNING_THRESHOLD_SECONDS && !this.session.warningTriggered) {
        this.session.warningTriggered = true;
        GameStorage.saveSession(this.session);
        if (this.timerContainer) {
          this.timerContainer.classList.add('timer-warning');
        }
        sound.warning();
        ModalHelper.show('fiveMinWarningModal');
      }

      // 1-minute critical alert
      if (remainingSeconds <= CONFIG.CRITICAL_THRESHOLD_SECONDS && remainingSeconds > 0) {
        if (this.timerContainer) {
          this.timerContainer.classList.remove('timer-warning');
          this.timerContainer.classList.add('timer-critical');
        }
        if (remainingSeconds <= 10) {
          sound.criticalTick();
        }
      }

      // Timer Expiry
      if (remainingSeconds <= 0) {
        clearInterval(this.timerInterval);
        this.handleTimeExpiry();
      }
    };

    update();
    this.timerInterval = setInterval(update, 1000);
  }

  handleTimeExpiry() {
    if (this.isSubmitting) return;
    sound.warning();
    ModalHelper.show('timeUpModal');
    setTimeout(() => {
      this.submitChallenge(true);
    }, 2500);
  }

  renderCurrentQuestion() {
    const idx = this.session.currentIndex;
    const q = this.questions[idx];
    if (!q) return;

    if (!this.session.visited.includes(q.id)) {
      this.session.visited.push(q.id);
      GameStorage.saveSession(this.session);
    }

    if (this.questionNumberEl) {
      this.questionNumberEl.textContent = `Question ${idx + 1} of ${CONFIG.TOTAL_QUESTIONS}`;
    }
    if (this.categoryBadge) {
      this.categoryBadge.innerHTML = `<i class="fa-solid ${q.categoryIcon || 'fa-brain'} me-1"></i> ${q.category}`;
    }
    if (this.difficultyBadge) {
      this.difficultyBadge.textContent = q.difficulty || 'Medium';
      this.difficultyBadge.className = `difficulty-badge badge-${(q.difficulty || 'medium').toLowerCase()}`;
    }

    if (this.questionText) {
      this.questionText.textContent = q.question;
    }

    if (this.optionsContainer) {
      this.optionsContainer.innerHTML = '';
      const letters = ['A', 'B', 'C', 'D'];
      const currentAnswer = this.session.answers[q.id];

      q.options.forEach((optText, oIdx) => {
        const optCard = document.createElement('div');
        optCard.className = `option-card ${currentAnswer === oIdx ? 'selected' : ''}`;
        optCard.setAttribute('data-index', oIdx);

        optCard.innerHTML = `
          <div class="option-letter">${letters[oIdx]}</div>
          <div class="option-text">${optText}</div>
          <div class="option-indicator"></div>
        `;

        optCard.onclick = (e) => {
          e.preventDefault();
          this.selectOptionByIndex(oIdx);
        };

        this.optionsContainer.appendChild(optCard);
      });
    }

    if (this.prevBtn) {
      this.prevBtn.disabled = (idx === 0);
    }
    if (this.nextBtn) {
      if (idx === CONFIG.TOTAL_QUESTIONS - 1) {
        this.nextBtn.innerHTML = `<span>Submit</span> <i class="fa-solid fa-flag-checkered ms-1"></i>`;
        this.nextBtn.classList.remove('cyber-btn-primary');
        this.nextBtn.classList.add('cyber-btn-success');
      } else {
        this.nextBtn.innerHTML = `<span>Next</span> <i class="fa-solid fa-chevron-right ms-1"></i>`;
        this.nextBtn.classList.add('cyber-btn-primary');
        this.nextBtn.classList.remove('cyber-btn-success');
      }
    }

    if (this.skipBtn) {
      const isMarked = this.session.marked.includes(q.id);
      if (isMarked) {
        this.skipBtn.classList.remove('cyber-btn-outline');
        this.skipBtn.classList.add('cyber-btn-warning');
        this.skipBtn.innerHTML = `<i class="fa-solid fa-bookmark me-1"></i> Marked`;
      } else {
        this.skipBtn.classList.add('cyber-btn-outline');
        this.skipBtn.classList.remove('cyber-btn-warning');
        this.skipBtn.innerHTML = `<i class="fa-regular fa-bookmark me-1"></i> Skip / Mark`;
      }
    }

    this.updateProgress();
    this.updatePaletteHighlight();
  }

  selectOptionByIndex(oIdx) {
    sound.selectOption();
    const q = this.questions[this.session.currentIndex];
    if (!q) return;

    this.session.answers[q.id] = oIdx;

    const markIdx = this.session.marked.indexOf(q.id);
    if (markIdx !== -1) {
      this.session.marked.splice(markIdx, 1);
    }

    GameStorage.saveSession(this.session);

    // Sync answered count to participant database
    const answeredCount = Object.keys(this.session.answers).length;
    GameStorage.updateParticipant(this.currentUser.id, { answeredCount: answeredCount });

    if (this.optionsContainer) {
      const cards = this.optionsContainer.querySelectorAll('.option-card');
      cards.forEach((c, idx) => {
        if (idx === oIdx) {
          c.classList.add('selected');
        } else {
          c.classList.remove('selected');
        }
      });
    }

    this.updateProgress();
    this.updatePaletteHighlight();
  }

  clearSelection() {
    sound.click();
    const q = this.questions[this.session.currentIndex];
    if (!q) return;

    if (this.session.answers[q.id] !== undefined) {
      delete this.session.answers[q.id];
      GameStorage.saveSession(this.session);
    }
    if (this.optionsContainer) {
      const cards = this.optionsContainer.querySelectorAll('.option-card');
      cards.forEach(c => c.classList.remove('selected'));
    }

    const answeredCount = Object.keys(this.session.answers).length;
    GameStorage.updateParticipant(this.currentUser.id, { answeredCount: answeredCount });

    this.updateProgress();
    this.updatePaletteHighlight();
  }

  toggleSkipMark() {
    sound.click();
    const q = this.questions[this.session.currentIndex];
    if (!q) return;

    const markIdx = this.session.marked.indexOf(q.id);
    if (markIdx === -1) {
      this.session.marked.push(q.id);
    } else {
      this.session.marked.splice(markIdx, 1);
    }
    GameStorage.saveSession(this.session);
    this.renderCurrentQuestion();
  }

  goToPreviousQuestion() {
    if (this.session.currentIndex > 0) {
      sound.navigate();
      this.session.currentIndex--;
      GameStorage.saveSession(this.session);
      this.renderCurrentQuestion();
    }
  }

  goToNextQuestion() {
    if (this.session.currentIndex < CONFIG.TOTAL_QUESTIONS - 1) {
      sound.navigate();
      this.session.currentIndex++;
      GameStorage.saveSession(this.session);
      this.renderCurrentQuestion();
    } else {
      this.openSubmitModal();
    }
  }

  jumpToQuestion(index) {
    if (index >= 0 && index < CONFIG.TOTAL_QUESTIONS && index !== this.session.currentIndex) {
      sound.navigate();
      this.session.currentIndex = index;
      GameStorage.saveSession(this.session);
      this.renderCurrentQuestion();
    }
  }

  renderPalette() {
    if (!this.paletteGrid) return;
    this.paletteGrid.innerHTML = '';
    for (let i = 0; i < CONFIG.TOTAL_QUESTIONS; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'palette-btn';
      if (i === CONFIG.TOTAL_QUESTIONS - 1) {
        btn.innerHTML = '<span style="color:#ffd700;">🏆 50</span>';
        btn.title = "Question 50: FINAL BOSS CHALLENGE";
        btn.classList.add('palette-boss-btn');
      } else {
        btn.textContent = (i + 1);
      }
      btn.setAttribute('data-qidx', i);

      btn.onclick = (e) => {
        e.preventDefault();
        this.jumpToQuestion(i);
      };

      this.paletteGrid.appendChild(btn);
    }
  }

  updatePaletteHighlight() {
    if (!this.paletteGrid) return;
    const paletteButtons = this.paletteGrid.querySelectorAll('.palette-btn');
    paletteButtons.forEach((btn, idx) => {
      const q = this.questions[idx];
      if (!q) return;
      const isAnswered = this.session.answers[q.id] !== undefined;
      const isMarked = this.session.marked.includes(q.id);
      const isCurrent = (idx === this.session.currentIndex);

      btn.className = 'palette-btn';
      if (isCurrent) btn.classList.add('current');
      if (isAnswered) {
        btn.classList.add('answered');
      } else if (isMarked) {
        btn.classList.add('marked');
      }
    });
  }

  updateProgress() {
    const answeredCount = Object.keys(this.session.answers).length;
    const pct = Math.round((answeredCount / CONFIG.TOTAL_QUESTIONS) * 100);

    if (this.progressBar) {
      this.progressBar.style.width = `${pct}%`;
    }
    if (this.answeredCounter) {
      this.answeredCounter.textContent = `${answeredCount} / ${CONFIG.TOTAL_QUESTIONS} Answered`;
    }
  }

  openSubmitModal() {
    sound.click();
    const answeredCount = Object.keys(this.session.answers).length;
    const skippedCount = this.session.marked.length;
    const unattempted = CONFIG.TOTAL_QUESTIONS - answeredCount;

    const modalAnswered = document.getElementById('modalAnsweredCount');
    const modalRemaining = document.getElementById('modalRemainingCount');
    const modalSkipped = document.getElementById('modalSkippedCount');

    if (modalAnswered) modalAnswered.textContent = answeredCount;
    if (modalRemaining) modalRemaining.textContent = unattempted;
    if (modalSkipped) modalSkipped.textContent = skippedCount;

    ModalHelper.show('submitConfirmModal');
  }

  submitChallenge(autoSubmitted = false) {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    if (this.timerInterval) clearInterval(this.timerInterval);

    const now = Date.now();
    const totalTimeSpentSeconds = Math.min(
      CONFIG.TOTAL_DURATION_SECONDS,
      Math.floor((now - this.session.startTime) / 1000)
    );

    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;

    const reviewItems = this.questions.map(q => {
      const userAnswer = this.session.answers[q.id];
      const isAnswered = (userAnswer !== undefined);
      const isCorrect = isAnswered && (userAnswer === q.correctIndex);
      const isSkipped = !isAnswered;

      if (isCorrect) correctCount++;
      else if (isAnswered) wrongCount++;
      else skippedCount++;

      return {
        id: q.id,
        category: q.category,
        categoryIcon: q.categoryIcon,
        difficulty: q.difficulty,
        question: q.question,
        options: q.options,
        userAnswer: isAnswered ? userAnswer : null,
        correctIndex: q.correctIndex,
        isCorrect: isCorrect,
        isSkipped: isSkipped,
        explanation: q.explanation
      };
    });

    const score = correctCount;
    const percentage = Math.round((correctCount / CONFIG.TOTAL_QUESTIONS) * 100);

    let tier = "APPRENTICE THINKER";
    let tierClass = "tier-apprentice";
    let message = "Keep training! Every mental hurdle makes your neural networks sharper.";

    if (percentage >= 90) {
      tier = "CYBER GRANDMASTER";
      tierClass = "tier-grandmaster";
      message = "Legendary Performance! Exceptional cognitive speed, logical acuity, and pattern synthesis.";
    } else if (percentage >= 75) {
      tier = "NEURAL SPECIALIST";
      tierClass = "tier-elite";
      message = "Outstanding Mind! Superior problem-solving agility with minimal logical errors.";
    } else if (percentage >= 50) {
      tier = "LOGIC OPERATIVE";
      tierClass = "tier-specialist";
      message = "Solid Mental Agility! Good analytical execution with room for deeper deduction.";
    }

    const resultPayload = {
      completedAt: new Date().toISOString(),
      autoSubmitted: autoSubmitted,
      candidateName: this.currentUser.name,
      candidateId: this.currentUser.id,
      college: this.currentUser.college,
      totalQuestions: CONFIG.TOTAL_QUESTIONS,
      correctCount: correctCount,
      wrongCount: wrongCount,
      skippedCount: skippedCount,
      finalScore: score,
      percentage: percentage,
      timeUsedSeconds: totalTimeSpentSeconds,
      avgTimePerQuestion: (totalTimeSpentSeconds / CONFIG.TOTAL_QUESTIONS).toFixed(1),
      tier: tier,
      tierClass: tierClass,
      message: message,
      tabSwitchLogs: this.session.tabSwitchLogs || [],
      review: reviewItems
    };

    // Update participant record in database
    GameStorage.updateParticipant(this.currentUser.id, {
      status: 'completed',
      score: score,
      answeredCount: Object.keys(this.session.answers).length,
      percentage: percentage,
      timeUsedSeconds: totalTimeSpentSeconds,
      completedAt: new Date().toISOString()
    });

    GameStorage.saveResult(resultPayload);
    GameStorage.clearSession();

    window.location.href = 'result.html';
  }
}

// ==========================================================================
// 6. RESULT PAGE CONTROLLER (result.html)
// ==========================================================================
class ResultDashboard {
  constructor() {
    this.result = null;
    this.activeFilter = 'all';
  }

  init() {
    this.result = GameStorage.getResult();

    if (!this.result) {
      this.result = this.generateDemoResult();
    }

    if (this.result.eliminated) {
      sound.buzzer();
      setTimeout(() => sound.buzzer(), 400);
      this.renderEliminatedState();
      this.startGraceMonitoring();
    } else {
      sound.fanfare();
      this.renderHeaderAndScore();
      this.renderMetrics();
    }

    this.setupReviewAccordion();
    this.bindActions();
  }

  renderEliminatedState() {
    const trophyBox = document.querySelector('.trophy-glow');
    const heroTitle = document.querySelector('.result-hero h2');
    const tierBadge = document.getElementById('tierBadge');
    const tierMessage = document.getElementById('tierMessage');
    const scoreValEl = document.getElementById('scoreValue');
    const pctValEl = document.getElementById('percentageValue');
    const teamNameEl = document.getElementById('resultTeamName');
    const teamIdEl = document.getElementById('resultTeamId');
    const officialBadge = document.getElementById('officialAttemptBadge');

    const displayName = this.result.teamName || this.result.candidateName || 'Your Team';
    if (teamNameEl) teamNameEl.textContent = displayName;
    if (teamIdEl) teamIdEl.textContent = `(${this.result.candidateId || 'TEAM-2026'})`;

    if (trophyBox) {
      trophyBox.className = 'trophy-glow disqualified-glow';
      trophyBox.innerHTML = '<i class="fa-solid fa-ban text-white"></i>';
    }

    if (heroTitle) {
      heroTitle.innerHTML = 'TEAM <span class="text-danger">DISQUALIFIED!</span>';
    }

    if (tierBadge) {
      tierBadge.textContent = 'DISQUALIFIED • TAB SWITCH DETECTED';
      tierBadge.className = 'performance-tier tier-disqualified py-2 px-4 fs-6';
    }

    if (officialBadge) {
      officialBadge.className = 'badge bg-danger bg-opacity-25 border border-danger text-danger px-4 py-3 fs-6 font-display d-inline-flex align-items-center';
      officialBadge.innerHTML = '<i class="fa-solid fa-ban text-danger me-2"></i> OFFICIAL ATTEMPT RECORDED • TEAM DISQUALIFIED';
    }

    if (tierMessage) {
      const logs = this.result.tabSwitchLogs && this.result.tabSwitchLogs.length
        ? this.result.tabSwitchLogs
        : [`${new Date().toLocaleTimeString()} - Browser tab switch / window focus loss detected`];

      tierMessage.innerHTML = `
        <div class="disqualification-reaction-box">
          <div class="d-flex align-items-center justify-content-center gap-2 mb-2">
            <i class="fa-solid fa-triangle-exclamation text-danger fs-3"></i>
            <h4 class="text-danger font-display fw-bold mb-0">ZERO-TOLERANCE ANTI-CHEAT TRIGGERED</h4>
            <i class="fa-solid fa-triangle-exclamation text-danger fs-3"></i>
          </div>
          <p class="text-light mb-2 small">
            Browser tab switch / unauthorized window navigation detected during live challenge.
          </p>
          <div class="reaction-audit-badge mb-3">
            <i class="fa-solid fa-clock-rotate-left text-danger me-1"></i>
            ${logs.map(l => `<div>• ${l}</div>`).join('')}
          </div>
          <div class="reaction-policy-note">
            <i class="fa-solid fa-circle-exclamation text-warning me-1"></i>
            <strong>COLLEGE TECH ARENA RULING:</strong> Immediate Disqualification Enforced. All 50 questions forfeited. Total Score: 0/50. Re-attempt is strictly prohibited.
          </div>
        </div>
      `;
    }

    if (scoreValEl) {
      scoreValEl.textContent = '0';
      scoreValEl.classList.add('text-danger');
    }
    if (pctValEl) {
      pctValEl.textContent = '0%';
      pctValEl.className = 'text-danger fw-bold mt-1';
    }

    // Set score ring to 0 with red stroke
    const circleProgress = document.getElementById('scoreSvgProgress');
    if (circleProgress) {
      circleProgress.style.stroke = '#ef4444';
      circleProgress.style.strokeDashoffset = 534;
    }

    const metricCorrect = document.getElementById('metricCorrect');
    const metricWrong = document.getElementById('metricWrong');
    const metricSkipped = document.getElementById('metricSkipped');
    const metricTime = document.getElementById('metricTime');
    const metricAvgTime = document.getElementById('metricAvgTime');

    if (metricCorrect) metricCorrect.textContent = '0';
    if (metricWrong) metricWrong.textContent = '0';
    if (metricSkipped) {
      metricSkipped.textContent = String(CONFIG.TOTAL_QUESTIONS);
      metricSkipped.className = 'stat-value text-danger';
    }
    if (metricTime) metricTime.textContent = formatTime(this.result.timeUsedSeconds || 0);
    if (metricAvgTime) metricAvgTime.textContent = '0.0s';
  }

  startGraceMonitoring() {
    if (!this.result || !this.result.candidateId) return;
    const cid = this.result.candidateId;
    const checkInterval = setInterval(async () => {
      const remote = await GameStorage.getRemoteParticipant(cid);
      if (remote && remote.status === 'in_progress' && remote.graceGiven) {
        clearInterval(checkInterval);

        // Sync local session
        let sess = GameStorage.getSession();
        if (sess) {
          sess.status = 'in_progress';
          sess.graceGiven = true;
          sess.tabSwitches = remote.tabSwitches || CONFIG.MAX_TAB_SWITCHES;
          const resumeIdx = typeof remote.eliminatedAtIndex === 'number' 
            ? remote.eliminatedAtIndex 
            : (typeof sess.eliminatedAtIndex === 'number' ? sess.eliminatedAtIndex : (sess.currentIndex || 0));
          sess.currentIndex = resumeIdx;
          sess.eliminatedAtIndex = resumeIdx;
          GameStorage.saveSession(sess);
        }

        // Show prominent grace chance banner
        const hero = document.querySelector('.result-hero') || document.querySelector('main .container');
        if (hero) {
          const banner = document.createElement('div');
          banner.className = 'alert alert-success border-success text-center py-4 mb-4 shadow';
          banner.style.cssText = 'background: rgba(16, 185, 129, 0.15); border: 2px solid #10b981; border-radius: 12px;';
          banner.innerHTML = `
            <h4 class="font-display text-neon-green mb-2"><i class="fa-solid fa-hand-holding-heart me-2"></i> PROCTOR GRACE CHANCE GRANTED!</h4>
            <p class="mb-3 text-light fs-6">The exam proctor has granted your team ONE final grace chance. Click below to continue playing from the question you were eliminated on!</p>
            <a href="game.html" class="cyber-btn cyber-btn-primary px-5 py-3 fs-5"><i class="fa-solid fa-play me-2"></i> CONTINUE TO PLAY</a>
          `;
          hero.parentNode.insertBefore(banner, hero);
        }

        // Also update home button
        const homeBtn = document.getElementById('homeBtn');
        if (homeBtn) {
          homeBtn.innerHTML = '<i class="fa-solid fa-play text-neon-green me-1"></i> CONTINUE TO PLAY';
          homeBtn.className = 'cyber-btn cyber-btn-primary px-4 py-3';
          homeBtn.onclick = (e) => {
            e.preventDefault();
            window.location.href = 'game.html';
          };
        }
      }
    }, 2500);
  }

  generateDemoResult() {
    const pool = getQuestionBank();
    const questions = pool.slice(0, CONFIG.TOTAL_QUESTIONS);
    const review = questions.map((q, idx) => {
      const isCorrect = idx < 42;
      return {
        id: q.id,
        category: q.category,
        categoryIcon: q.categoryIcon,
        difficulty: q.difficulty,
        question: q.question,
        options: q.options,
        userAnswer: isCorrect ? q.correctIndex : ((q.correctIndex + 1) % 4),
        correctIndex: q.correctIndex,
        isCorrect: isCorrect,
        isSkipped: false,
        explanation: q.explanation
      };
    });

    return {
      completedAt: new Date().toISOString(),
      autoSubmitted: false,
      totalQuestions: CONFIG.TOTAL_QUESTIONS,
      correctCount: 42,
      wrongCount: 8,
      skippedCount: 0,
      finalScore: 42,
      percentage: 84,
      timeUsedSeconds: 980,
      avgTimePerQuestion: (980 / CONFIG.TOTAL_QUESTIONS).toFixed(1),
      tier: "NEURAL SPECIALIST",
      tierClass: "tier-elite",
      message: "Outstanding Mind! Superior problem-solving agility with minimal logical errors.",
      review: review
    };
  }

  renderHeaderAndScore() {
    const circleProgress = document.getElementById('scoreSvgProgress');
    const scoreValEl = document.getElementById('scoreValue');
    const pctValEl = document.getElementById('percentageValue');
    const tierBadge = document.getElementById('tierBadge');
    const tierMessage = document.getElementById('tierMessage');
    const autoSubmitNotice = document.getElementById('autoSubmitNotice');

    if (scoreValEl) scoreValEl.textContent = this.result.finalScore;
    if (pctValEl) pctValEl.textContent = `${this.result.percentage}%`;

    if (tierBadge) {
      tierBadge.textContent = this.result.tier;
      tierBadge.className = `performance-tier ${this.result.tierClass}`;
    }

    if (tierMessage) {
      tierMessage.textContent = this.result.message;
    }

    const teamNameEl = document.getElementById('resultTeamName');
    const teamIdEl = document.getElementById('resultTeamId');
    const displayName = this.result.teamName || this.result.candidateName || 'Your Team';
    if (teamNameEl) teamNameEl.textContent = displayName;
    if (teamIdEl) teamIdEl.textContent = `(${this.result.candidateId || 'TEAM-2026'})`;

    if (autoSubmitNotice && this.result.autoSubmitted) {
      autoSubmitNotice.classList.remove('d-none');
    }

    if (circleProgress) {
      const circumference = 2 * Math.PI * 85;
      const offset = circumference - (circumference * (this.result.percentage / 100));
      setTimeout(() => {
        circleProgress.style.strokeDashoffset = offset;
      }, 300);
    }
  }

  renderMetrics() {
    const totalEl = document.getElementById('metricTotal');
    const correctEl = document.getElementById('metricCorrect');
    const wrongEl = document.getElementById('metricWrong');
    const skippedEl = document.getElementById('metricSkipped');
    const timeEl = document.getElementById('metricTime');
    const avgTimeEl = document.getElementById('metricAvgTime');

    if (totalEl) totalEl.textContent = this.result.totalQuestions;
    if (correctEl) correctEl.textContent = this.result.correctCount;
    if (wrongEl) wrongEl.textContent = this.result.wrongCount;
    if (skippedEl) skippedEl.textContent = this.result.skippedCount;
    if (timeEl) timeEl.textContent = formatTime(this.result.timeUsedSeconds);
    if (avgTimeEl) avgTimeEl.textContent = `${this.result.avgTimePerQuestion}s`;
  }

  setupReviewAccordion() {
    const container = document.getElementById('reviewListContainer');
    if (!container) return;

    if (this.result.eliminated) {
      container.innerHTML = `
        <div class="text-center py-5">
          <div class="mb-3">
            <i class="fa-solid fa-lock text-danger fa-3x"></i>
          </div>
          <h4 class="font-display fw-bold text-danger mb-2">QUESTION ANALYSIS LOCKED</h4>
          <p class="text-secondary max-w-600 mx-auto mb-0">
            Answer review and question explanations are strictly sealed for disqualified teams under College Tech Arena examination protocols.
          </p>
        </div>
      `;
      const filterBar = document.querySelector('.review-filter-bar');
      if (filterBar) filterBar.style.display = 'none';
      return;
    }

    const filterButtons = document.querySelectorAll('.filter-btn');

    // Dynamically update filter button text with exact counts
    const allBtn = document.querySelector('.filter-btn[data-filter="all"]');
    const correctBtn = document.querySelector('.filter-btn[data-filter="correct"]');
    const wrongBtn = document.querySelector('.filter-btn[data-filter="wrong"]');
    const skippedBtn = document.querySelector('.filter-btn[data-filter="skipped"]');
    if (allBtn) allBtn.textContent = `All (${this.result.totalQuestions || CONFIG.TOTAL_QUESTIONS})`;
    if (correctBtn) correctBtn.textContent = `Correct (${this.result.correctCount || 0})`;
    if (wrongBtn) wrongBtn.textContent = `Wrong (${this.result.wrongCount || 0})`;
    if (skippedBtn) skippedBtn.textContent = `Skipped (${this.result.skippedCount || 0})`;

    const renderItems = () => {
      container.innerHTML = '';
      const letters = ['A', 'B', 'C', 'D'];

      const filtered = (this.result.review || []).filter(item => {
        if (this.activeFilter === 'correct') return item.isCorrect;
        if (this.activeFilter === 'wrong') return (!item.isCorrect && !item.isSkipped);
        if (this.activeFilter === 'skipped') return item.isSkipped;
        return true;
      });

      if (!filtered.length) {
        container.innerHTML = `
          <div class="text-center py-5 text-muted">
            <i class="fa-solid fa-inbox fa-2x mb-3 d-block"></i>
            No questions in this filter.
          </div>
        `;
        return;
      }

      filtered.forEach((item, index) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'review-item';

        let statusClass = 'status-wrong';
        let statusText = 'Wrong';
        if (item.isCorrect) {
          statusClass = 'status-correct';
          statusText = 'Correct';
        } else if (item.isSkipped) {
          statusClass = 'status-skipped';
          statusText = 'Skipped';
        }

        const collapseId = `reviewCol_${item.id}`;

        itemEl.innerHTML = `
          <div class="review-header" data-bs-toggle="collapse" data-bs-target="#${collapseId}">
            <div class="d-flex align-items-center gap-3 flex-wrap">
              <span class="text-neon-cyan fw-bold font-display">#${index + 1}</span>
              <span class="badge bg-secondary bg-opacity-25 text-light">${item.category}</span>
              <span class="text-truncate" style="max-width: 420px;">${item.question.split('\n')[0]}</span>
            </div>
            <div class="d-flex align-items-center gap-2">
              <span class="review-status-tag ${statusClass}">${statusText}</span>
              <i class="fa-solid fa-chevron-down text-muted ms-1"></i>
            </div>
          </div>
          <div id="${collapseId}" class="collapse">
            <div class="review-body">
              <div class="mt-3 mb-3 fw-medium text-light" style="white-space: pre-line;">${item.question}</div>
              
              <div class="row g-2 mb-3">
                ${item.options.map((opt, optIdx) => {
                  const isUserChoice = (item.userAnswer === optIdx);
                  const isCorrectChoice = (item.correctIndex === optIdx);

                  let optBorder = 'rgba(255, 255, 255, 0.1)';
                  let optBg = 'rgba(255, 255, 255, 0.03)';
                  let badge = '';

                  if (isCorrectChoice) {
                    optBorder = '#10b981';
                    optBg = 'rgba(16, 185, 129, 0.15)';
                    badge = `<span class="badge bg-success ms-auto"><i class="fa-solid fa-check"></i> Correct Answer</span>`;
                  } else if (isUserChoice && !isCorrectChoice) {
                    optBorder = '#ef4444';
                    optBg = 'rgba(239, 68, 68, 0.15)';
                    badge = `<span class="badge bg-danger ms-auto"><i class="fa-solid fa-xmark"></i> Your Answer</span>`;
                  }

                  return `
                    <div class="col-md-6">
                      <div class="p-2 px-3 rounded d-flex align-items-center gap-2" style="border: 1px solid ${optBorder}; background: ${optBg}; font-size: 0.92rem;">
                        <span class="fw-bold text-muted">${letters[optIdx]}.</span>
                        <span>${opt}</span>
                        ${badge}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>

              <div class="explanation-box">
                <div class="fw-bold text-neon-cyan mb-1"><i class="fa-solid fa-lightbulb me-1"></i> Logical Explanation:</div>
                <div>${item.explanation}</div>
              </div>
            </div>
          </div>
        `;

        container.appendChild(itemEl);
      });
    };

    filterButtons.forEach(btn => {
      btn.onclick = () => {
        sound.click();
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeFilter = btn.getAttribute('data-filter');
        renderItems();
      };
    });

    renderItems();
  }

  bindActions() {
    const homeBtn = document.getElementById('homeBtn');
    const printBtn = document.getElementById('printReportBtn');

    if (homeBtn) {
      homeBtn.onclick = () => {
        sound.click();
        window.location.href = 'index.html';
      };
    }
    if (printBtn) {
      printBtn.onclick = () => {
        sound.click();
        window.print();
      };
    }
  }
}

// ==========================================================================
// 7. ADMIN DASHBOARD CONTROLLER (admin.html)
// ==========================================================================
class AdminDashboard {
  constructor() {
    this.participants = [];
    this.activeFilter = 'all';
    this.searchQuery = '';
    this.autoRefreshActive = true;
    this.refreshInterval = null;

    // Elements
    this.tableBody = document.getElementById('participantsTableBody');
    this.searchInput = document.getElementById('adminSearchInput');
    this.statTotal = document.getElementById('adminStatTotal');
    this.statActive = document.getElementById('adminStatActive');
    this.statCompleted = document.getElementById('adminStatCompleted');
    this.statEliminated = document.getElementById('adminStatEliminated');
    this.statAvgScore = document.getElementById('adminStatAvgScore');
    this.autoRefreshToggleBtn = document.getElementById('autoRefreshToggleBtn');
  }

  init() {
    this.loadAndRender();
    this.bindEvents();
    this.startAutoRefresh();

    // Listen for live updates from other tabs
    window.addEventListener('storage', () => {
      this.loadAndRender();
    });

    window.addEventListener('mindhack_storage_updated', () => {
      this.loadAndRender();
    });
  }

  bindEvents() {
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderTable();
      });
    }

    // Status filter buttons
    document.querySelectorAll('.admin-filter-btn').forEach(btn => {
      btn.onclick = () => {
        sound.click();
        document.querySelectorAll('.admin-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeFilter = btn.getAttribute('data-status-filter');
        this.renderTable();
      };
    });

    // Auto-refresh toggle
    if (this.autoRefreshToggleBtn) {
      this.autoRefreshToggleBtn.onclick = () => {
        sound.click();
        this.autoRefreshActive = !this.autoRefreshActive;
        if (this.autoRefreshActive) {
          this.autoRefreshToggleBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin text-neon-green"></i> Auto-Refresh: ON (3s)';
          this.startAutoRefresh();
        } else {
          this.autoRefreshToggleBtn.innerHTML = '<i class="fa-solid fa-pause text-muted"></i> Auto-Refresh: OFF';
          if (this.refreshInterval) clearInterval(this.refreshInterval);
        }
      };
    }

    // Seed sample contestants button
    const seedBtn = document.getElementById('seedSampleBtn');
    if (seedBtn) {
      seedBtn.onclick = async () => {
        sound.click();
        GameStorage.seedSampleParticipants();
        try {
          await fetch('/api/admin/seed', { method: 'POST' });
        } catch (e) {}
        this.loadAndRender();
      };
    }

    // Reset data button
    const resetBtn = document.getElementById('resetAllBtn');
    if (resetBtn) {
      resetBtn.onclick = async () => {
        if (confirm("⚠️ Are you sure you want to reset all candidate records and competition data?")) {
          sound.click();
          GameStorage.saveParticipants([]);
          GameStorage.clearSession();
          try {
            await fetch('/api/admin/reset', { method: 'POST' });
          } catch (e) {}
          this.loadAndRender();
        }
      };
    }

    // Export CSV button
    const exportBtn = document.getElementById('exportCsvBtn');
    if (exportBtn) {
      exportBtn.onclick = () => {
        sound.click();
        this.exportCSV();
      };
    }

    // Admin Logout button
    const logoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) {
      logoutBtn.onclick = () => {
        sound.click();
        sessionStorage.removeItem('mindhack_admin_authenticated');
        window.location.href = 'index.html';
      };
    }
  }

  startAutoRefresh() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.refreshInterval = setInterval(() => {
      if (this.autoRefreshActive) {
        this.loadAndRender();
      }
    }, 3000);
  }

  async loadAndRender() {
    this.participants = await GameStorage.fetchParticipants();
    this.renderStats();
    this.renderTable();
  }

  renderStats() {
    const total = this.participants.length;
    // Only count teams actually still in progress (including grace-given teams still playing)
    const active = this.participants.filter(p => p.status === 'in_progress').length;
    const completed = this.participants.filter(p => p.status === 'completed').length;
    // Eliminated = only those with status === 'eliminated' (warnings alone don't count as eliminated)
    const eliminated = this.participants.filter(p => p.status === 'eliminated').length;
    // Grace-given teams who are still playing (in_progress but with graceGiven flag)
    const graceActive = this.participants.filter(p => p.status === 'in_progress' && p.graceGiven).length;

    const completedItems = this.participants.filter(p => p.status === 'completed');
    const avgScore = completedItems.length
      ? (completedItems.reduce((acc, curr) => acc + (curr.score || 0), 0) / completedItems.length).toFixed(1)
      : "0.0";

    if (this.statTotal) this.statTotal.textContent = total;
    if (this.statActive) this.statActive.textContent = active;
    if (this.statCompleted) this.statCompleted.textContent = completed;
    if (this.statEliminated) this.statEliminated.textContent = eliminated;
    if (this.statAvgScore) this.statAvgScore.textContent = `${avgScore} / ${CONFIG.TOTAL_QUESTIONS}`;
  }

  renderTable() {
    if (!this.tableBody) return;
    this.tableBody.innerHTML = '';

    // Filter participants
    const filtered = this.participants.filter(p => {
      // Search filter
      const matchesSearch = !this.searchQuery ||
        (p.teamName && p.teamName.toLowerCase().includes(this.searchQuery)) ||
        (p.name && p.name.toLowerCase().includes(this.searchQuery)) ||
        p.id.toLowerCase().includes(this.searchQuery) ||
        (p.college && p.college.toLowerCase().includes(this.searchQuery));

      if (!matchesSearch) return false;

      // Status filter
      if (this.activeFilter === 'in_progress') return p.status === 'in_progress';
      if (this.activeFilter === 'completed') return p.status === 'completed';
      if (this.activeFilter === 'eliminated') return (p.status === 'eliminated' || (p.tabSwitches || 0) >= 1);
      if (this.activeFilter === 'violators') return (p.tabSwitches > 0);
      return true;
    });

    if (!filtered.length) {
      this.tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-5 text-muted">
            <i class="fa-solid fa-users-slash fa-2x mb-2 d-block"></i>
            No team records found matching your filters.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach((p, index) => {
      const tr = document.createElement('tr');

      const isEliminated = p.status === 'eliminated';
      const tabCount = p.tabSwitches || 0;
      const graceGiven = p.graceGiven === true;
      const limit = CONFIG ? CONFIG.MAX_TAB_SWITCHES : 3;

      // Determine Status Badge
      let statusBadge = '';
      if (p.status === 'completed') {
        statusBadge = `<span class="badge-status-completed"><i class="fa-solid fa-circle-check"></i> Completed</span>`;
      } else if (isEliminated) {
        if (graceGiven) {
          statusBadge = `<span class="badge-status-eliminated"><i class="fa-solid fa-ban"></i> PERMANENTLY DISQUALIFIED</span>`;
        } else {
          statusBadge = `<span class="badge-status-eliminated"><i class="fa-solid fa-ban"></i> ELIMINATED (${tabCount} Tab${tabCount !== 1 ? 's' : ''})</span>`;
        }
      } else if (graceGiven) {
        statusBadge = `<span class="badge-status-progress" style="border-color:rgba(255,165,0,0.5);color:orange;"><i class="fa-solid fa-triangle-exclamation"></i> FINAL GRACE — In Progress</span>`;
      } else {
        statusBadge = `<span class="badge-status-progress"><span class="pulse-dot"></span> In Progress</span>`;
      }

      // Tab Violations Meter (count / 3 with color coding)
      let tabMeterHtml = '';
      if (isEliminated) {
        tabMeterHtml = `
          <span class="badge bg-danger text-light px-2 py-1 small font-mono">
            <i class="fa-solid fa-triangle-exclamation me-1"></i> ${tabCount} / ${limit} Switches (Eliminated)
          </span>
        `;
      } else if (graceGiven) {
        tabMeterHtml = `
          <span class="badge bg-warning bg-opacity-25 text-warning border border-warning border-opacity-50 px-2 py-1 small font-mono">
            <i class="fa-solid fa-exclamation-circle me-1"></i> ${tabCount} / ${limit} — GRACE GIVEN
          </span>
        `;
      } else if (tabCount === 0) {
        tabMeterHtml = `
          <span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-50 px-2 py-1 small font-mono">
            <i class="fa-solid fa-circle-check me-1"></i> 0 / ${limit} Switches (Clean)
          </span>
        `;
      } else {
        const meterColor = tabCount >= limit ? 'danger' : tabCount >= 2 ? 'warning' : 'info';
        tabMeterHtml = `
          <span class="badge bg-${meterColor} bg-opacity-25 text-${meterColor} border border-${meterColor} border-opacity-50 px-2 py-1 small font-mono">
            <i class="fa-solid fa-triangle-exclamation me-1"></i> ${tabCount} / ${limit} Warnings
          </span>
        `;
      }

      // Initials for avatar
      const displayName = p.teamName || p.name || 'Team';
      const initials = displayName ? displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'TM';

      const candidateTotalQ = p.totalQuestions || CONFIG.TOTAL_QUESTIONS;
      const progressPercent = Math.min(100, Math.round(((p.answeredCount || 0) / candidateTotalQ) * 100));

      tr.innerHTML = `
        <td>
          <div class="d-flex align-items-center gap-3">
            <div class="candidate-avatar">${initials}</div>
            <div>
              <div class="fw-bold text-light">${displayName}</div>
              <div class="text-neon-cyan small font-mono">${p.id}</div>
              <div class="text-muted" style="font-size: 0.76rem;">${p.college || 'Participant Institute'}</div>
            </div>
          </div>
        </td>
        <td>${statusBadge}</td>
        <td>${tabMeterHtml}</td>
        <td>
          <div class="d-flex align-items-center gap-2">
            <span class="font-display small fw-bold">${p.answeredCount || 0}/${candidateTotalQ}</span>
            <div class="progress-track" style="width: 70px; height: 5px;">
              <div class="progress-fill" style="width: ${progressPercent}%;"></div>
            </div>
          </div>
        </td>
        <td>
          ${p.status === 'eliminated' ? '<span class="text-danger fw-bold font-mono">FORFEITED</span>' :
            p.status === 'completed' ? `<span class="text-neon-green fw-bold font-mono">${p.score}/${candidateTotalQ} (${p.percentage}%)</span>` :
            `<span class="text-secondary font-mono">${p.score || 0}/${candidateTotalQ}</span>`}
        </td>
        <td>
          <div class="font-mono text-light small">${formatTime(p.timeUsedSeconds || 0)}</div>
          <div class="text-muted" style="font-size: 0.72rem;">${p.registeredAt ? new Date(p.registeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</div>
        </td>
        <td>
          <div class="d-flex align-items-center gap-1">
            <button type="button" class="btn btn-sm btn-outline-info p-1 px-2" title="View Team Audit Log" onclick="window.adminDashboardInstance.viewAuditLog('${p.id}');">
              <i class="fa-solid fa-clipboard-list"></i>
            </button>
            ${isEliminated && graceGiven
              ? `<button type="button" class="btn btn-sm btn-outline-danger p-1 px-2" title="Grace already given — Permanently Disqualified" disabled>
                   <i class="fa-solid fa-lock"></i>
                 </button>`
              : isEliminated && tabCount > 0
              ? `<button type="button" class="btn btn-sm btn-outline-warning p-1 px-2" title="Grant ONE Grace Chance (admin can give once only)" onclick="window.adminDashboardInstance.toggleEliminate('${p.id}');">
                   <i class="fa-solid fa-hand-holding-heart"></i>
                 </button>`
              : isEliminated
              ? `<button type="button" class="btn btn-sm btn-outline-success p-1 px-2" title="Restore Team (Manual Elimination)" onclick="window.adminDashboardInstance.toggleEliminate('${p.id}');">
                   <i class="fa-solid fa-rotate-left"></i>
                 </button>`
              : `<button type="button" class="btn btn-sm btn-outline-danger p-1 px-2" title="Manually Eliminate Team" onclick="window.adminDashboardInstance.toggleEliminate('${p.id}');">
                   <i class="fa-solid fa-ban"></i>
                 </button>`
            }
            <button type="button" class="btn btn-sm btn-outline-secondary p-1 px-2" title="Delete Team Record" onclick="window.adminDashboardInstance.deleteCandidate('${p.id}');">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      `;

      this.tableBody.appendChild(tr);
    });
  }

  viewAuditLog(candidateId) {
    const candidate = this.participants.find(p => p.id === candidateId);
    if (!candidate) return;

    const modalTitle = document.getElementById('auditModalTitle');
    const modalBody = document.getElementById('auditModalBody');

    const displayName = candidate.teamName || candidate.name || 'Team';
    if (modalTitle) modalTitle.textContent = `Team Audit: ${displayName} (${candidate.id})`;
    if (modalBody) {
      const isEliminated = candidate.status === 'eliminated';
      const tabCount = candidate.tabSwitches || 0;
      const graceGiven = candidate.graceGiven === true;
      const limit = 3; // CONFIG.MAX_TAB_SWITCHES
      const tabStatusLabel = isEliminated
        ? `${tabCount} / ${limit} Switches — ELIMINATED`
        : graceGiven
          ? `${tabCount} / ${limit} — GRACE GIVEN (ONE chance remaining)`
          : tabCount === 0
            ? `0 / ${limit} Switches — Clean Record`
            : `${tabCount} / ${limit} Warnings Issued`;
      const tabStatusColor = isEliminated ? 'text-danger' : graceGiven ? 'text-warning' : tabCount === 0 ? 'text-success' : 'text-warning';

      modalBody.innerHTML = `
        <div class="row g-3 mb-4">
          <div class="col-sm-4">
            <div class="p-3 bg-dark border border-secondary border-opacity-25 rounded">
              <div class="small text-muted text-uppercase">Status</div>
              <div class="fw-bold ${isEliminated ? 'text-danger' : graceGiven ? 'text-warning' : 'text-success'}">${
                isEliminated ? 'ELIMINATED' : graceGiven ? 'GRACE IN PROGRESS' : candidate.status.toUpperCase()
              }</div>
            </div>
          </div>
          <div class="col-sm-4">
            <div class="p-3 bg-dark border border-secondary border-opacity-25 rounded">
              <div class="small text-muted text-uppercase">Tab Violations</div>
              <div class="fw-bold ${tabStatusColor} font-mono">${tabStatusLabel}</div>
            </div>
          </div>
          <div class="col-sm-4">
            <div class="p-3 bg-dark border border-secondary border-opacity-25 rounded">
              <div class="small text-muted text-uppercase">Grace Chance</div>
              <div class="fw-bold ${graceGiven ? 'text-orange' : 'text-muted'} font-mono">${
                graceGiven ? `Given at ${new Date(candidate.graceGivenAt || Date.now()).toLocaleTimeString()}` : 'Not Given'
              }</div>
            </div>
          </div>
        </div>

        <h6 class="font-display text-neon-cyan mb-2"><i class="fa-solid fa-list-check me-2"></i> Tab Switch Timeline & Audit Logs:</h6>
        <div class="audit-timeline">
          ${candidate.tabSwitchLogs && candidate.tabSwitchLogs.length ? candidate.tabSwitchLogs.map(log => {
            return `<div class="audit-timeline-item"><i class="fa-solid fa-triangle-exclamation text-warning me-1"></i> ${log}</div>`;
          }).join('') : '<div class="text-success"><i class="fa-solid fa-check me-1"></i> Clean record. No tab-switch violations detected.</div>'}
        </div>

        ${candidate.eliminationReason ? `
          <div class="alert alert-danger mt-3 mb-0 small">
            <strong>Disqualification Reason:</strong> ${candidate.eliminationReason}
          </div>
        ` : ''}
      `;
    }

    ModalHelper.show('candidateAuditModal');
  }

  toggleEliminate(candidateId) {
    const candidate = this.participants.find(p => p.id === candidateId);
    if (!candidate) return;

    const isEliminated = candidate.status === 'eliminated';
    const teamTitle = candidate.teamName || candidate.name || 'Team';

    if (isEliminated) {
      const tabViolations = candidate.tabSwitches || 0;
      const graceAlreadyGiven = candidate.graceGiven === true;

      if (graceAlreadyGiven) {
        // Grace already used — no further chances allowed
        alert(`❌ Grace already given to team "${teamTitle}".\n\nThis team already received a Proctor Grace Chance and switched tabs again. They are PERMANENTLY DISQUALIFIED — no further reinstatement is possible.`);
        return;
      }

      if (tabViolations > 0) {
        // This is a tab-switch elimination — offer ONE grace chance
        const confirmGrace = confirm(
          `⚡ GRANT PROCTOR GRACE CHANCE\n\nTeam: "${teamTitle}"\nTab Violations: ${tabViolations}\n\nYou are about to give this team ONE FINAL grace chance.\n\n⚠️ IMPORTANT: If they switch tabs even ONCE after this, they will be PERMANENTLY ELIMINATED with NO further appeals.\n\nAre you sure?`
        );
        if (confirmGrace) {
          sound.click();
          const resumeIndex = typeof candidate.eliminatedAtIndex === 'number' ? candidate.eliminatedAtIndex : 0;
          GameStorage.updateParticipant(candidateId, {
            status: 'in_progress',
            eliminatedAt: null,
            eliminationReason: null,
            tabSwitches: CONFIG.MAX_TAB_SWITCHES, // Reset to max so badge shows "Final Warning" state
            graceGiven: true, // Mark grace used — blocks future reinstatement
            graceGivenAt: new Date().toISOString(),
            eliminatedAtIndex: resumeIndex,
            tabSwitchLogs: [
              ...(candidate.tabSwitchLogs || []),
              `[ADMIN GRACE] ${new Date().toLocaleTimeString()} — Proctor granted ONE final grace chance. Reinstated to continue from Question #${resumeIndex + 1}. Next tab switch = permanent elimination.`
            ]
          });

          // Also synchronize active local session if taking the test on the same machine
          const localSession = GameStorage.getSession();
          if (localSession && (localSession.userId === candidateId || localSession.id === candidateId)) {
            localSession.status = 'in_progress';
            localSession.graceGiven = true;
            localSession.tabSwitches = CONFIG.MAX_TAB_SWITCHES;
            localSession.currentIndex = resumeIndex;
            localSession.eliminatedAtIndex = resumeIndex;
            GameStorage.saveSession(localSession);
          }

          this.loadAndRender();
        }
      } else {
        // Manual elimination (no tab switches) — simple toggle back to active
        if (confirm(`Restore team "${teamTitle}" back to active status?`)) {
          sound.click();
          GameStorage.updateParticipant(candidateId, {
            status: 'in_progress',
            eliminatedAt: null,
            eliminationReason: null
          });
          this.loadAndRender();
        }
      }
    } else {
      // Manually eliminate an active team
      if (confirm(`⚠️ Immediately ELIMINATE and DISQUALIFY team "${teamTitle}"?`)) {
        sound.click();
        GameStorage.updateParticipant(candidateId, {
          status: 'eliminated',
          eliminatedAt: new Date().toISOString(),
          eliminationReason: 'Manually disqualified by Proctor in Command Center',
          tabSwitches: candidate.tabSwitches || CONFIG.MAX_TAB_SWITCHES + 1,
          score: 0,
          percentage: 0
        });
        this.loadAndRender();
      }
    }
  }

  deleteCandidate(candidateId) {
    if (confirm(`Are you sure you want to permanently delete candidate record "${candidateId}"?`)) {
      const updated = this.participants.filter(p => p.id !== candidateId);
      GameStorage.saveParticipants(updated);
      this.loadAndRender();
    }
  }

  exportCSV() {
    if (!this.participants.length) {
      alert("No candidate records to export.");
      return;
    }

    let csv = "Team ID,Team Name,College,Status,Tab Violations,Score,Percentage,Time Used (Seconds),Registered At,Completed At\n";
    this.participants.forEach(p => {
      const isEliminated = p.status === 'eliminated' || (p.tabSwitches || 0) >= 1;
      const statusText = isEliminated ? "ELIMINATED" : (p.status === 'completed' ? "COMPLETED" : "IN_PROGRESS");
      const row = [
        `"${p.id}"`,
        `"${p.teamName || p.name || ''}"`,
        `"${p.college || ''}"`,
        `"${statusText}"`,
        p.tabSwitches || 0,
        p.score || 0,
        `${p.percentage || 0}%`,
        p.timeUsedSeconds || 0,
        `"${p.registeredAt || ''}"`,
        `"${p.completedAt || ''}"`
      ];
      csv += row.join(",") + "\n";
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `mindhack_round1_participants_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// ==========================================================================
// 8. GLOBAL DELEGATIONS & AUTO-PAGE INITIALIZER
// ==========================================================================

// Global Dismiss Modal Listener
document.addEventListener('click', (e) => {
  const dismissBtn = e.target.closest('[data-bs-dismiss="modal"]');
  if (dismissBtn) {
    const modalEl = dismissBtn.closest('.modal');
    if (modalEl) {
      ModalHelper.hide(modalEl);
    }
  }

  // Global Accordion Collapse Listener
  const collapseToggle = e.target.closest('[data-bs-toggle="collapse"]');
  if (collapseToggle) {
    const targetSel = collapseToggle.getAttribute('data-bs-target') || collapseToggle.getAttribute('href');
    if (targetSel) {
      const targetEl = document.querySelector(targetSel);
      if (targetEl) {
        targetEl.classList.toggle('show');
      }
    }
  }
});

// Expose functions globally on window
window.startNewMindHackChallenge = startNewMindHackChallenge;
window.GameStorage = GameStorage;
window.sound = sound;
window.ModalHelper = ModalHelper;

// Master Bootstrapper
function initializeMindHackApp() {
  const path = window.location.pathname.toLowerCase();

  // If on game.html
  if (path.includes('game.html') || document.getElementById('gameArenaRoot')) {
    if (!window.gameArenaInstance) {
      const arena = new GameArena();
      window.gameArenaInstance = arena;
      arena.init();
    }
  }

  // If on result.html
  if (path.includes('result.html') || document.getElementById('resultDashboardRoot')) {
    if (!window.resultDashboardInstance) {
      const results = new ResultDashboard();
      window.resultDashboardInstance = results;
      results.init();
    }
  }

  // If on admin.html
  if (path.includes('admin.html') || document.getElementById('adminDashboardRoot')) {
    if (!window.adminDashboardInstance) {
      const admin = new AdminDashboard();
      window.adminDashboardInstance = admin;
      admin.init();
    }
  }

  // Setup Team Registration on index.html with Unique Team Name Validation
  const startFormBtn = document.getElementById('submitCandidateRegBtn');
  const nameInput = document.getElementById('candidateNameInput') || document.getElementById('teamNameInput');
  const teamErrorEl = document.getElementById('teamNameError');

  if (nameInput) {
    nameInput.addEventListener('input', () => {
      if (teamErrorEl) teamErrorEl.classList.add('d-none');
      nameInput.classList.remove('is-invalid');
    });
  }

  if (startFormBtn) {
    startFormBtn.onclick = async (e) => {
      e.preventDefault();
      const idInput = document.getElementById('candidateIdInput');
      const collegeInput = document.getElementById('candidateCollegeInput');

      const rawTeamName = nameInput ? nameInput.value.trim() : '';

      if (!rawTeamName) {
        if (teamErrorEl) {
          teamErrorEl.innerHTML = '<i class="fa-solid fa-circle-exclamation me-1"></i> Please enter your official Team Name.';
          teamErrorEl.classList.remove('d-none');
        }
        if (nameInput) {
          nameInput.classList.add('is-invalid');
          nameInput.focus();
        }
        sound.warning();
        return;
      }

      // Check if team name already exists (case-insensitive)
      if (GameStorage.isTeamNameTaken(rawTeamName)) {
        if (teamErrorEl) {
          teamErrorEl.innerHTML = '<i class="fa-solid fa-circle-exclamation me-1"></i> Team Name already exists! Please choose a unique team name.';
          teamErrorEl.classList.remove('d-none');
        }
        if (nameInput) {
          nameInput.classList.add('is-invalid');
          nameInput.focus();
        }
        sound.warning();
        return;
      }

      // Also verify with server if running on network
      try {
        const checkRes = await fetch('/api/check-team-name?name=' + encodeURIComponent(rawTeamName));
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.taken) {
            if (teamErrorEl) {
              teamErrorEl.innerHTML = '<i class="fa-solid fa-circle-exclamation me-1"></i> Team Name already exists! Please choose a unique team name.';
              teamErrorEl.classList.remove('d-none');
            }
            if (nameInput) {
              nameInput.classList.add('is-invalid');
              nameInput.focus();
            }
            sound.warning();
            return;
          }
        }
      } catch (err) {}

      const teamInfo = {
        name: rawTeamName,
        teamName: rawTeamName,
        id: (idInput && idInput.value.trim()) ? idInput.value.trim() : 'TEAM-' + Math.floor(1000 + Math.random() * 9000),
        college: (collegeInput && collegeInput.value.trim()) ? collegeInput.value.trim() : 'Participant Institute'
      };

      ModalHelper.hide('candidateRegModal');
      startNewMindHackChallenge(teamInfo);
    };
  }

  // Handle Admin Login Modal submission
  const submitAdminLoginBtn = document.getElementById('submitAdminLoginBtn');
  const adminUsernameInput = document.getElementById('adminUsernameInput');
  const adminPasswordInput = document.getElementById('adminPasswordInput');
  const adminLoginError = document.getElementById('adminLoginError');

  const executeAdminLogin = () => {
    const user = (adminUsernameInput ? adminUsernameInput.value.trim() : '') || 'admin';
    const pass = adminPasswordInput ? adminPasswordInput.value.trim() : '';

    if (user.toLowerCase() === 'admin' && (pass === 'admin123' || pass === 'mindhack2026' || pass === 'admin')) {
      if (adminLoginError) adminLoginError.classList.add('d-none');
      sessionStorage.setItem('mindhack_admin_authenticated', 'true');
      sound.click();
      window.location.href = 'admin.html';
    } else {
      if (adminLoginError) adminLoginError.classList.remove('d-none');
      if (adminPasswordInput) {
        adminPasswordInput.classList.add('is-invalid');
        adminPasswordInput.focus();
      }
      sound.buzzer();
    }
  };

  if (submitAdminLoginBtn) {
    submitAdminLoginBtn.onclick = (e) => {
      e.preventDefault();
      executeAdminLogin();
    };
  }

  if (adminPasswordInput) {
    adminPasswordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeAdminLogin();
      }
    });
    adminPasswordInput.addEventListener('input', () => {
      if (adminLoginError) adminLoginError.classList.add('d-none');
      adminPasswordInput.classList.remove('is-invalid');
    });
  }

  // Auto trigger admin login modal if hash is #admin-login
  if (window.location.hash === '#admin-login') {
    ModalHelper.show('adminLoginModal');
  }

  // Handle start triggers & display current registration state
  const activeUser = GameStorage.getCurrentUser();
  let activeSession = GameStorage.getSession();
  const startBtn = document.getElementById('startChallengeBtn');

  const renderStartBtn = (user, session) => {
    if (!startBtn || !user || !user.teamName) return;

    if (session && session.status === 'in_progress') {
      const qNum = (session.currentIndex || 0) + 1;
      if (session.graceGiven) {
        startBtn.innerHTML = `<i class="fa-solid fa-play text-neon-green"></i> CONTINUE TO PLAY: ${user.teamName} <span class="badge bg-warning text-dark ms-2 font-mono">Q${qNum}</span>`;
        startBtn.className = 'cyber-btn cyber-btn-primary fs-5 px-5 py-3';
      } else {
        startBtn.innerHTML = `<i class="fa-solid fa-play"></i> RESUME ARENA: ${user.teamName} <span class="badge bg-info text-dark ms-2 font-mono">Q${qNum}</span>`;
        startBtn.className = 'cyber-btn cyber-btn-primary fs-5 px-5 py-3';
      }
      startBtn.onclick = (e) => {
        e.preventDefault();
        window.location.href = 'game.html';
      };
    } else if (session && (session.status === 'completed' || session.status === 'eliminated')) {
      startBtn.innerHTML = `<i class="fa-solid fa-chart-simple"></i> VIEW STATUS: ${user.teamName}`;
      startBtn.className = 'cyber-btn cyber-btn-outline fs-5 px-5 py-3';
      startBtn.onclick = (e) => {
        e.preventDefault();
        window.location.href = 'result.html';
      };
    }
  };

  renderStartBtn(activeUser, activeSession);

  // If candidate is registered, query server for latest Proctor Grace status!
  if (activeUser && activeUser.id) {
    GameStorage.getRemoteParticipant(activeUser.id, activeUser.teamName).then(remote => {
      if (remote) {
        // If server reports in_progress and grace was given (or local was eliminated)
        if (remote.status === 'in_progress' && (remote.graceGiven || (activeSession && activeSession.status === 'eliminated'))) {
          activeSession = GameStorage.getSession() || activeSession;
          if (activeSession) {
            activeSession.status = 'in_progress';
            activeSession.graceGiven = true;
            activeSession.tabSwitches = remote.tabSwitches || CONFIG.MAX_TAB_SWITCHES;
            const resumeIdx = typeof remote.eliminatedAtIndex === 'number' 
              ? remote.eliminatedAtIndex 
              : (typeof activeSession.eliminatedAtIndex === 'number' ? activeSession.eliminatedAtIndex : (activeSession.currentIndex || 0));
            activeSession.currentIndex = resumeIdx;
            activeSession.eliminatedAtIndex = resumeIdx;
            GameStorage.saveSession(activeSession);
            renderStartBtn(activeUser, activeSession);
          }
        }
      }
    }).catch(() => {});
  }

  // Attach to start triggers
  document.querySelectorAll('.start-challenge-trigger, #modalStartChallengeBtn').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      const currentUser = GameStorage.getCurrentUser();
      const currentSession = GameStorage.getSession();

      if (currentUser && currentUser.teamName && currentSession && currentSession.status === 'in_progress') {
        window.location.href = 'game.html';
        return;
      }
      if (currentUser && currentUser.teamName && currentSession && (currentSession.status === 'completed' || currentSession.status === 'eliminated')) {
        window.location.href = 'result.html';
        return;
      }

      // Show team registration modal
      ModalHelper.show('candidateRegModal');
    };
  });
}

// Execute immediately if DOM is interactive, otherwise on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeMindHackApp);
} else {
  initializeMindHackApp();
}
