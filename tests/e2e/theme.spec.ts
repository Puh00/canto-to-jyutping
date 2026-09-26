import { expect, test, type Locator, type Page } from '@playwright/test';

async function setAppearance(page: Page, theme: string) {
  const toggle = page.getByRole('switch', { name: 'Dark mode', exact: true });
  if (await toggle.getAttribute('aria-checked') !== String(theme === 'dark')) await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', String(theme === 'dark'));
  await expect(toggle.locator('span')).toHaveCSS('transform', `matrix(1, 0, 0, 1, ${theme === 'dark' ? 36 : 0}, 0)`);
}

test('follows the system and remembers only explicit appearance overrides', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const appearance = page.getByRole('switch', { name: 'Dark mode', exact: true });
  await expect(appearance).toHaveAttribute('aria-checked', 'true');
  await expect(appearance).toHaveAttribute('title', 'Dark appearance (system). Switch to light');
  await expect(appearance.locator('circle')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Use system' })).toHaveCount(0);
  const body = page.locator('body');
  await expect(body).toHaveCSS('background-color', 'rgb(20, 37, 29)');
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await page.getByRole('textbox', { name: 'Chinese text' }).fill('銀行');
  await expect(page.getByText('hong4', { exact: true })).toBeVisible();

  await page.emulateMedia({ colorScheme: 'light' });
  await expect(body).toHaveCSS('background-color', 'rgb(245, 241, 231)');
  await expect(appearance).toHaveAttribute('aria-checked', 'false');
  await expect(appearance.locator('circle')).toHaveCount(1);
  await appearance.focus();
  await page.keyboard.press('Space');
  await expect(body).toHaveCSS('background-color', 'rgb(20, 37, 29)');
  await page.reload();
  await expect(appearance).toHaveAttribute('aria-checked', 'true');
  await expect(body).toHaveCSS('background-color', 'rgb(20, 37, 29)');
  await expect(page.getByRole('textbox', { name: 'Chinese text' })).toBeEmpty();
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: sessionStorage.length })))
    .toEqual({ local: { 'canto-theme': 'dark' }, session: 0 });

  await appearance.focus();
  await page.keyboard.press('Enter');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(body).toHaveCSS('background-color', 'rgb(245, 241, 231)');
  await page.reload();
  await expect(appearance).toHaveAttribute('aria-checked', 'false');
  await expect(body).toHaveCSS('background-color', 'rgb(245, 241, 231)');
  await expect(page.getByRole('button', { name: 'Use system' })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('canto-theme'))).toBe('light');
  await expect(appearance).toHaveAttribute('title', 'Light appearance. Switch to dark');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('switch thumb slides between states and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  await page.goto('/');
  const appearance = page.getByRole('switch', { name: 'Dark mode', exact: true });
  const thumb = appearance.locator('span');
  await expect(appearance).not.toBeChecked();
  await expect(appearance).toHaveCSS('height', '44px');
  await expect(thumb).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  await expect(thumb).toHaveCSS('transition-duration', '0.18s');
  await appearance.click();
  await expect(appearance).toBeChecked();
  await expect(thumb).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 36, 0)');
  await expect(thumb.locator('circle')).toHaveCount(0);
  await expectReadable(thumb);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(thumb).toHaveCSS('transition-duration', '0s');
  await appearance.click();
  await expect(appearance).not.toBeChecked();
  await expect(thumb).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  await expect(thumb.locator('circle')).toHaveCount(1);
  await expectReadable(thumb);
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

