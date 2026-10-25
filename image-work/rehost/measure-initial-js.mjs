// Compare initial JS transfer: deployed (www) vs local build (3100). Pure fetch.
const ORIGINS = [['DEPLOYED (www)', 'https://www.stylesence.com'], ['NEW BUILD (3100)', 'http://localhost:3100']];

for (const [label, base] of ORIGINS) {
  const html = await (await fetch(base + '/')).text();
  const scripts = [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[a-zA-Z0-9_-]*\.js/g)].map((m) => m[0]))];
  let total = 0;
  const rows = [];
  await Promise.all(scripts.map(async (s) => {
    const r = await fetch(base + s, { headers: { 'Accept-Encoding': 'gzip' } });
    const buf = await r.arrayBuffer();
    total += buf.byteLength;
    rows.push([Math.round(buf.byteLength / 1024) + ' KB', s.split('/').pop(), r.status]);
  }));
  rows.sort((a, b) => parseInt(b[0]) - parseInt(a[0]));
  console.log(`\n=== ${label}: ${scripts.length} scripts, ${Math.round(total / 1024)} KB compressed total`);
  rows.slice(0, 6).forEach((r) => console.log('  ', r[0], `(${r[2]})`, r[1]));
}
