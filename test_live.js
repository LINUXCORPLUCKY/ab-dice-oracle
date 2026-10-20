const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data.substring(0, 300) });
        }
      });
    }).on('error', reject);
  });
}

async function test() {
  console.log('Testing public rolls:');
  const pub = await fetchUrl('https://sabdice.com/api/rolls/public?limit=5');
  console.log('Public rolls status:', pub.status);
  console.log('Sample public roll:', JSON.stringify(pub.body, null, 2)?.slice(0, 800));

  console.log('\nTesting leaderboards:');
  const lb = await fetchUrl('https://sabdice.com/api/rolls/leaderboards');
  console.log('Leaderboards status:', lb.status);
  console.log('Leaderboards sample:', JSON.stringify(lb.body, null, 2)?.slice(0, 500));
}

test();
