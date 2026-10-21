/**
 * SAB ORACLE 99% — API KEYS & LICENSING ENDPOINT
 * GET/POST /api/v1/keys
 * Handles key verification, tier check & new license issuance for buyers
 */

const url = require('url');
const { validateKey, generateNewKey, extractApiKey } = require('../../api_keys');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const query = parsedUrl.query || {};

  // GET: Verify existing key status
  if (req.method === 'GET') {
    const key = query.key || extractApiKey(req, parsedUrl);
    if (!key) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({
        status: 'active',
        service: 'SAB ORACLE 99% API ENGINE',
        plans: [
          {
            tier: 'demo',
            price: 'Free',
            features: ['30 requests/min', '50 rolls stream limit', 'Basic neural forecast'],
            testKey: 'SAB-DEMO-PREVIEW'
          },
          {
            tier: 'pro',
            price: '$49/month',
            features: ['1,200 requests/min', 'Unlimited SSE live stream', '99.1% 1-Color Sniper engine', 'Full historical deficit indexing'],
            licensePrefix: 'SAB-PRO-...'
          },
          {
            tier: 'vip',
            price: '$149/month',
            features: ['5,000 requests/min', 'Sub-10ms priority stream', 'Dedicated Webhook push', 'Raw PRNG state entropy analysis'],
            licensePrefix: 'SAB-VIP-...'
          }
        ],
        documentation: 'https://ab-dice-oracle.vercel.app/'
      }, null, 2));
    }

    const auth = validateKey(key);
    res.statusCode = auth.valid ? 200 : 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(auth, null, 2));
  }

  // POST: Generate key (Requires Admin master key)
  if (req.method === 'POST') {
    const adminKey = extractApiKey(req, parsedUrl);
    const auth = validateKey(adminKey);

    if (!auth.valid || auth.tier !== 'admin') {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({
        success: false,
        error: 'Only the System Administrator (SAB-ADMIN-ORACLE-MASTER) can generate new commercial client keys.'
      }));
    }

    let body = {};
    try {
      body = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(await getRawBody(req));
    } catch (e) {
      body = {};
    }

    const clientName = body.client || query.client || 'Commercial Client';
    const tier = (body.tier || query.tier || 'pro').toLowerCase();
    const days = parseInt(body.days || query.days || 30, 10);

    const newKeyData = generateNewKey({ client: clientName, tier, days });

    res.statusCode = 201;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      success: true,
      message: `Commercial API key generated for [${clientName}]`,
      license: newKeyData
    }, null, 2));
  }

  res.statusCode = 405;
  res.end('Method Not Allowed');
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
