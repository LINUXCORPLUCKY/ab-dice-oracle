const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Import modular API handlers
const streamHandler = require('./api/v1/stream');
const predictHandler = require('./api/v1/predict');
const liveRollsHandler = require('./api/v1/live-rolls');
const keysHandler = require('./api/v1/keys');
const indexApiHandler = require('./api/v1/index');
const everythingHandler = require('./api/v1/everything');

const PORT = process.env.PORT || 3005;
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function proxySabDice(remotePath, res) {
  const targetUrl = `https://sabdice.com${remotePath}`;
  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Referer': 'https://sabdice.com/'
    }
  };

  https.get(targetUrl, options, remoteRes => {
    res.writeHead(remoteRes.statusCode, {
      'Content-Type': remoteRes.headers['content-type'] || 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key'
    });
    remoteRes.pipe(res);
  }).on('error', err => {
    res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: 'Failed to reach sabdice.com', details: err.message }));
  });
}

const server = http.createServer(async (req, res) => {
  // Global CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key'
    });
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 1. COMMERCIAL API V1 ENDPOINTS
  if (pathname === '/api/v1/everything' || pathname === '/api/v1/all') {
    return await everythingHandler(req, res);
  }

  if (pathname === '/api/v1/stream' || pathname === '/api/stream') {
    return await streamHandler(req, res);
  }

  if (pathname === '/api/v1/predict' || pathname === '/api/predict') {
    return await predictHandler(req, res);
  }

  if (pathname === '/api/v1/live-rolls') {
    return await liveRollsHandler(req, res);
  }

  if (pathname === '/api/v1/keys') {
    return await keysHandler(req, res);
  }

  if (pathname === '/api/v1' || pathname === '/api/v1/') {
    return indexApiHandler(req, res);
  }

  // 2. LEGACY / DIRECT SABDICE PROXY ENDPOINTS
  if (pathname.startsWith('/api/sab/')) {
    const targetPath = pathname.replace('/api/sab', '/api') + (parsedUrl.search || '');
    return proxySabDice(targetPath, res);
  }

  if (pathname.startsWith('/api/verify/')) {
    const rollId = pathname.replace('/api/verify/', '').trim();
    return proxySabDice(`/api/rolls/verify/${encodeURIComponent(rollId)}`, res);
  }

  if (pathname.startsWith('/api/user/')) {
    const playerId = pathname.replace('/api/user/', '').trim();
    const query = parsedUrl.search || '?limit=50';
    return proxySabDice(`/api/rolls/users/${encodeURIComponent(playerId)}${query}`, res);
  }

  if (pathname === '/api/streamers') {
    return proxySabDice('/api/streamers', res);
  }
  if (pathname === '/api/streamers/live') {
    return proxySabDice('/api/streamers/live', res);
  }

  if (pathname === '/api/live-rolls') {
    const query = parsedUrl.search || '?limit=100';
    return proxySabDice(`/api/rolls/public${query}`, res);
  }

  if (pathname.startsWith('/api/player-rolls/')) {
    const username = pathname.replace('/api/player-rolls/', '').trim();
    return proxySabDice(`/api/rolls/public?limit=100&q=${encodeURIComponent(username)}`, res);
  }

  // 3. STATIC FILE SERVING
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  // Fallback to root directory if not in public
  if (!fs.existsSync(filePath)) {
    const rootPath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
    if (fs.existsSync(rootPath)) {
      filePath = rootPath;
    }
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
      if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, 'index.html');
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500);
        return res.end('Server Error');
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log(`[ SAB ORACLE PREDICTOR ] Server active on http://localhost:${PORT}`);
  console.log(`[ API STREAM ] Live rolls SSE: http://localhost:${PORT}/api/v1/stream?predict=true&api_key=SAB-DEMO-PREVIEW`);
  console.log(`[ API PREDICT ] Neural Predictor: http://localhost:${PORT}/api/v1/predict?latest=true&api_key=SAB-DEMO-PREVIEW`);
});