test('compact reader keeps examples useful and guidance contextual in both themes', async ({ page }) => {
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Chinese text' });
  for (const theme of ['light', 'dark']) {
    await setAppearance(page, theme);
    await expect(page.getByRole('heading', { name: 'Chinese to Jyutping' })).toBeVisible();
    await expect(page.getByText('Paste Chinese text to see its Jyutping.')).toBeVisible();
    await expect(page.getByText('Suggested readings may be incorrect.')).toHaveCount(0);
    await expectReadable(page.getByText('Paste Chinese text to see its Jyutping.'));
    await expectReadable(page.getByText('Text and photos are processed on your device.'));
    await page.screenshot({ path: test.info().outputPath('empty-' + theme + '.png'), fullPage: true });
    await input.fill('Coffee $28');
    await expect(page.getByText('Tap an underlined reading to see alternatives.')).toHaveCount(0);
    await expect(page.getByText('Suggested readings may be incorrect.')).toHaveCount(0);
    await page.getByRole('button', { name: 'A café order' }).click();
    await expect(input).toHaveValue('咖啡 Coffee $28\n牛肉麵 $58');
    await expect(page.getByRole('region', { name: 'Jyutping' }).getByText('gaa3', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Clear text' }).click();
    await expect(input).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  }
});

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
  await setAppearance(page, 'dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(20, 37, 29)');
  await setAppearance(page, 'light');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(245, 241, 231)');
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
  const appearance = page.getByRole('switch', { name: 'Dark mode', exact: true });
  await page.getByRole('textbox', { name: 'Chinese text' }).fill('銀行');
  for (const theme of ['light', 'dark']) {
    await setAppearance(page, theme);
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
    await expectReadable(page.getByText('Suggested readings may be incorrect.'));
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
    await setAppearance(page, theme);
    await expectReadable(page.getByRole('alert'));
    await expectReadable(page.getByText('Choose an image', { exact: true }));
    await page.screenshot({ path: test.info().outputPath('error-' + theme + '.png'), fullPage: true });
  }

  await picker.setInputFiles('tests/fixtures/menu-clean.png');
  const image = page.getByRole('img', { name: 'Selected photo prepared for reading' });
  await expect(image).toBeVisible();
  const darkPhoto = await photoPixels(page, image);
  await setAppearance(page, 'light');
  expect((await photoPixels(page, image)).equals(darkPhoto)).toBe(true);
  await setAppearance(page, 'dark');
  await image.scrollIntoViewIfNeeded();
  const bounds = (await image.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width * .075, bounds.y + bounds.height * .2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * .285, bounds.y + bounds.height * .2, { steps: 8 });
  await page.mouse.up();
  const darkHighlight = await photoPixels(page, image);
  await setAppearance(page, 'light');
  expect((await photoPixels(page, image)).equals(darkHighlight)).toBe(true);
  await setAppearance(page, 'dark');
  await page.getByRole('button', { name: 'Read highlighted text', exact: true }).click();
  const reading = page.getByRole('region', { name: 'Photo reading' });
  await expect(reading.getByText('ngau4', { exact: true })).toBeVisible({ timeout: 90_000 });
  await expect(reading.getByText('min6', { exact: true })).toBeVisible();
  await expect(reading.getByText('咖', { exact: true })).toHaveCount(0);
  await expectReadable(reading.getByText('ngau4', { exact: true }));
  await page.screenshot({ path: test.info().outputPath('photo-dark.png'), fullPage: true });
  await setAppearance(page, 'light');
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
  await setAppearance(page, 'dark');
  await page.getByRole('button', { name: 'Read a photo', exact: true }).click();
  await page.getByLabel('Choose an image', { exact: true }).setInputFiles({
    name: 'transparent.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64'),
  });
  const image = page.getByRole('img', { name: 'Selected photo prepared for reading' });
  await expect(image).toBeVisible();
  const darkPhoto = await photoPixels(page, image);
  await setAppearance(page, 'light');
  expect((await photoPixels(page, image)).equals(darkPhoto)).toBe(true);
  const stage = page.getByRole('group', { name: 'Highlight text in photo' });
  await stage.press('+');
  const lightZoom = await photoPixels(page, stage);
  await setAppearance(page, 'dark');
  expect((await photoPixels(page, stage)).equals(lightZoom)).toBe(true);
});
