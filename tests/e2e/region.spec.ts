import { expect, test } from '@playwright/test';
import path from 'node:path';

test('reads highlighted lines and excludes text between them', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Read a photo', exact: true }).click();
  await expect(page.getByLabel('Reader to try')).toHaveValue('paddle');
  await page.getByLabel('Choose an image', { exact: true }).setInputFiles(path.resolve('tests/fixtures/menu-clean.png'));
  const image = page.getByRole('img', { name: 'Selected photo prepared for reading' });
  await expect(image).toBeVisible();
  const read = page.getByRole('button', { name: 'Read highlighted text', exact: true });
  await expect(read).toBeDisabled();
  expect(page.workers()).toHaveLength(0);
  await image.scrollIntoViewIfNeeded();
  const bounds = (await image.boundingBox())!;
  for (const line of [.2, .7]) {
    await page.mouse.move(bounds.x + bounds.width * .075, bounds.y + bounds.height * line);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * .285, bounds.y + bounds.height * line, { steps: 8 });
    await page.mouse.up();
  }
  await read.click();
  const reading = page.getByRole('region', { name: 'Photo reading' });
  await expect(reading.getByText('ngau4', { exact: true })).toBeVisible({ timeout: 90_000 });
  await expect(reading.getByText('min6', { exact: true })).toBeVisible();
  await expect(reading.getByText('旺', { exact: true })).toBeVisible();
  await expect(reading.getByText('咖', { exact: true })).toHaveCount(0);
  await expect(reading.getByText('啡', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('highlighted-lines.png'), fullPage: true });
  await page.getByRole('button', { name: 'This reading is usable' }).click();
  await page.getByRole('button', { name: 'Undo highlight', exact: true }).click();
  await expect(reading).toHaveCount(0);
  await read.click();
  await expect(reading.getByText('ngau4', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(reading.getByText('旺', { exact: true })).toHaveCount(0);
  await page.getByText('Scan details', { exact: true }).click();
  await expect(page.getByText(/already loaded/)).toBeVisible();
  await expect(page.getByText(/Photo selection is excluded/)).toBeVisible();
  await page.getByRole('button', { name: 'Clear highlights', exact: true }).click();
  await expect(reading).toHaveCount(0);
  await expect(read).toBeDisabled();
  await page.getByRole('button', { name: 'Read whole image', exact: true }).click();
  await expect(reading.getByText('咖', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(reading.getByText('旺', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);

});

test('can highlight with a keyboard and undo or clear the selection', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Read a photo', exact: true }).click();
  await page.getByLabel('Choose an image', { exact: true }).setInputFiles(path.resolve('tests/fixtures/menu-clean.png'));
  const canvas = page.getByRole('group', { name: 'Highlight text in photo' });
  await canvas.focus();
  await canvas.press('Space');
  await canvas.press('ArrowLeft');
  await canvas.press('Space');
  await expect(page.getByRole('button', { name: 'Read highlighted text', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Undo highlight', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Read highlighted text', exact: true })).toBeDisabled();
  await canvas.focus();
  await canvas.press('Space');
  await canvas.press('Space');
  await page.getByRole('button', { name: 'Clear highlights', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Read highlighted text', exact: true })).toBeDisabled();
  expect(page.workers()).toHaveLength(0);
});

test('a touch can highlight a character before scanning', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Touch input is checked in the mobile WebKit project.');
  await page.goto('/');
  await page.getByRole('button', { name: 'Read a photo', exact: true }).click();
  await page.getByLabel('Choose an image', { exact: true }).setInputFiles(path.resolve('tests/fixtures/menu-clean.png'));
  const image = page.getByRole('img', { name: 'Selected photo prepared for reading' });
  await image.scrollIntoViewIfNeeded();
  const bounds = (await image.boundingBox())!;
  await page.touchscreen.tap(bounds.x + bounds.width * .1, bounds.y + bounds.height * .2);
  await expect(page.getByRole('button', { name: 'Read highlighted text', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Undo highlight', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Read highlighted text', exact: true })).toBeDisabled();
});
