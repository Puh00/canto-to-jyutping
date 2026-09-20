import { expect, test, type Locator, type Page } from '@playwright/test';

test('follows the system and remembers only explicit appearance overrides', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const appearance = page.getByRole('combobox', { name: 'Appearance' });
  await expect(appearance).toHaveValue('system');
  const body = page.locator('body');
  await expect(body).toHaveCSS('background-color', 'rgb(21, 31, 26)');
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await page.getByRole('textbox', { name: 'Chinese text' }).fill('銀行');
  await expect(page.getByText('hong4', { exact: true })).toBeVisible();

  await page.emulateMedia({ colorScheme: 'light' });
  await expect(body).toHaveCSS('background-color', 'rgb(246, 245, 239)');
  await appearance.selectOption('dark');
  await expect(body).toHaveCSS('background-color', 'rgb(21, 31, 26)');
  await page.reload();
  await expect(appearance).toHaveValue('dark');
  await expect(body).toHaveCSS('background-color', 'rgb(21, 31, 26)');
  await expect(page.getByRole('textbox', { name: 'Chinese text' })).toBeEmpty();
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: sessionStorage.length })))
    .toEqual({ local: { 'canto-theme': 'dark' }, session: 0 });

  await appearance.selectOption('light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(body).toHaveCSS('background-color', 'rgb(246, 245, 239)');
  await page.reload();
  await expect(appearance).toHaveValue('light');
  await expect(body).toHaveCSS('background-color', 'rgb(246, 245, 239)');
  await appearance.selectOption('system');
  await expect(body).toHaveCSS('background-color', 'rgb(21, 31, 26)');
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(body).toHaveCSS('background-color', 'rgb(246, 245, 239)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

function contrast(foreground: string, background: string) {
  const luminance = (color: string) => {
    const [r, g, b] = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
      const channel = value / 255;
      return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    });
    if (r === undefined || g === undefined || b === undefined) throw new Error('Expected an RGB color: ' + color);
    return .2126 * r + .7152 * g + .0722 * b;
  };
  const front = luminance(foreground), back = luminance(background);
  return (Math.max(front, back) + .05) / (Math.min(front, back) + .05);
}

async function expectReadable(locator: Locator) {
  const colors = await locator.evaluate(element => {
    let parent: Element | null = element;
    let background = 'rgba(0, 0, 0, 0)';
    while (parent && background === 'rgba(0, 0, 0, 0)') {
      background = getComputedStyle(parent).backgroundColor;
      parent = parent.parentElement;
    }
    return { foreground: getComputedStyle(element).color, background };
  });
  expect(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5);
}

test('appearance still changes when browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    for (const method of ['getItem', 'setItem', 'removeItem']) {
      Object.defineProperty(Storage.prototype, method, { value: () => { throw new DOMException('Storage denied', 'SecurityError'); } });
    }
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const appearance = page.getByRole('combobox', { name: 'Appearance' });
  await appearance.selectOption('dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(21, 31, 26)');
  await appearance.selectOption('system');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(246, 245, 239)');
  await page.getByRole('textbox', { name: 'Chinese text' }).fill('銀行');
  await expect(page.getByText('hong4', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

async function photoPixels(page: Page, image: Locator) {
  // Clip inside the image. Fractional bounds can include one row of the themed page beneath it.
  const clip = await image.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const x = Math.ceil(rect.left + scrollX) + 1;
    const y = Math.ceil(rect.top + scrollY) + 1;
    return { x, y, width: Math.floor(rect.right + scrollX) - x - 1, height: Math.floor(rect.bottom + scrollY) - y - 1 };
  });
  return page.screenshot({ fullPage: true, clip });
}

