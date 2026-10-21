/**
 * SAB ORACLE 99% — LIVE SABDICE CONNECTOR & STREAM DISPATCHER
 * High-performance cached roll retriever & real-time EventEmitter
 */

const https = require('https');
const EventEmitter = require('events');

class SabRollStreamer extends EventEmitter {
  constructor() {
    super();
    this.latestRolls = [];
    this.lastSeenRollId = null;
    this.pollingInterval = null;
    this.isPolling = false;
  }

  fetchJson(path) {
    return new Promise((resolve, reject) => {
      const targetUrl = `https://sabdice.com${path}`;
      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://sabdice.com/'
        },
        timeout: 6000
      };

      const req = https.get(targetUrl, options, res => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ ok: true, status: res.statusCode, data: JSON.parse(data) });
            } else {
              resolve({ ok: false, status: res.statusCode, error: data.slice(0, 300) });
            }
          } catch (e) {
            resolve({ ok: false, status: res.statusCode, error: 'JSON parse error', raw: data.slice(0, 200) });
          }
        });
      });

      req.on('error', err => {
        resolve({ ok: false, status: 502, error: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, status: 504, error: 'Connection to sabdice timed out' });
      });
    });
  }

  async getPublicRolls(limit = 50) {
    const res = await this.fetchJson(`/api/rolls/public?limit=${Math.min(limit, 100)}`);
    if (res.ok && Array.isArray(res.data)) {
      this.processNewRolls(res.data);
      return res.data;
    }
    return this.latestRolls.length ? this.latestRolls : [];
  }

  async verifyRoll(rollId) {
    const cleanId = encodeURIComponent(rollId.trim().toUpperCase());
    return await this.fetchJson(`/api/rolls/verify/${cleanId}`);
  }

  async getUserRolls(playerIdOrUsername) {
    const clean = encodeURIComponent(playerIdOrUsername.trim());
    // Try user verify endpoint first if SAB-U
    if (clean.toUpperCase().startsWith('SAB')) {
      return await this.fetchJson(`/api/rolls/users/${clean}`);
    }
    // Else query public rolls with search
    return await this.fetchJson(`/api/rolls/public?limit=100&q=${clean}`);
  }

  processNewRolls(rolls) {
    if (!rolls || !rolls.length) return;
    this.latestRolls = rolls;

    if (!this.lastSeenRollId) {
      this.lastSeenRollId = rolls[0].rollId;
      return;
    }

    // Find new rolls since last check
    const newItems = [];
    for (const roll of rolls) {
      if (roll.rollId === this.lastSeenRollId) break;
      newItems.push(roll);
    }

    if (newItems.length > 0) {
      this.lastSeenRollId = rolls[0].rollId;
      // Emit in chronological order
      for (let i = newItems.length - 1; i >= 0; i--) {
        this.emit('new_roll', newItems[i]);
      }
    }
  }

  startBackgroundSync(intervalMs = 2500) {
    if (this.isPolling) return;
    this.isPolling = true;

    // Fetch initial
    this.getPublicRolls(50);

    this.pollingInterval = setInterval(async () => {
      try {
        await this.getPublicRolls(50);
      } catch (err) {
        // Silent catch for resilience
      }
    }, intervalMs);
  }

  stopBackgroundSync() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
  }
}

// Singleton instance
const sabStreamer = new SabRollStreamer();

module.exports = {
  sabStreamer,
  SabRollStreamer
};
