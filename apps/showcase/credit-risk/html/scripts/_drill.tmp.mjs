import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'shell' });
for (const fw of ['react', 'astro', 'html', 'vue', 'angular', 'svelte']) {
  const p = await b.newPage();
  await p.setViewport({ width: 1400, height: 900 });
  await p.setCacheEnabled(false);
  await p.goto(`http://localhost:4323/showcase/credit-risk/${fw}/`, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 3000));
  const before = p.url();
  // Ask the chart to report a click on the third bar (Energy).
  await p.evaluate(() => {
    document.querySelector('md-bar-chart')
      ?.dispatchEvent(new CustomEvent('mdBarClick', { detail: { dataIndex: 2 }, bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 1200));
  const after = p.url();
  const clickable = await p.evaluate(() => document.querySelector('md-bar-chart')?.hasAttribute('clickable'));
  console.log(`${fw.padEnd(8)} clickable=${clickable ? 'yes' : 'NO '}  ${before === after ? 'DID NOT NAVIGATE' : '-> ' + after.replace('http://localhost:4323', '')}`);
  await p.close();
}
await b.close();
