import { expect, test } from '@playwright/test';

test('editor preserves highlights and zoom, restores focus, and handles Escape in order', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Read a photo', exact: true }).click();
  const picker = page.getByLabel('Choose an image', { exact: true });
  await picker.focus();
  await picker.setInputFiles('tests/fixtures/menu-clean.png');
  const dialog = page.getByRole('dialog', { name: 'Highlight the text', exact: true });
  const close = page.getByRole('button', { name: 'Close photo editor' });
  const stage = page.getByRole('group', { name: 'Highlight text in photo' });
  await expect(dialog).toBeVisible();
  await expect(close).toBeFocused();
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await stage.press('+');
  await stage.press('Space');
  await stage.press('ArrowLeft');
  await stage.press('Enter');
  const paths = stage.locator('svg path');
  const stroke = await paths.first().getAttribute('d');
  await close.click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Continue editing', exact: true })).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  const edit = page.getByRole('button', { name: 'Continue editing', exact: true });
  await edit.click();
  await expect(page.getByLabel('Photo zoom', { exact: true })).toHaveText('150%');
  await expect(paths).toHaveCount(1);
  await expect(paths.first()).toHaveAttribute('d', stroke!);
  await page.getByRole('button', { name: 'Brush size', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('slider', { name: 'Brush size', exact: true })).toBeHidden();
  await expect(dialog).toBeVisible();
  await stage.press('Space');
  await stage.press('ArrowRight');
  await stage.press('Escape');
  await expect(paths).toHaveCount(1);
  await expect(dialog).toBeVisible();
  await stage.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(edit).toBeFocused();
  await edit.click();
  await expect(page.getByRole('button', { name: 'Fit photo', exact: true })).toHaveCount(0);
  await expect(page.getByText('Photo tips', { exact: true })).toHaveCount(0);
  await stage.press('0');
  await expect(page.getByLabel('Photo zoom', { exact: true })).toHaveText('100%');
  await expect(paths.first()).toHaveAttribute('d', stroke!);
  await close.click();
  await page.getByRole('button', { name: 'Read text', exact: true }).click();
  await expect(edit).toHaveCount(0);
  await expect(page.locator('dialog')).toHaveCount(0);
});

test('editor fits different photo shapes on phone, landscape and desktop in both themes', async ({ page }) => {
  test.setTimeout(60_000);
  for (const size of [{ width: 320, height: 700 }, { width: 393, height: 852 }, { width: 852, height: 393 }, { width: 1440, height: 1000 }]) {
    await page.setViewportSize(size);
    await page.goto('/');
    await page.getByRole('button', { name: 'Read a photo', exact: true }).click();
    for (const [shape, width, height] of [['portrait', 900, 1600], ['landscape', 1600, 900], ['square', 800, 800], ['tall', 200, 2000]] as const) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#f9ebc9"/><text x="10%" y="30%" font-size="${width / 8}" fill="#173e30">牛肉麵</text></svg>`;
      await page.getByLabel('Choose an image', { exact: true }).setInputFiles({ name: shape + '.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) });
      const stage = page.getByRole('group', { name: 'Highlight text in photo' });
      const image = page.getByRole('img', { name: 'Selected photo prepared for reading' });
      await expect(image).toBeVisible();
      await expect.poll(async () => (await image.boundingBox())!.width).toBeGreaterThan(10);
      for (const theme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: theme });
        const viewport = (await stage.boundingBox())!;
        const photo = (await image.boundingBox())!;
        expect(photo.width / photo.height).toBeCloseTo(width / height, 2);
        expect(photo.width).toBeCloseTo(Math.min(viewport.width, viewport.height * width / height), 0);
        expect(photo.x).toBeCloseTo(viewport.x + (viewport.width - photo.width) / 2, 0);
        expect(photo.y).toBeCloseTo(viewport.y + (viewport.height - photo.height) / 2, 0);
        expect(viewport.width).toBe(size.width);
        const header = (await page.locator('dialog header').boundingBox())!;
        const footer = (await page.locator('dialog footer').boundingBox())!;
        expect(viewport.y).toBeCloseTo(header.y + header.height, 0);
        expect(viewport.y + viewport.height).toBeCloseTo(footer.y, 0);
        expect(viewport.height).toBeGreaterThan(size.height * .6);
        const brush = (await page.getByRole('button', { name: 'Brush size', exact: true }).boundingBox())!;
        expect(brush.y).toBeCloseTo(viewport.y + 12, 0);
        expect(brush.x + brush.width).toBeCloseTo(viewport.x + viewport.width - 12, 0);
        for (const name of ['Close photo editor', 'Brush size', 'Read highlighted text', 'Read whole image']) {
          const control = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
          expect(control.height).toBeGreaterThanOrEqual(44);
          expect(control.x).toBeGreaterThanOrEqual(0);
          expect(control.x + control.width).toBeLessThanOrEqual(size.width);
          expect(control.y + control.height).toBeLessThanOrEqual(size.height);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
        await page.screenshot({ path: test.info().outputPath(`${size.width}-${shape}-${theme}.png`) });
      }
      // A brush that starts in the surround must not mark the nearest image edge.
      const viewport = (await stage.boundingBox())!;
      const photo = (await image.boundingBox())!;
      if (photo.width < viewport.width - 10) await page.mouse.click(viewport.x + 2, viewport.y + viewport.height / 2);
      else if (photo.height < viewport.height - 10) await page.mouse.click(viewport.x + viewport.width / 2, viewport.y + 2);
      await expect(page.getByRole('button', { name: 'Read highlighted text', exact: true })).toBeDisabled();
      await page.getByRole('button', { name: 'Close photo editor' }).click();
    }
  }
});

