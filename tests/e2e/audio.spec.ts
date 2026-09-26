import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';
import { supportMissingWebAudio } from '../fixtures/web-audio';

test.beforeEach(async ({ page }, info) => { await supportMissingWebAudio(page, info); });

// Generated PCM silence exercises real browser decoding/playback without external assets.
function audioFixture(seconds = 1) {
  const samples = Math.round(8000 * seconds);
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(8000, 24); buffer.writeUInt32LE(16000, 28); buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40);
  return buffer;
}
async function stubAudio(page: Page) {
  const requests: string[] = [];
  await page.route('https://raw.githubusercontent.com/**/jyutping_female/*.mp3', async route => {
    requests.push(route.request().url());
    await route.fulfill({ contentType: 'audio/wav', headers: { 'access-control-allow-origin': '*' }, body: audioFixture() });
  });
  return requests;
}

test('plays occurrences in order, pauses the current character, and finishes without moving focus', async ({ page }) => {
  const requests = await stubAudio(page);
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Cantonese text' }).fill('你好你');
  expect(requests).toHaveLength(0);
  const output = page.getByRole('region', { name: 'Jyutping' });
  const tokens = output.locator('[lang="yue-Latn"]');
  const controls = page.getByRole('group', { name: 'Audio playback' });
  const primary = controls.getByRole('button').first();
  const stop = controls.getByRole('button', { name: 'Stop', exact: true });
  await expect(stop).toBeDisabled();
  const initialBox = await controls.boundingBox();
  for (const button of [primary, stop]) {
    const box = await button.boundingBox();
    expect(box!.width).toBe(44);
    expect(box!.height).toBe(44);
  }
  await primary.focus();
  await page.keyboard.press('Enter');
  await expect(tokens.nth(0).locator('..')).toHaveAttribute('data-playing', 'true');
  await expect(primary).toBeFocused();
  await expect(primary).toHaveAttribute('title', 'Pause');
  await expect(stop).toBeEnabled();
  await page.keyboard.press('Space');
  await expect(primary).toHaveAccessibleName('Resume');
  await expect(primary).toBeFocused();
  await page.waitForTimeout(1200);
  await expect(tokens.nth(0).locator('..')).toHaveAttribute('data-playing', 'true');
  await page.keyboard.press('Enter');
  await expect(tokens.nth(1).locator('..')).toHaveAttribute('data-playing', 'true');
  await expect(tokens.nth(2).locator('..')).toHaveAttribute('data-playing', 'true');
  await expect(page.getByRole('button', { name: 'Read aloud', exact: true })).toBeVisible();
  await expect(primary).toBeFocused();
  await expect(stop).toBeDisabled();
  expect(await controls.boundingBox()).toEqual(initialBox);
  await expect(output.locator('[data-playing]')).toHaveCount(0);
  expect(requests).toHaveLength(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('stops on edits, mode changes and pronunciation inspection; disables unsupported text', async ({ page }) => {
  await stubAudio(page);
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Cantonese text' });
  const play = page.getByRole('button', { name: 'Read aloud', exact: true });
  await input.fill('銀行行行');
  await play.click(); await expect(page.locator('[data-playing]')).toHaveCount(1);
  await page.getByRole('button', { name: '行, hong4. View other readings', exact: true }).first().click();
  await expect(page.locator('[data-playing]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Close pronunciation details' }).click();
  await play.click(); await expect(page.locator('[data-playing]')).toHaveCount(1);
  await input.fill('你好');
  await expect(play).toBeVisible(); await expect(page.locator('[data-playing]')).toHaveCount(0);
  await play.click(); await expect(page.locator('[data-playing]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Read a photo', exact: true }).click();
  await expect(page.locator('[data-playing]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Read text', exact: true }).click();
  await expect(play).toBeVisible();
  await input.fill('𠀀 Coffee 28');
  await expect(play).toBeDisabled();
  await expect(page.getByText('1 Chinese character has no audio and will be skipped.')).toBeVisible();
});

test('reports a failed audio request and retries without stale highlights', async ({ page }) => {
  let fail = true;
  await page.route('https://raw.githubusercontent.com/**/jyutping_female/*.mp3', route => route.fulfill({
    status: fail ? 503 : 200, contentType: 'audio/wav', headers: { 'access-control-allow-origin': '*' }, body: fail ? '' : audioFixture(),
  }));
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Cantonese text' }).fill('你');
  await page.getByRole('button', { name: 'Read aloud', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Audio could not play');
  await expect(page.locator('[data-playing]')).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Read aloud', exact: true }).click();
  await expect(page.locator('[data-playing]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.locator('[data-playing]')).toHaveCount(0);
});

test('explains unsupported audio without attempting network access', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true }); });
  const requests = await stubAudio(page);
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Cantonese text' }).fill('你');
  await page.getByRole('button', { name: 'Read aloud', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('not supported in this browser');
  expect(requests).toHaveLength(0);
});

test('photo playback highlights transcription and stops when editing the photo', async ({ page }) => {
  test.setTimeout(120_000);
  await stubAudio(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Read a photo', exact: true }).click();
  await page.getByLabel('Choose an image', { exact: true }).setInputFiles(path.resolve('tests/fixtures/menu-clean.png'));
  await page.getByRole('button', { name: 'Read whole image', exact: true }).click();
  const reading = page.getByRole('region', { name: 'Photo reading' });
  const play = reading.getByRole('button', { name: 'Read aloud', exact: true });
  await expect(play).toBeVisible({ timeout: 90_000 });
  await play.click();
  await expect(reading.locator('[data-playing]')).toHaveCount(1);
  const active = await reading.locator('[data-playing]').boundingBox();
  const preview = await page.getByRole('button', { name: 'Edit highlights in photo' }).boundingBox();
  if (active && preview && active.x < preview.x + preview.width && active.x + active.width > preview.x) {
    expect(active.y).toBeGreaterThanOrEqual(preview.y + preview.height);
  }
  const character = reading.getByRole('button', { name: 'Play pronunciation' }).first();
  await character.click();
  await expect(character.locator('..')).toHaveAttribute('data-playing', 'true');
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: `.scratch/photo-tap-${test.info().project.name}-${colorScheme}.png` });
  }
  await page.getByRole('button', { name: 'Edit highlights in photo' }).click();
  await expect(page.getByRole('dialog', { name: 'Highlight the text' })).toBeVisible();
  await expect(reading.locator('[data-playing]')).toHaveCount(0);
});

test('character targets replace playing and paused sequences; alternatives remain independent', async ({ page }) => {
  await stubAudio(page);
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Cantonese text' });
  await input.fill('銀行你你');
  const output = page.getByRole('region', { name: 'Jyutping' });
  const character = output.getByRole('button', { name: '行, hong4. Play pronunciation', exact: true });
  const alternative = output.getByRole('button', { name: '行, hong4. View other readings', exact: true });
  for (const target of [character, alternative]) {
    const box = await target.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('button', { name: 'Read aloud', exact: true }).click();
  await expect(output.locator('[data-playing]')).toHaveCount(1);
  await character.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(character.locator('..')).toHaveAttribute('data-playing', 'true');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const repeated = output.getByRole('button', { name: '你, nei5. Play pronunciation', exact: true });
  await repeated.nth(1).click();
  await expect(repeated.nth(1).locator('..')).toHaveAttribute('data-playing', 'true');
  await repeated.nth(0).click();
  await repeated.nth(0).click();
  await expect(repeated.nth(0).locator('..')).toHaveAttribute('data-playing', 'true');
  await expect(page.getByRole('button', { name: 'Read aloud', exact: true })).toBeVisible();
  await expect(output.locator('[data-playing]')).toHaveCount(0);
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.screenshot({ path: `.scratch/text-tap-${test.info().project.name}-${colorScheme}.png` });
  }
  await alternative.click();
  const dialog = page.getByRole('dialog');
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'hong4. Play pronunciation', exact: true })).toBeFocused();
  const sound = dialog.getByRole('button', { name: 'haang4. Play pronunciation', exact: true });
  await sound.click();
  await expect(sound).toHaveAttribute('data-audio-playing', 'true');
  await expect(output.locator('[data-playing]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(alternative).toBeFocused();
  await expect(page.getByRole('button', { name: 'Read aloud', exact: true })).toBeVisible();
  await expect(input).toHaveValue('銀行你你');
});

test('single character and dialog failures can be retried', async ({ page }) => {
  let fail = true;
  await page.route('https://raw.githubusercontent.com/**/jyutping_female/*.mp3', route => route.fulfill({
    status: fail ? 503 : 200, contentType: 'audio/wav', body: fail ? '' : audioFixture(),
  }));
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Cantonese text' }).fill('銀行𠀀');
  await expect(page.getByRole('button', { name: '𠀀. Audio unavailable' })).toBeDisabled();
  const character = page.getByRole('button', { name: '行, hong4. Play pronunciation', exact: true });
  await character.click();
  await expect(page.getByRole('alert')).toContainText('Audio could not play');
  fail = false;
  await character.click();
  await expect(character.locator('..')).toHaveAttribute('data-playing', 'true');
  await page.getByRole('button', { name: '行, hong4. View other readings', exact: true }).click();
  fail = true;
  const dialog = page.getByRole('dialog');
  const alternative = dialog.getByRole('button', { name: 'haang4. Play pronunciation', exact: true });
  await alternative.click();
  await expect(dialog.getByRole('alert')).toContainText('Audio could not play');
  fail = false;
  await alternative.click();
  await expect(alternative).toHaveAttribute('data-audio-playing', 'true');
});
