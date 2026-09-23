/**
 * MIND HACK 2026 - High-Concurrency Competition Server
 * Native Node.js HTTP Server supporting 100+ concurrent players over Wi-Fi / LAN.
 * No external npm packages required.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');

const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';
const DATA_FILE = path.join(__dirname, 'participants.json');
const BASE_DIR = __dirname;

// ── Server Performance Tuning for 100+ Concurrent Players ────────────────────
// Node's default keep-alive is off; enabling it reuses TCP connections
// so each player's browser doesn't need to re-handshake on every request.
// maxConnections = 0 → unlimited (Node's event loop handles backpressure naturally).
const KEEP_ALIVE_TIMEOUT_MS = 65000;  // slightly above Nginx/proxy defaults
const HEADERS_TIMEOUT_MS    = 70000;
const REQUEST_TIMEOUT_MS    = 30000;
// ─────────────────────────────────────────────────────────────────────────────

// In-Memory state for sub-millisecond API response
let participants = [];

// Load persisted participants from disk if available
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    participants = JSON.parse(raw);
    console.log(`[Storage] Loaded ${participants.length} existing participant records from participants.json`);
  }
} catch (err) {
  console.warn('[Storage] Warning reading participants.json:', err.message);
  participants = [];
}

// Debounced disk persistence to withstand high concurrency bursts without disk thrashing
let saveTimeout = null;
function persistParticipants() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(participants, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Storage] Error saving participants.json:', err);
    }
  }, 300);
}

// MIME types lookup
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

// Helper: parse JSON request body safely
function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // Protect against overly large payloads (> 5MB)
      if (body.length > 5 * 1024 * 1024) {
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

// Helper: send JSON response
function sendJson(res, statusCode, data) {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(payload);
}

// Create HTTP server with keep-alive for 100+ concurrent connections
const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    });
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // -------------------------------------------------------------------------
  // REST API Endpoints
  // -------------------------------------------------------------------------

  // GET /api/participants
  if (req.method === 'GET' && pathname === '/api/participants') {
    return sendJson(res, 200, participants);
  }

  // GET /api/check-team-name?name=...
  if (req.method === 'GET' && pathname === '/api/check-team-name') {
    const checkName = (parsedUrl.query.name || '').trim().toLowerCase();
    if (!checkName) {
      return sendJson(res, 200, { taken: false });
    }
    const exists = participants.some(p => {
      const existing = (p.teamName || p.name || '').trim().toLowerCase();
      return existing === checkName;
    });
    return sendJson(res, 200, { taken: exists });
  }

  // GET /api/participant-status?id=...&name=...
  if (req.method === 'GET' && pathname === '/api/participant-status') {
    const searchId = (parsedUrl.query.id || '').trim();
    const searchName = (parsedUrl.query.name || '').trim().toLowerCase();
    const found = participants.find(p => 
      (searchId && p.id === searchId) || 
      (searchName && (p.teamName || p.name || '').toLowerCase() === searchName)
    );
    if (found) {
      return sendJson(res, 200, { found: true, participant: found });
    }
    return sendJson(res, 200, { found: false });
  }

  // POST /api/register
  if (req.method === 'POST' && pathname === '/api/register') {
    const data = await parseJsonBody(req);
    const candidateName = (data.teamName || data.name || '').trim();

    if (!candidateName) {
      return sendJson(res, 400, { success: false, error: 'Team name is required.' });
    }

    const candidateLower = candidateName.toLowerCase();
    const existingIndex = participants.findIndex(p => p.id === data.id);
    const nameTakenByOther = participants.some(p => {
      if (p.id === data.id) return false;
      const existing = (p.teamName || p.name || '').trim().toLowerCase();
      return existing === candidateLower;
    });

    if (nameTakenByOther) {
      return sendJson(res, 409, {
        success: false,
        error: 'Team Name already exists! Please choose a unique team name.'
      });
    }

    const candidateRecord = {
      id: data.id || `TEAM-${Math.floor(1000 + Math.random() * 9000)}`,
      name: candidateName,
      teamName: candidateName,
      college: data.college || 'Engineering Institute',
      registeredAt: data.registeredAt || new Date().toISOString(),
      status: data.status || 'in_progress',
      score: data.score || 0,
      totalQuestions: data.totalQuestions || 50,
      answeredCount: data.answeredCount || 0,
      percentage: data.percentage || 0,
      timeUsedSeconds: data.timeUsedSeconds || 0,
      tabSwitches: data.tabSwitches || 0,
      tabSwitchLogs: data.tabSwitchLogs || [],
      eliminatedAt: data.eliminatedAt || null,
      eliminationReason: data.eliminationReason || null,
      completedAt: data.completedAt || null
    };

    if (existingIndex !== -1) {
      participants[existingIndex] = Object.assign(participants[existingIndex], candidateRecord);
    } else {
      participants.unshift(candidateRecord);
    }

    persistParticipants();
    return sendJson(res, 200, { success: true, participant: candidateRecord });
  }

  // POST /api/update-participant
  if (req.method === 'POST' && pathname === '/api/update-participant') {
    const data = await parseJsonBody(req);
    const { id, updates } = data;

    if (!id || !updates) {
      return sendJson(res, 400, { success: false, error: 'Missing id or updates' });
    }

    const idx = participants.findIndex(p => p.id === id);
    if (idx !== -1) {
      participants[idx] = Object.assign(participants[idx], updates);
      persistParticipants();
      return sendJson(res, 200, { success: true, participant: participants[idx] });
    } else {
      return sendJson(res, 404, { success: false, error: 'Participant not found' });
    }
  }

  // POST /api/admin/login
  if (req.method === 'POST' && pathname === '/api/admin/login') {
    const data = await parseJsonBody(req);
    const user = (data.username || '').trim().toLowerCase();
    const pass = (data.password || '').trim();

    if (user === 'admin' && (pass === 'admin123' || pass === 'mindhack2026' || pass === 'admin')) {
      return sendJson(res, 200, { success: true, token: 'mh_proctor_token_2026' });
    } else {
      return sendJson(res, 401, { success: false, error: 'Invalid username or password' });
    }
  }

  // POST /api/admin/reset
  if (req.method === 'POST' && pathname === '/api/admin/reset') {
    participants = [];
    persistParticipants();
    console.log('[Admin] Reset all participants records.');
    return sendJson(res, 200, { success: true, message: 'All participants cleared.' });
  }

  // POST /api/admin/seed
  if (req.method === 'POST' && pathname === '/api/admin/seed') {
    const now = Date.now();
    participants = [
      {
        id: "TEAM-2026-001",
        name: "Team Cyber Hawks",
        teamName: "Team Cyber Hawks",
        college: "Dept of AI & Data Science",
        registeredAt: new Date(now - 15 * 60000).toISOString(),
        completedAt: new Date(now - 2 * 60000).toISOString(),
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
        registeredAt: new Date(now - 18 * 60000).toISOString(),
        completedAt: new Date(now - 4 * 60000).toISOString(),
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
        registeredAt: new Date(now - 10 * 60000).toISOString(),
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
        registeredAt: new Date(now - 12 * 60000).toISOString(),
        status: "in_progress",
        score: 22,
        totalQuestions: 50,
        answeredCount: 26,
        percentage: 44,
        timeUsedSeconds: 640,
        tabSwitches: 0,
        tabSwitchLogs: []
      },
      {
        id: "TEAM-2026-042",
        name: "Shadow Hackers",
        teamName: "Shadow Hackers",
        college: "Cyber Security & Forensics",
        registeredAt: new Date(now - 14 * 60000).toISOString(),
        completedAt: null,
        eliminatedAt: new Date(now - 8 * 60000).toISOString(),
        status: "eliminated",
        score: 0,
        totalQuestions: 50,
        answeredCount: 19,
        percentage: 0,
        timeUsedSeconds: 380,
        tabSwitches: 1,
        eliminationReason: "AUTOMATICALLY ELIMINATED: Team switched browser tabs / left exam window. Challenge terminated.",
        tabSwitchLogs: [
          `[${new Date(now - 8 * 60000).toLocaleTimeString()}] Tab switched / window lost focus - Instant Elimination Triggered`
        ]
      }
    ];
    persistParticipants();
    console.log('[Admin] Seeded demo participants.');
    return sendJson(res, 200, { success: true, participants });
  }

  // -------------------------------------------------------------------------
  // Static File Serving
  // -------------------------------------------------------------------------
  let safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }

  const filePath = path.join(BASE_DIR, safePath);

  // Security check: ensure target stays inside BASE_DIR
  if (!filePath.startsWith(BASE_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end(`404 Not Found: ${safePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Stream files with high performance
    const stream = fs.createReadStream(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': ext === '.html' || ext === '.js' || ext === '.css' ? 'no-cache' : 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    });
    stream.pipe(res);
  });
});

// ── Apply performance tuning for 100+ concurrent Wi-Fi players ───────────────
// Keep-alive: reuse TCP connections per browser so 100 laptops don't each
// need a fresh TCP handshake for every asset, API poll and score update.
server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
server.headersTimeout   = HEADERS_TIMEOUT_MS;
server.requestTimeout   = REQUEST_TIMEOUT_MS;
// ─────────────────────────────────────────────────────────────────────────────

// Start listening
server.listen(PORT, HOST, () => {
  // Find local network IP addresses
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }

  console.log('\n╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║               🧠 MIND HACK 2026 - HIGH PERFORMANCE ARENA SERVER               ║');
  console.log('╠═══════════════════════════════════════════════════════════════════════════════╣');
  console.log(`║  Local Host:          http://localhost:${PORT}/                                  ║`);
  console.log(`║  Admin Command Panel: http://localhost:${PORT}/admin.html                         ║`);
  console.log('║                                                                               ║');
  console.log('║  Participant Arena URLs (Share with up to 100+ players on Wi-Fi / LAN):      ║');
  addresses.forEach(ip => {
    console.log(`║    👉 http://${ip}:${PORT}/                                           ║`);
  });
  console.log('║                                                                               ║');
  console.log('║  Default Admin Credentials:                                                   ║');
  console.log('║    Username: admin                                                            ║');
  console.log('║    Password: admin123  (or mindhack2026)                                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');
});
