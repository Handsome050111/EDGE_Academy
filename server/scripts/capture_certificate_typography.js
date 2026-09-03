const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });

  try {
    // Go to verification page for an existing certificate
    await page.goto('http://localhost:5173/verify/TNX-2026-EEA-04', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));

    const screenshotPath = path.join(__dirname, '..', '..', 'client', 'public', 'certificate_inter_typography.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log('Certificate screenshot saved to:', screenshotPath);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
})();
