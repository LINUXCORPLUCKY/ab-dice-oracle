/**
 * SAB ORACLE 99% — PREDICTION API ENDPOINT
 * GET/POST /api/v1/predict
 * Generates exact neural dice predictions matching website oracle
 */

const url = require('url');
const { runNeuralPrediction } = require('../../oracle_engine');
const { validateKey, extractApiKey } = require('../../api_keys');
const { sabStreamer } = require('../../sab_service');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const apiKey = extractApiKey(req, parsedUrl);
  const auth = validateKey(apiKey);

  if (!auth.valid) {
    res.statusCode = auth.code === 'RATE_LIMIT_EXCEEDED' ? 429 : 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      success: false,
      error: auth.error,
      code: auth.code,
      pricing: 'https://ab-dice-oracle.vercel.app/'
    }));
  }

  // Parse Body for POST
  let body = {};
  if (req.method === 'POST') {
    try {
      body = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(await getRawBody(req));
    } catch (e) {
      body = {};
    }
  }

  const query = parsedUrl.query || {};
  const rollId = query.rollId || query.roll_id || body.rollId || body.roll_id;
  const username = query.username || query.streamer || body.username || body.streamer;
  const playerId = query.playerId || query.player_id || body.playerId;
  const customColors = body.colors || (query.colors ? query.colors.split(',') : null);
  const isLatest = query.latest === 'true' || (!rollId && !username && !playerId && !customColors);

  try {
    const globalFeed = await sabStreamer.getPublicRolls(50);
    let contextRoll = null;
    let historyRolls = [];

    if (customColors && Array.isArray(customColors) && customColors.length > 0) {
      contextRoll = {
        rollId: 'CUSTOM-SIMULATION',
        username: auth.client,
        colors: customColors,
        createdAt: new Date().toISOString()
      };
      historyRolls = globalFeed;
    } else if (rollId) {
      const verifyRes = await sabStreamer.verifyRoll(rollId);
      if (verifyRes.ok && verifyRes.data && verifyRes.data.status === 'verified') {
        contextRoll = verifyRes.data;
        if (contextRoll.username) {
          const userRollsRes = await sabStreamer.getUserRolls(contextRoll.username);
          if (userRollsRes.ok && Array.isArray(userRollsRes.data)) {
            historyRolls = userRollsRes.data;
          }
        }
      } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({
          success: false,
          error: `Roll ID ${rollId} not found or unverified on SabDice ledger.`
        }));
      }
    } else if (username || playerId) {
      const targetUser = username || playerId;
      const userRes = await sabStreamer.getUserRolls(targetUser);
      if (userRes.ok) {
        if (Array.isArray(userRes.data) && userRes.data.length > 0) {
          historyRolls = userRes.data;
          contextRoll = userRes.data[0];
        } else if (userRes.data?.rolls && userRes.data.rolls.length > 0) {
          historyRolls = userRes.data.rolls;
          contextRoll = userRes.data.rolls[0];
        }
      }

      if (!contextRoll) {
        // Fallback to top public roll with username metadata
        contextRoll = {
          rollId: 'BASELINE-USER',
          username: targetUser,
          colors: globalFeed[0]?.colors || ['Red', 'Blue', 'Green', 'Yellow'],
          createdAt: new Date().toISOString()
        };
      }
    } else if (isLatest) {
      if (globalFeed.length > 0) {
        contextRoll = globalFeed[0];
        historyRolls = globalFeed.slice(1, 30);
      } else {
        contextRoll = {
          rollId: 'BASELINE-FALLBACK',
          username: 'System',
          colors: ['Red', 'Blue', 'Green', 'Yellow'],
          createdAt: new Date().toISOString()
        };
      }
    }

    // Run Neural Prediction
    const prediction = runNeuralPrediction(contextRoll, historyRolls, globalFeed);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      success: true,
      query: { rollId, username, playerId, latest: isLatest },
      contextRoll: {
        rollId: contextRoll.rollId,
        username: contextRoll.username,
        colors: contextRoll.colors,
        createdAt: contextRoll.createdAt
      },
      prediction,
      license: {
        client: auth.client,
        tier: auth.tier,
        rateLimitPerMin: auth.rateLimitPerMin,
        requestsThisMinute: auth.requestsThisMinute
      }
    }, null, 2));

  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      success: false,
      error: 'Internal prediction error',
      details: err.message
    }));
  }
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
