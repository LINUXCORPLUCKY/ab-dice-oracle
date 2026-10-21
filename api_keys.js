/**
 * SAB ORACLE 99% — COMMERCIAL API KEY & ACCESS CONTROL SYSTEM
 * Enables selling API keys with tiering, quota checks, and master generator
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'keys_db.json');

// Built-in starter keys
const BUILTIN_KEYS = {
  'SAB-DEMO-PREVIEW': {
    client: 'Public Demo Sandbox',
    tier: 'demo',
    rateLimitPerMin: 30,
    streamLimitRolls: 50,
    createdAt: '2026-01-01T00:00:00Z',
    active: true
  },
  'SAB-PRO-89F2A1': {
    client: 'Commercial Pro Licensee',
    tier: 'pro',
    rateLimitPerMin: 1200,
    streamLimitRolls: Infinity,
    createdAt: '2026-01-01T00:00:00Z',
    active: true
  },
  'SAB-VIP-ELITE': {
    client: 'VIP High-Frequency Partner',
    tier: 'vip',
    rateLimitPerMin: 5000,
    streamLimitRolls: Infinity,
    createdAt: '2026-01-01T00:00:00Z',
    active: true
  },
  'SAB-ADMIN-ORACLE-MASTER': {
    client: 'System Administrator (Owner)',
    tier: 'admin',
    rateLimitPerMin: Infinity,
    streamLimitRolls: Infinity,
    createdAt: '2026-01-01T00:00:00Z',
    active: true
  }
};

// In-memory request counters for rate limiting
const requestCounters = new Map();

function loadKeys() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf8');
      const custom = JSON.parse(data);
      return { ...BUILTIN_KEYS, ...custom };
    }
  } catch (err) {
    console.warn('[API Keys] Error loading keys_db.json:', err.message);
  }
  return { ...BUILTIN_KEYS };
}

function saveKeys(keys) {
  try {
    // Only persist non-builtin or updated keys
    const custom = {};
    for (const [k, v] of Object.entries(keys)) {
      if (!BUILTIN_KEYS[k] || BUILTIN_KEYS[k].client !== v.client) {
        custom[k] = v;
      }
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(custom, null, 2), 'utf8');
  } catch (err) {
    console.warn('[API Keys] Error saving keys_db.json:', err.message);
  }
}

/**
 * Validate an API key from request
 */
function validateKey(keyString) {
  if (!keyString || typeof keyString !== 'string') {
    return {
      valid: false,
      code: 'MISSING_API_KEY',
      error: 'API key is required. Pass via header "x-api-key: YOUR_KEY" or query param "?api_key=YOUR_KEY". For free demo access use: "SAB-DEMO-PREVIEW". Purchase license at https://ab-dice-oracle.vercel.app/'
    };
  }

  const cleanKey = keyString.trim();
  const allKeys = loadKeys();
  const keyData = allKeys[cleanKey];

  if (!keyData || !keyData.active) {
    return {
      valid: false,
      code: 'INVALID_API_KEY',
      error: `Invalid or deactivated API key (${cleanKey.slice(0, 8)}...). Purchase active license at https://ab-dice-oracle.vercel.app/`
    };
  }

  // Rate limit check
  const now = Date.now();
  const minuteWindow = Math.floor(now / 60000);
  const counterKey = `${cleanKey}:${minuteWindow}`;
  const currentCount = (requestCounters.get(counterKey) || 0) + 1;
  requestCounters.set(counterKey, currentCount);

  // Evict old windows every 50 calls
  if (requestCounters.size > 200) {
    for (const [k] of requestCounters.entries()) {
      const parts = k.split(':');
      if (parseInt(parts[1], 10) < minuteWindow - 2) {
        requestCounters.delete(k);
      }
    }
  }

  if (currentCount > keyData.rateLimitPerMin) {
    return {
      valid: false,
      code: 'RATE_LIMIT_EXCEEDED',
      error: `Rate limit of ${keyData.rateLimitPerMin} req/min exceeded for tier [${keyData.tier.toUpperCase()}]. Upgrade at https://ab-dice-oracle.vercel.app/`
    };
  }

  return {
    valid: true,
    key: cleanKey,
    client: keyData.client,
    tier: keyData.tier,
    rateLimitPerMin: keyData.rateLimitPerMin,
    streamLimitRolls: keyData.streamLimitRolls,
    requestsThisMinute: currentCount
  };
}

/**
 * Generate a new API key to sell to a client
 */
function generateNewKey({ client = 'Customer', tier = 'pro', days = 30 }) {
  const token = 'SAB-' + tier.toUpperCase() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const expires = new Date(Date.now() + days * 86400000).toISOString();
  
  const limits = {
    demo: 30,
    pro: 1200,
    vip: 5000,
    admin: Infinity
  };

  const newRecord = {
    client,
    tier,
    rateLimitPerMin: limits[tier] || 600,
    streamLimitRolls: tier === 'demo' ? 50 : Infinity,
    createdAt: new Date().toISOString(),
    expiresAt: expires,
    active: true
  };

  const allKeys = loadKeys();
  allKeys[token] = newRecord;
  saveKeys(allKeys);

  return {
    apiKey: token,
    ...newRecord
  };
}

/**
 * Extract API key from HTTP request (supports header, query, bearer)
 */
function extractApiKey(req, parsedUrl) {
  // 1. Header x-api-key
  if (req.headers && req.headers['x-api-key']) {
    return req.headers['x-api-key'];
  }
  // 2. Authorization Bearer
  if (req.headers && req.headers['authorization']) {
    const auth = req.headers['authorization'];
    if (auth.startsWith('Bearer ')) {
      return auth.substring(7).trim();
    }
  }
  // 3. Query params: api_key or key
  if (parsedUrl && parsedUrl.query) {
    if (parsedUrl.query.api_key) return parsedUrl.query.api_key;
    if (parsedUrl.query.key) return parsedUrl.query.key;
  }
  return null;
}

module.exports = {
  validateKey,
  generateNewKey,
  extractApiKey,
  BUILTIN_KEYS
};