test('both themes keep readings legible and photo colors and highlights intact', async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const appearance = page.getByRole('combobox', { name: 'Appearance' });
  await page.getByRole('textbox', { name: 'Chinese text' }).fill('銀行');
  for (const theme of ['light', 'dark']) {
    await appearance.selectOption(theme);
    await appearance.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(appearance).toBeFocused();
    await expect(appearance).toHaveCSS('outline-style', 'solid');
    const focusColors = await appearance.evaluate(element => ({
      outline: getComputedStyle(element).outlineColor,
      background: getComputedStyle(document.body).backgroundColor,
    }));
    expect(contrast(focusColors.outline, focusColors.background)).toBeGreaterThanOrEqual(3);
    await expectReadable(appearance);
    await expectReadable(page.getByText('hong4', { exact: true }));
    await expectReadable(page.getByText('Some characters have multiple readings. Suggested pronunciations may be incorrect.'));
    await page.getByRole('button', { name: '行, hong4. View other readings' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expectReadable(dialog.getByText('haang4', { exact: true }));
    await expectReadable(dialog.getByText(/These readings may belong/));
    await page.screenshot({ path: test.info().outputPath('dialog-' + theme + '.png'), fullPage: true });
    await dialog.getByRole('button', { name: 'Close pronunciation details' }).click();
    await page.screenshot({ path: test.info().outputPath('text-' + theme + '.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  }

  await page.getByRole('button', { name: 'Read a photo', exact: true }).click();
  const picker = page.getByLabel('Choose an image', { exact: true });
  await picker.setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('broken') });
  await expect(page.getByRole('alert')).toBeVisible();
  for (const theme of ['light', 'dark']) {
    await appearance.selectOption(theme);
    await expectReadable(page.getByRole('alert'));
    await expectReadable(page.getByText('Choose an image', { exact: true }));
  }

  await picker.setInputFiles('tests/fixtures/menu-clean.png');
  const image = page.getByRole('img', { name: 'Selected photo prepared for reading' });
  await expect(image).toBeVisible();
  const darkPhoto = await photoPixels(page, image);
  await appearance.selectOption('light');
  expect((await photoPixels(page, image)).equals(darkPhoto)).toBe(true);
  await appearance.selectOption('dark');
  await image.scrollIntoViewIfNeeded();
  const bounds = (await image.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width * .075, bounds.y + bounds.height * .2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * .285, bounds.y + bounds.height * .2, { steps: 8 });
  await page.mouse.up();
  const darkHighlight = await photoPixels(page, image);
  await appearance.selectOption('light');
  expect((await photoPixels(page, image)).equals(darkHighlight)).toBe(true);
  await appearance.selectOption('dark');
  await page.getByRole('button', { name: 'Read highlighted text', exact: true }).click();
  const reading = page.getByRole('region', { name: 'Photo reading' });
  await expect(reading.getByText('ngau4', { exact: true })).toBeVisible({ timeout: 90_000 });
  await expect(reading.getByText('min6', { exact: true })).toBeVisible();
  await expect(reading.getByText('咖', { exact: true })).toHaveCount(0);
  await expectReadable(reading.getByText('ngau4', { exact: true }));
  await page.screenshot({ path: test.info().outputPath('photo-dark.png'), fullPage: true });
  await appearance.selectOption('light');
  await expect(reading.getByText('ngau4', { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('photo-light.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('transparent photos retain their colors when appearance changes', async ({ page }) => {
  await page.goto('/');
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 400; canvas.height = 200;
    const context = canvas.getContext('2d')!;
    context.font = '40px sans-serif';
    context.fillText('牛肉麵', 30, 70);
    context.fillStyle = '#e03030'; context.fillRect(30, 100, 70, 50);
    context.fillStyle = '#30a050'; context.fillRect(130, 100, 70, 50);
    context.fillStyle = '#3060d0'; context.fillRect(230, 100, 70, 50);
    return canvas.toDataURL('image/png').split(',')[1]!;
  });
  const appearance = page.getByRole('combobox', { name: 'Appearance' });
  await appearance.selectOption('dark');
  await page.getByRole('button', { name: 'Read a photo', exact: true }).click();
  await page.getByLabel('Choose an image', { exact: true }).setInputFiles({
    name: 'transparent.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64'),
  });
  const image = page.getByRole('img', { name: 'Selected photo prepared for reading' });
  await expect(image).toBeVisible();
  const darkPhoto = await photoPixels(page, image);
  await appearance.selectOption('light');
  expect((await photoPixels(page, image)).equals(darkPhoto)).toBe(true);
  const stage = page.getByRole('group', { name: 'Highlight text in photo' });
  await stage.press('+');
  const lightZoom = await photoPixels(page, stage);
  await appearance.selectOption('dark');
  expect((await photoPixels(page, stage)).equals(lightZoom)).toBe(true);
});
