const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1200 });

  try {
    const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'eng.a2.e2e@technonex.de',
        password: 'Password123!',
      }),
    });
    const authData = await loginRes.json();

    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await page.evaluate((data) => {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data));
    }, authData);

    await page.goto('http://localhost:5173/engineer', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 2000));

    // Scroll slightly down
    await page.evaluate(() => {
      const main = document.querySelector('main');
      if (main) main.scrollTop = 350;
    });
    await new Promise((r) => setTimeout(r, 500));

    const screenshotDir = path.join(__dirname, '..', '..', 'client', 'public');
    const screenshotPath = path.join(screenshotDir, 'engineer_dashboard_locked_quiz.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log('Locked quiz screenshot saved to:', screenshotPath);
  } catch (err) {
    console.error('Error during screenshot capture:', err);
  } finally {
    await browser.close();
  }
})();
