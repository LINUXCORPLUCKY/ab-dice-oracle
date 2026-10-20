const fs = require('fs');
const code = fs.readFileSync('script_2.js', 'utf8');

// Find occurrences around "verify-back-btn" and "verify"
const idx = code.indexOf('verify-back-btn');
if (idx !== -1) {
  console.log('--- AROUND verify-back-btn ---');
  console.log(code.substring(Math.max(0, idx - 1500), Math.min(code.length, idx + 1500)));
}

// Find route definitions or /verify
const vIdx = code.indexOf('/verify');
console.log('--- /verify index:', vIdx);
if (vIdx !== -1) {
  console.log(code.substring(Math.max(0, vIdx - 400), Math.min(code.length, vIdx + 600)));
}
