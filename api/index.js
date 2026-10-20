const https = require('https');
const url = require('url');

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

module.exports = (req, res) => {
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
  const pathname = parsedUrl.pathname || '';

  // API Proxy endpoints
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

  res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
};
