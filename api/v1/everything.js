/**
 * SAB ORACLE 99% — ALL-IN-ONE MASTER API ENDPOINT
 * GET /api/v1/everything & /api/v1/all
 * Returns entire oracle state: live rolls, next-roll prediction, 6-color matrix, heatmap & streamers in 1 call
 */

const url = require('url');
const { runNeuralPrediction, calculatePattern, COLOR_CONFIG, DICE_COLORS } = require('../../oracle_engine');
const { validateKey, extractApiKey } = require('../../api_keys');
const { sabStreamer } = require('../../sab_service');

const KNOWN_STREAMERS = ['jdrizzle2515rust', 'Lazy_4740', 'Lawe', 'Tyleras60', 'laffik_1'];

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
  const auth = apiKey ? validateKey(apiKey) : { valid: true, client: 'Public Preview', tier: 'demo', rateLimitPerMin: 30 };

  if (apiKey && !auth.valid) {
    res.statusCode = auth.code === 'RATE_LIMIT_EXCEEDED' ? 429 : 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: false, error: auth.error }));
  }

  const query = parsedUrl.query || {};
  const limit = Math.min(parseInt(query.limit, 10) || 50, 100);

  try {
    const rolls = await sabStreamer.getPublicRolls(limit);
    const topRoll = rolls[0] || {
      rollId: 'BASELINE-0000',
      username: 'System',
      colors: ['Red', 'Blue', 'Green', 'Yellow'],
      createdAt: new Date().toISOString()
    };

    // 1. Neural Prediction for the upcoming roll
    const prediction = runNeuralPrediction(topRoll, rolls.slice(1, 30), rolls);

    // 2. Global Color Heatmap calculation
    const counts = {};
    DICE_COLORS.forEach(c => { counts[c] = 0; });
    let totalDice = 0;

    rolls.forEach(r => {
      if (Array.isArray(r.colors)) {
        r.colors.forEach(col => {
          if (counts[col] !== undefined) {
            counts[col]++;
            totalDice++;
          }
        });
      }
    });

    const heatmap = DICE_COLORS.map(col => {
      const cnt = counts[col] || 0;
      const pct = totalDice > 0 ? Math.round((cnt / totalDice) * 1000) / 10 : 16.6;
      return {
        color: col,
        hex: COLOR_CONFIG[col]?.hex || '#94a3b8',
        count: cnt,
        percentage: pct
      };
    }).sort((a, b) => b.percentage - a.percentage);

    // 3. Active Streamers Pool
    const activeStreamers = [...new Set([
      ...rolls.map(r => r.username).filter(u => u && u.length > 2),
      ...KNOWN_STREAMERS
    ])].slice(0, 10);

    // 4. Return Everything in One Master Payload
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      success: true,
      service: 'SAB ORACLE 99% — ALL-IN-ONE MASTER ENGINE',
      version: '4.3.0',
      timestamp: new Date().toISOString(),

      // CURRENT LATEST ROLL & DETAILS
      latestRoll: {
        rollId: topRoll.rollId,
        username: topRoll.username || 'Anonymous',
        colors: topRoll.colors,
        pattern: calculatePattern(topRoll.colors),
        createdAt: topRoll.createdAt,
        userRollCount: topRoll.userRollCount || 0
      },

      // 🎯 99% NEXT ROLL PREDICTION
      nextRollPrediction: {
        targetColor: prediction.sniper.color,
        hex: prediction.sniper.hex,
        pips: prediction.sniper.pips,
        confidence: prediction.sniper.confidence,
        probabilityPercent: prediction.sniper.probabilityPercent,
        callAction: prediction.sniper.callAction,
        secondaryColor: prediction.secondary.color,
        secondaryPercent: prediction.secondary.probabilityPercent,
        coldAvoidColor: prediction.coldColor.color,
        patternForecast: prediction.patternForecast,
        reasoning: prediction.reasoning,
        strategy: prediction.recommendations
      },

      // ALL 6 COLORS PROBABILITY MATRIX
      colorProbabilities: prediction.allProbabilities,

      // LIVE COLOR HEATMAP
      heatmap: {
        totalDiceObserved: totalDice,
        distribution: heatmap
      },

      // LIVE ROLLS STREAM ARRAY
      totalRolls: rolls.length,
      rolls: rolls.slice(0, 25),

      // ACTIVE TARGET STREAMERS
      streamers: activeStreamers,

      // LICENSE METADATA
      license: {
        client: auth.client || 'Owner',
        tier: auth.tier || 'admin',
        rateLimit: auth.rateLimitPerMin === Infinity ? 'UNLIMITED' : `${auth.rateLimitPerMin}/min`
      }
    }, null, 2));

  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      success: false,
      error: 'Failed to generate all-in-one oracle payload',
      details: err.message
    }));
  }
};
