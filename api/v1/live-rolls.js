/**
 * SAB ORACLE 99% — LIVE ROLLS REST ENDPOINT
 * GET /api/v1/live-rolls
 * Retrieves recent dice rolls with live next-roll neural forecast
 */

const url = require('url');
const { runNeuralPrediction } = require('../../oracle_engine');
const { validateKey, extractApiKey } = require('../../api_keys');
const { sabStreamer } = require('../../sab_service');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const apiKey = extractApiKey(req, parsedUrl);
  
  // Public access allowed for this endpoint with demo quota, or pro key
  const auth = apiKey ? validateKey(apiKey) : { valid: true, client: 'Public Visitor', tier: 'free_preview' };

  const query = parsedUrl.query || {};
  const limit = Math.min(parseInt(query.limit, 10) || 50, 100);
  const includePredict = query.predict !== 'false';

  try {
    const rolls = await sabStreamer.getPublicRolls(limit);
    let prediction = null;

    if (includePredict && rolls.length > 0) {
      prediction = runNeuralPrediction(rolls[0], rolls.slice(1, 30), rolls);
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      success: true,
      count: rolls.length,
      rolls,
      nextRollPrediction: prediction,
      license: {
        tier: auth.tier || 'free_preview',
        client: auth.client || 'Public'
      },
      updatedAt: new Date().toISOString()
    }, null, 2));

  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      success: false,
      error: 'Failed to retrieve live rolls',
      details: err.message
    }));
  }
};
