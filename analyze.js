const fs = require('fs');

try {
  const jsonRaw = fs.readFileSync('extracted_apis_1792512028828.json', 'utf8');
  const data = JSON.parse(jsonRaw);
  console.log('Page URL:', data.pageUrl);
  console.log('Page Title:', data.pageTitle);
  console.log('Total APIs captured:', data.apis?.length);
  const urls = data.apis?.map(a => `${a.method} ${a.url} (status: ${a.status})`);
  console.log('Distinct API URLs:', [...new Set(urls)]);
} catch (e) {
  console.log('JSON parse error:', e.message);
}

try {
  const code = fs.readFileSync('script_2.js', 'utf8');
  console.log('script_2.js size:', code.length);
  const terms = ['verify', 'roll', 'seed', 'nonce', 'sha512', 'sabdice', 'colour', 'color', 'history'];
  terms.forEach(term => {
    let idx = 0;
    let count = 0;
    let sample = '';
    while ((idx = code.toLowerCase().indexOf(term, idx)) !== -1) {
      count++;
      if (!sample) {
        sample = code.substring(Math.max(0, idx - 60), Math.min(code.length, idx + 80)).replace(/[\r\n]+/g, ' ');
      }
      idx += term.length;
    }
    console.log(`[${term}] count: ${count} | sample: ${sample}`);
  });
} catch (e) {
  console.log('script_2 error:', e.message);
}
