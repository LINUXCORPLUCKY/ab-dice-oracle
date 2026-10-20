const fs = require('fs');
const code = fs.readFileSync('script_2.js', 'utf8');

['/api/rolls/verify/', '/api/rolls/roll/', '/api/rolls/users/', '/api/rolls/public'].forEach(ep => {
  let idx = 0;
  console.log(`=== Matches for ${ep} ===`);
  while ((idx = code.indexOf(ep, idx)) !== -1) {
    console.log(code.substring(Math.max(0, idx - 200), Math.min(code.length, idx + 400)));
    console.log('---------------------------');
    idx += ep.length;
  }
});
