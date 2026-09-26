import { expect, test } from '@playwright/test';

test('reads text, inspects alternatives with keyboard, and resets without persistence', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Cantonese text' });
  await expect(input).toBeEmpty();
  await input.fill('銀行 行路\nCoffee $28');
  const output = page.getByRole('region', { name: 'Jyutping' });
  await expect(output.getByText('hong4', { exact: true })).toBeVisible();
  await expect(output.getByText('haang4', { exact: true })).toBeVisible();
  const trigger = page.getByRole('button', { name: '行, hong4. View other readings' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Readings for 行' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('haang4', { exact: true })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close pronunciation details' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(input).toHaveValue('銀行 行路\nCoffee $28');
  await page.getByRole('button', { name: 'Clear text' }).click();
  await expect(input).toBeEmpty();
  await expect(output.getByText('hong4', { exact: true })).toHaveCount(0);
  await input.fill('咖啡');
  await page.reload();
  await expect(input).toBeEmpty();
  expect(errors).toEqual([]);
});

test('handles missing readings and touch dismissal', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Cantonese text' }).fill('𠀀');
  await page.getByRole('button', { name: '𠀀. No pronunciation found' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('No pronunciation found.', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close pronunciation details' }).click();
  await expect(dialog).not.toBeVisible();
});

test('wraps long readings without horizontal overflow and keeps readings beneath characters', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Cantonese text' }).fill('咖啡 牛肉麵 銀行 行路 旺角\n'.repeat(5) + 'Coffee $28 👩🏽‍💻');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  const character = page.getByRole('button', { name: '咖, gaa3. View other readings' }).first();
  const base = await character.locator('span').nth(0).boundingBox();
  const reading = await character.locator('span').nth(1).boundingBox();
  expect(base).not.toBeNull();
  expect(reading).not.toBeNull();
  expect(reading!.y).toBeGreaterThan(base!.y);
  expect(Math.abs((base!.x + base!.width / 2) - (reading!.x + reading!.width / 2))).toBeLessThan(2);
});

test('converts after initial load without making network requests or using app storage', async ({ page }) => {
  const requests: string[] = [];
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.context().setOffline(true);
  page.on('request', request => requests.push(request.url()));
  await page.getByRole('textbox', { name: 'Cantonese text' }).fill('咖啡 Coffee $28');
  await expect(page.getByRole('region', { name: 'Jyutping' }).getByText('gaa3', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '咖, gaa3. View other readings' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
});

test('preserves variation selectors and combining marks inside the displayed character', async ({ page }) => {
  await page.goto('/');
  const characters = ['神\uFE00', '神\u{E0100}', '神\u0301'];
  await page.getByRole('textbox', { name: 'Cantonese text' }).fill(characters.join(' '));
  const output = page.getByRole('region', { name: 'Jyutping' });
  for (const character of characters) {
    await expect(output.getByText(character, { exact: true })).toBeVisible();
  }
});
