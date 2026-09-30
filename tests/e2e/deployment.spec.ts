import { expect, test } from '@playwright/test';

const siteUrl = process.env.PAGES_URL;
test('original audio plays from the published subpath with its permission notice', async ({ page }) => {
  test.skip(!siteUrl, 'Set PAGES_URL to test a Pages build');
  await page.goto(siteUrl!);
  const audioRequests: string[] = [];
  page.on('request', request => { if (request.url().endsWith('.mp3')) audioRequests.push(request.url()); });
  await page.getByRole('textbox', { name: 'Cantonese text' }).fill('你好');
  expect(audioRequests).toEqual([]);
  const nativeAudio = await page.evaluate(() => typeof AudioContext !== 'undefined');
  test.skip(!nativeAudio, 'This browser build lacks Web Audio; real MP3 decoding requires a native audio implementation');
  // Decode actual shipped MP3s rather than the silence fixtures used by UI tests.
  const durations = await page.evaluate(async base => {
    const context = new AudioContext();
    try {
      return await Promise.all(['nei5', 'hou2'].map(async reading => {
        const response = await fetch(new URL(`audio/wordshk-202207/${reading}.mp3`, base));
        if (!response.ok) throw new Error('Recording could not load');
        return (await context.decodeAudioData(await response.arrayBuffer())).duration;
      }));
    } finally { await context.close(); }
  }, siteUrl!);
  expect(durations.every(duration => duration > 0)).toBe(true);
  audioRequests.length = 0;
  await page.getByRole('button', { name: 'Read aloud', exact: true }).click();
  await expect.poll(() => audioRequests.length).toBe(2);
  await expect(page.getByRole('button', { name: 'Read aloud', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(audioRequests.sort()).toEqual(['hou2', 'nei5'].map(reading =>
    new URL(`audio/wordshk-202207/${reading}.mp3`, siteUrl!).href).sort());
  await page.getByRole('link', { name: /Audio:.*Indicum Lam/ }).click();
  await expect(page).toHaveURL(new URL('audio-permission.txt', siteUrl!).href);
  await expect(page.locator('body')).toContainText('Non-commercial use only.');
});

test('published subpath loads text, theme switch and local photo recognition', async ({ page, context }) => {
  test.skip(!siteUrl, 'Set PAGES_URL to test a local or published Pages build');
  test.setTimeout(180_000);
  const site = new URL(siteUrl!);
  const requests: string[] = [];
  const failures: string[] = [];
  const errors: string[] = [];
  context.on('request', request => {
    if (request.url().startsWith('http')) requests.push(request.url());
  });
  context.on('response', response => {
    if (response.status() >= 400) failures.push(response.status() + ' ' + response.url());
  });
  context.on('requestfailed', request => failures.push(request.url()));
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto(site.href);
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(245, 241, 231)');
  await page.getByRole('textbox', { name: 'Cantonese text' }).fill('銀行');
  await expect(page.getByText('hong4', { exact: true })).toBeVisible();
  const theme = page.getByRole('switch', { name: 'Dark mode', exact: true });
  await expect(theme).not.toBeChecked();
  await theme.focus();
  await page.keyboard.press('Space');
  await expect(theme).toBeChecked();
  await expect(theme.locator('span')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 36, 0)');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(20, 37, 29)');
  await page.getByRole('button', { name: 'Read a photo', exact: true }).click();
  await page.getByLabel('Choose an image', { exact: true }).setInputFiles('tests/fixtures/menu-clean.png');
  await page.getByRole('button', { name: 'Read whole image', exact: true }).click();
  const reading = page.getByRole('region', { name: 'Photo reading' });
  await expect(reading.getByText('ngau4', { exact: true })).toBeVisible({ timeout: 150_000 });
  await expect(reading.getByText('min6', { exact: true })).toBeVisible();
  for (const file of ['PP-OCRv5_mobile_det.tar', 'PP-OCRv5_mobile_rec.tar', 'ort-wasm-simd-threaded.jsep.wasm']) {
    expect(requests.some(url => url.includes(file)), file + ' was loaded').toBe(true);
  }
  expect(requests.every(url => {
    const request = new URL(url);
    return request.origin === site.origin && request.pathname.startsWith(site.pathname);
  }), 'All app and OCR requests stay inside the published subpath').toBe(true);
  expect(failures).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('deployed-photo-reading.png'), fullPage: true });
});
