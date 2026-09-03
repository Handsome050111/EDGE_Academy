const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 950 });

  try {
    const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin.e2e@technonex.de',
        password: 'Password123!',
      }),
    });
    const authData = await loginRes.json();

    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await page.evaluate((data) => {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data));
    }, authData);

    await page.goto('http://localhost:5173/admin', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));

    // Click on Certificate Governance tab
    const certTab = await page.waitForSelector('button[id*="certificates"], button:has-text("Certificate Governance"), [data-tab="certificates"]', { timeout: 4000 }).catch(() => null);
    
    // Find tab button by text or click tab 6
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const certBtn = buttons.find(b => b.textContent.includes('Certificate Governance'));
      if (certBtn) certBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1500));

    const screenshotPath = path.join(__dirname, '..', '..', 'client', 'public', 'admin_governance_side_by_side.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log('Admin Governance screenshot saved to:', screenshotPath);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
})();
