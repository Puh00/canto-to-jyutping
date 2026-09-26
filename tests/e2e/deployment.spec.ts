import { expect, test } from '@playwright/test';

const siteUrl = process.env.PAGES_URL;
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
