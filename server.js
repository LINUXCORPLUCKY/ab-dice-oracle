const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

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
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    remoteRes.pipe(res);
  }).on('error', err => {
    res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: 'Failed to reach sabdice.com', details: err.message }));
  });
}

const server = http.createServer((req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // API Proxy endpoints
  if (pathname.startsWith('/api/sab/')) {
    // Forward /api/sab/rolls/verify/:id -> /api/rolls/verify/:id
    const targetPath = pathname.replace('/api/sab', '/api') + (parsedUrl.search || '');
    return proxySabDice(targetPath, res);
  }

  // Direct roll verification proxy: /api/verify/:rollId
  if (pathname.startsWith('/api/verify/')) {
    const rollId = pathname.replace('/api/verify/', '').trim();
    return proxySabDice(`/api/rolls/verify/${encodeURIComponent(rollId)}`, res);
  }

  // Direct Player ID / Verification ID proxy: /api/user/:playerId
  if (pathname.startsWith('/api/user/')) {
    const playerId = pathname.replace('/api/user/', '').trim();
    const query = parsedUrl.search || '?limit=50';
    return proxySabDice(`/api/rolls/users/${encodeURIComponent(playerId)}${query}`, res);
  }

  // Streamers endpoints: /api/streamers and /api/streamers/live
  if (pathname === '/api/streamers') {
    return proxySabDice('/api/streamers', res);
  }
  if (pathname === '/api/streamers/live') {
    return proxySabDice('/api/streamers/live', res);
  }

  // Direct live public rolls proxy: /api/live-rolls
  if (pathname === '/api/live-rolls') {
    const query = parsedUrl.search || '?limit=100';
    return proxySabDice(`/api/rolls/public${query}`, res);
  }

  // Direct player history proxy: /api/player-rolls/:username
  if (pathname.startsWith('/api/player-rolls/')) {
    const username = pathname.replace('/api/player-rolls/', '').trim();
    return proxySabDice(`/api/rolls/public?limit=100&q=${encodeURIComponent(username)}`, res);
  }

  // Static File Serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  
  // Safe path check
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA routing
      filePath = path.join(PUBLIC_DIR, 'index.html');
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
});
