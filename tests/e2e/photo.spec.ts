import { expect, test } from '@playwright/test';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';

const menu = path.resolve('tests/fixtures/menu-clean.png');
test('PaddleOCR reads a photo locally, reuses its worker without network, and disposes it on leaving', async ({ page, context }) => {
  test.setTimeout(120_000);
  const requests: { url: string; method: string; hasBody: boolean }[] = [];
  const responses: { url: string; bytes: number; encoding: string | null }[] = [];
  const pageErrors: string[] = [];
  context.on('request', request => {
    if (request.url().startsWith('http')) requests.push({ url: request.url(), method: request.method(), hasBody: request.postData() !== null });
  });
  context.on('response', response => {
    const headers = response.headers();
    responses.push({ url: response.url(), bytes: Number(headers['content-length'] ?? 0), encoding: headers['content-encoding'] ?? null });
  });
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/');
  expect(requests.some(request => /ocr\/|paddle\.worker|opencv/.test(request.url))).toBe(false);
  await page.getByRole('button', { name: 'Read a photo', exact: true }).click({ timeout: 5000 });
  const picker = page.getByLabel('Choose an image', { exact: true });
  await picker.setInputFiles(menu);
  await page.getByRole('button', { name: 'Read whole image', exact: true }).click();
  const reading = page.getByRole('region', { name: 'Photo reading' });
  await expect(reading.getByText('ngau4', { exact: true })).toBeVisible({ timeout: 90_000 });
  await expect(reading.getByText('min6', { exact: true })).toBeVisible();
  await expect(reading.getByRole('heading', { name: 'Photo reading' })).toBeFocused();
  await expect(page.getByRole('dialog', { name: 'Highlight the text' })).toBeHidden();
  expect(requests.every(request => request.method === 'GET' && !request.hasBody && new URL(request.url).origin === 'http://127.0.0.1:4173')).toBe(true);
  expect(requests.some(request => request.url.includes('jsep.wasm'))).toBe(true);
  expect(requests.some(request => request.url.includes('PP-OCRv5_mobile_rec.tar'))).toBe(true);
  await writeFile(test.info().outputPath('network.json'), JSON.stringify({ engine: 'paddle', browser: test.info().project.name, responses }, null, 2));
  await page.screenshot({ path: test.info().outputPath('photo-reading.png'), fullPage: true });
  // Windows WebKit's offline emulation blocks even File.arrayBuffer(). Block HTTP at its boundary instead.
  await context.route(url => ['http:', 'https:'].includes(url.protocol), route => route.abort('internetdisconnected'));
  const requestCount = requests.length;
  await picker.setInputFiles(menu);
  await page.getByRole('button', { name: 'Read whole image', exact: true }).click();
  await expect(reading.getByText('ngau4', { exact: true })).toBeVisible({ timeout: 30_000 });
  expect(requests).toHaveLength(requestCount);
  await page.getByRole('button', { name: 'New photo', exact: true }).click();
  await Promise.all([page.waitForEvent('filechooser'), picker.click()]);
  await picker.dispatchEvent('cancel');
  await expect(reading.getByText('ngau4', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Photo trial timing' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'This reading is usable' })).toHaveCount(0);

  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
  await page.getByRole('button', { name: 'Read text', exact: true }).click();
  await expect(reading).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Selected photo prepared for reading' })).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

for (const action of ['Cancel reading', 'Close photo editor']) {
test(`${action} during model initialization stops the worker and permits another photo`, async ({ page, context }) => {
  test.setTimeout(90_000);
  let started = false;
  let release!: () => void;
  const paused = new Promise<void>(resolve => { release = resolve; });
  await context.route('**/ocr/paddle/*.tar', async route => {
    started = true;
    await paused;
    await route.continue().catch(() => {});
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Read a photo', exact: true }).click();
  const picker = page.getByLabel('Choose an image', { exact: true });
  await picker.setInputFiles(menu);
  const brush = page.getByRole('button', { name: 'Brush size', exact: true });
  await brush.click();
  await expect(page.getByRole('slider', { name: 'Brush size', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Read whole image', exact: true }).click();
  await expect.poll(() => started).toBe(true);
  await expect(brush).toBeDisabled();
  await expect(brush).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('slider', { name: 'Brush size', exact: true })).toBeHidden();
  await page.getByRole('button', { name: action, exact: true }).click();
  if (action === 'Cancel reading') {
    await expect(page.getByRole('dialog', { name: 'Highlight the text' }).getByText('Reading canceled. You can adjust the area or choose another photo.')).toBeVisible();
  } else {
    await expect(page.getByRole('img', { name: 'Selected photo prepared for reading' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Continue editing', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Photo reading' })).toHaveCount(0);
  }
  await expect.poll(() => page.workers().length).toBe(0);
  release();
  await context.unroute('**/ocr/paddle/*.tar');
  if (action === 'Cancel reading') await page.getByRole('button', { name: 'Close photo editor' }).click();
  await picker.setInputFiles(menu);
  await page.getByRole('button', { name: 'Read whole image', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Photo reading' }).getByText('ngau4', { exact: true })).toBeVisible({ timeout: 45_000 });
  await page.getByRole('button', { name: 'Read text', exact: true }).click();
  await expect.poll(() => page.workers().length).toBe(0);
});
}

test('an unreadable image reports a recoverable error without starting OCR', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Read a photo', exact: true }).click();
  await page.getByLabel('Choose an image', { exact: true }).setInputFiles({
    name: 'broken.heic', mimeType: 'image/heic', buffer: Buffer.from('This is not a decodable image'),
  });
  await expect(page.getByRole('alert')).toContainText('This image could not be opened.');
  expect(page.workers()).toHaveLength(0);
  await expect(page.getByLabel('Choose an image', { exact: true })).toBeEnabled();
});


test('honors JPEG orientation when preparing the photo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Read a photo', exact: true }).click();
  await page.getByLabel('Choose an image', { exact: true }).setInputFiles(path.resolve('tests/fixtures/orientation-6.jpg'));
  const preview = page.getByRole('img', { name: 'Selected photo prepared for reading' });
  await expect(preview).toBeVisible();
  expect(await preview.evaluate(image => ({ width: (image as HTMLImageElement).naturalWidth, height: (image as HTMLImageElement).naturalHeight }))).toEqual({ width: 300, height: 600 });
  await page.getByRole('button', { name: 'Close photo editor' }).click();
  await page.getByRole('button', { name: 'Read text', exact: true }).click();
  await expect(preview).toHaveCount(0);
});


test('keeps entered text available when later photo scripts cannot download', async ({ page, context }) => {
  let block = false;
  await context.route('**/assets/*.js', route => block ? route.abort('failed') : route.continue());
  await page.goto('/');
  const text = page.getByRole('textbox', { name: 'Cantonese text' });
  await text.fill('銀行');
  block = true;
  await page.getByRole('button', { name: 'Read a photo', exact: true }).click();
  await expect(page.getByLabel('Choose an image', { exact: true })).toBeVisible();
  await page.getByLabel('Choose an image', { exact: true }).setInputFiles(menu);
  await page.getByRole('button', { name: 'Read whole image', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('The photo reader could not start.');
  await page.getByRole('button', { name: 'Close photo editor' }).click();
  await expect(page.getByRole('button', { name: 'Read text', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Read text', exact: true }).click();
  await expect(text).toHaveValue('銀行');
});
