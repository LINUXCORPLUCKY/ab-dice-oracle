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
    res.writeHead(502, { 
      'Content-Type': 'application/json', 
      'Access-Control-Allow-Origin': '*' 
    });
    res.end(JSON.stringify({ error: 'Failed to reach sabdice.com', details: err.message }));
  });
}

module.exports = (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  let pathname = '';
  if (req.query && Array.isArray(req.query.path)) {
    pathname = '/api/' + req.query.path.join('/');
  } else if (req.query && typeof req.query.path === 'string') {
    pathname = '/api/' + req.query.path;
  } else {
    const parsed = url.parse(req.url, true);
    pathname = parsed.pathname || '';
  }

  const parsedUrl = url.parse(req.url, true);
  const search = parsedUrl.search || '';

  if (pathname.includes('/verify/')) {
    const rollId = pathname.split('/verify/')[1]?.trim();
    if (rollId) {
      return proxySabDice(`/api/rolls/verify/${encodeURIComponent(rollId)}`, res);
    }
  }

  if (pathname.includes('/user/')) {
    const playerId = pathname.split('/user/')[1]?.trim();
    if (playerId) {
      const query = search || '?limit=50';
      return proxySabDice(`/api/rolls/users/${encodeURIComponent(playerId)}${query}`, res);
    }
  }

  if (pathname.includes('/player-rolls/')) {
    const username = pathname.split('/player-rolls/')[1]?.trim();
    if (username) {
      return proxySabDice(`/api/rolls/public?limit=100&q=${encodeURIComponent(username)}`, res);
    }
  }

  if (pathname.endsWith('/streamers')) {
    return proxySabDice('/api/streamers', res);
  }
  if (pathname.endsWith('/streamers/live')) {
    return proxySabDice('/api/streamers/live', res);
  }

  if (pathname.endsWith('/live-rolls')) {
    const query = search || '?limit=100';
    return proxySabDice(`/api/rolls/public${query}`, res);
  }

  if (pathname.includes('/api/sab/')) {
    const targetPath = pathname.replace('/api/sab', '/api') + search;
    return proxySabDice(targetPath, res);
  }

  res.writeHead(200, { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify({ status: 'SabDice Proxy Operational' }));
};
