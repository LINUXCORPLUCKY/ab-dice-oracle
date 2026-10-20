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
  const verifyRes = await fetchUrl('https://sabdice.com/api/rolls/verify/RKBB-76HK-0KH8');
  console.log('Verify RKBB-76HK-0KH8:', JSON.stringify(verifyRes, null, 2));

  const userRes = await fetchUrl('https://sabdice.com/api/rolls/users/73?limit=5');
  console.log('User 73 history:', JSON.stringify(userRes, null, 2)?.slice(0, 800));
}

test();
