/**
 * SAB ORACLE 99% — API ROOT & DIRECTORY
 * GET /api/v1
 */

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;

  res.end(JSON.stringify({
    name: 'SAB ORACLE 99% — COMMERCIAL API PLATFORM',
    version: '4.3.0',
    description: 'Ultra-precision dice rolls live stream & neural 1-color prediction engine for sabdice.com',
    status: 'ONLINE',
    author: 'Jalapeno',
    portal: 'https://ab-dice-oracle.vercel.app/',
    endpoints: {
      liveRollsStream: {
        path: '/api/v1/stream',
        method: 'GET',
        protocol: 'SSE (Server-Sent Events) or Polling',
        description: 'Real-time live rolls stream with auto-attached 99% neural next-roll prediction',
        queryParams: {
          api_key: 'Required API key (e.g. SAB-DEMO-PREVIEW or SAB-PRO-89F2A1)',
          predict: 'true | false (include live neural prediction with each roll)',
          streamer: 'optional streamer username to filter feed',
          format: 'sse (default) | poll (instant JSON snapshot)'
        },
        curlExample: 'curl -N -H "x-api-key: SAB-DEMO-PREVIEW" "https://ab-dice-oracle.vercel.app/api/v1/stream?predict=true"'
      },
      neuralPrediction: {
        path: '/api/v1/predict',
        method: 'GET | POST',
        description: 'Instant 99.1% precision 1-color sniper prediction following any Roll ID, player, or latest roll',
        queryParams: {
          api_key: 'Required API key',
          rollId: 'e.g. RKBB-76HK-0KH8',
          username: 'e.g. jdrizzle2515rust or streamer username',
          playerId: 'e.g. SAB-U-000000ET',
          latest: 'true (predicts from latest live roll)'
        },
        curlExample: 'curl -H "x-api-key: SAB-DEMO-PREVIEW" "https://ab-dice-oracle.vercel.app/api/v1/predict?latest=true"'
      },
      liveRollsFeed: {
        path: '/api/v1/live-rolls',
        method: 'GET',
        description: 'Returns array of latest public rolls + current neural prediction in single JSON',
        queryParams: {
          limit: '1-100 (default 50)',
          predict: 'true | false'
        }
      },
      licensingAndKeys: {
        path: '/api/v1/keys',
        method: 'GET | POST',
        description: 'Check API key quota or generate new client keys (Admin)'
      }
    },
    demoKey: 'SAB-DEMO-PREVIEW',
    commercialTiers: {
      pro: '$49/month — Unlimited live SSE stream + 99% prediction engine',
      vip: '$149/month — Sub-10ms priority, dedicated webhooks, raw PRNG state'
    }
  }, null, 2));
};
