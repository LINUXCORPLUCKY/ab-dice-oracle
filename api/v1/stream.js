/**
 * SAB ORACLE 99% — REAL-TIME LIVE ROLLS STREAM API (SSE & POLLING)
 * GET /api/v1/stream
 * Streams live dice rolls directly from sabdice with real-time neural predictions
 */

const url = require('url');
const { runNeuralPrediction } = require('../../oracle_engine');
const { validateKey, extractApiKey } = require('../../api_keys');
const { sabStreamer } = require('../../sab_service');

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const query = parsedUrl.query || {};
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

  const includePredict = query.predict === 'true' || query.predict === '1';
  const format = query.format || 'sse'; // 'sse' or 'poll'
  const filterStreamer = query.streamer || query.username || null;

  // 1. POLLING FALLBACK (Returns immediate JSON snapshot)
  if (format === 'poll' || format === 'json') {
    const rolls = await sabStreamer.getPublicRolls(parseInt(query.limit, 10) || 20);
    const filtered = filterStreamer
      ? rolls.filter(r => r.username && r.username.toLowerCase() === filterStreamer.toLowerCase())
      : rolls;

    let prediction = null;
    if (includePredict && filtered.length > 0) {
      prediction = runNeuralPrediction(filtered[0], filtered.slice(1, 30), rolls);
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      success: true,
      streamType: 'poll',
      count: filtered.length,
      rolls: filtered,
      nextRollPrediction: prediction,
      license: {
        client: auth.client,
        tier: auth.tier
      }
    }, null, 2));
  }

  // 2. SERVER-SENT EVENTS (SSE LIVE STREAM)
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Initial greeting
  res.write(`event: connected\ndata: ${JSON.stringify({
    status: 'ONLINE',
    stream: 'sabdice_live_rolls_v1',
    connectedAt: new Date().toISOString(),
    client: auth.client,
    tier: auth.tier,
    predictionEnabled: includePredict,
    filterStreamer: filterStreamer || 'ALL_GLOBAL'
  })}\n\n`);

  let rollsStreamed = 0;
  const maxRolls = auth.streamLimitRolls || Infinity;

  // Send the most recent roll immediately
  const initialRolls = await sabStreamer.getPublicRolls(15);
  let lastSentRollId = null;

  if (initialRolls.length > 0) {
    const topRoll = initialRolls[0];
    lastSentRollId = topRoll.rollId;
    let initialPred = null;
    if (includePredict) {
      initialPred = runNeuralPrediction(topRoll, initialRolls.slice(1, 25), initialRolls);
    }

    res.write(`event: snapshot\ndata: ${JSON.stringify({
      roll: topRoll,
      recentRolls: initialRolls.slice(0, 8),
      prediction: initialPred
    })}\n\n`);
    rollsStreamed++;
  }

  // Push new rolls handler
  const rollListener = (newRoll) => {
    if (filterStreamer && (!newRoll.username || newRoll.username.toLowerCase() !== filterStreamer.toLowerCase())) {
      return;
    }

    if (newRoll.rollId === lastSentRollId) return;
    lastSentRollId = newRoll.rollId;

    let pred = null;
    if (includePredict) {
      pred = runNeuralPrediction(newRoll, sabStreamer.latestRolls.slice(0, 20), sabStreamer.latestRolls);
    }

    res.write(`event: roll\ndata: ${JSON.stringify({
      roll: newRoll,
      prediction: pred,
      streamIndex: rollsStreamed + 1,
      timestamp: new Date().toISOString()
    })}\n\n`);

    rollsStreamed++;
    if (rollsStreamed >= maxRolls) {
      res.write(`event: limit_reached\ndata: ${JSON.stringify({
        message: `Stream limit of ${maxRolls} rolls reached for tier [${auth.tier.toUpperCase()}]. Upgrade to Pro for unlimited stream: https://ab-dice-oracle.vercel.app/`
      })}\n\n`);
      cleanup();
      res.end();
    }
  };

  sabStreamer.on('new_roll', rollListener);
  sabStreamer.startBackgroundSync(2500);

  // Periodic heartbeat & poll check (every 3 seconds)
  const pollInterval = setInterval(async () => {
    try {
      // Send comment ping to prevent proxy timeout
      res.write(`: ping ${Date.now()}\n\n`);

      // Double-check latest roll in case event was missed
      const fresh = await sabStreamer.getPublicRolls(10);
      if (fresh.length > 0 && fresh[0].rollId !== lastSentRollId) {
        rollListener(fresh[0]);
      }
    } catch (e) {
      cleanup();
    }
  }, 3000);

  function cleanup() {
    clearInterval(pollInterval);
    sabStreamer.removeListener('new_roll', rollListener);
  }

  req.on('close', cleanup);
  req.on('end', cleanup);
};
