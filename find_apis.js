const fs = require('fs');
const code = fs.readFileSync('script_2.js', 'utf8');

// Look at the fetch call right before the "verify-back-btn"
const idx = code.indexOf('verify-back-btn');
const verifyCode = code.substring(Math.max(0, idx - 5000), idx + 2000);

// Look for fetch or api calls in verifyCode
const matches = verifyCode.match(/fetch\([^)]+\)|api\/[a-zA-Z0-9_\-\/]+/g) || [];
console.log('Matches near verify-back-btn:', matches);

// Search for /api/rolls or /api/verify or /api/player or /api/
const allApis = [...code.matchAll(/\/api\/[a-zA-Z0-9_\-\/]+/g)].map(m => m[0]);
console.log('All /api/ in entire script_2.js:', [...new Set(allApis)]);