test('brush strokes stop at the image edge when dragged into surrounding space', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Read a photo', exact: true }).click();
  await page.getByLabel('Choose an image', { exact: true }).setInputFiles('tests/fixtures/orientation-6.jpg');
  const image = page.getByRole('img', { name: 'Selected photo prepared for reading' });
  const stage = page.getByRole('group', { name: 'Highlight text in photo' });
  const photo = (await image.boundingBox())!;
  const frame = (await stage.boundingBox())!;
  await page.mouse.move(photo.x + photo.width * .1, photo.y + photo.height / 2);
  await page.mouse.down();
  await page.mouse.move(frame.x - 10, photo.y + photo.height / 2, { steps: 8 });
  await page.mouse.up();
  const path = stage.locator('svg path');
  await expect(path).toHaveCount(1);
  const points = (await path.getAttribute('d'))!.match(/[\d.]+/g)!.map(Number);
  expect(points.at(-2)).toBe(0);
  expect(points.at(-1)).toBeCloseTo(points[1]!);
  expect(points.every((value, index) => value >= 0 && value <= (index % 2 ? 600 : 300))).toBe(true);
});

test('no-text errors remain editable and replacing the photo recovers', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Read a photo', exact: true }).click();
  const picker = page.getByLabel('Choose an image', { exact: true });
  await picker.setInputFiles({ name: 'blank.svg', mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="white"/></svg>') });
  await page.getByRole('button', { name: 'Read whole image', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No text was found.', { timeout: 90_000 });
  await expect(page.getByRole('dialog', { name: 'Highlight the text' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Brush size', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Close photo editor' }).click();
  await picker.setInputFiles('tests/fixtures/menu-clean.png');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Read whole image', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Photo reading' })).toBeFocused({ timeout: 90_000 });
});

test('resizing cancels unfinished gestures and retains committed image coordinates', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Read a photo', exact: true }).click();
  await page.getByLabel('Choose an image', { exact: true }).setInputFiles('tests/fixtures/orientation-6.jpg');
  const stage = page.getByRole('group', { name: 'Highlight text in photo' });
  await stage.press('+');
  await stage.press('Space');
  await stage.press('ArrowRight');
  await stage.press('Enter');
  const paths = stage.locator('svg path');
  const saved = await paths.first().getAttribute('d');
  await stage.press('Space');
  await stage.press('ArrowDown');
  await expect(paths).toHaveCount(2);
  await page.setViewportSize({ width: 852, height: 393 });
  await expect(paths).toHaveCount(1);
  await expect(paths.first()).toHaveAttribute('d', saved!);
  await expect(page.getByLabel('Photo zoom', { exact: true })).toHaveText('150%');
  await stage.press('Space');
  await stage.press('ArrowRight');
  await stage.press('Enter');
  await expect(paths).toHaveCount(2);
});
