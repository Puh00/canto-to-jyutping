import { expect, test } from '@playwright/test';

test('preview retains submitted dots and brush widths, while whole-image scans hide saved highlights', async ({ page }) => {
  await page.route('**/*paddle.worker*.js', route => route.fulfill({ contentType: 'text/javascript',
    body: `self.onmessage = () => self.postMessage({type:'result',value:{text:'銀行',initializationMs:0,recognitionMs:0,reused:false}});` }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Read a photo', exact: true }).click();
  await page.getByLabel('Choose an image', { exact: true }).setInputFiles({ name: 'square.svg', mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="white"/><text x="200" y="400" font-size="100">銀行</text></svg>') });
  const stage = page.getByRole('group', { name: 'Highlight text in photo' });
  const brush = page.getByRole('button', { name: 'Brush size', exact: true });
  const slider = page.getByRole('slider', { name: 'Brush size', exact: true });
  await brush.click();
  await slider.press('Home');
  await slider.press('Escape');
  const image = (await page.getByRole('img', { name: 'Selected photo prepared for reading' }).boundingBox())!;
  await page.mouse.click(image.x + 1, image.y + 1);
  await brush.click();
  await slider.press('End');
  await slider.press('Escape');
  await stage.press('Space');
  await stage.press('ArrowRight');
  await stage.press('Enter');
  await page.mouse.click(image.x + image.width - 1, image.y + image.height - 1);
  const strokes = stage.locator('svg > g');
  await expect(strokes.locator('path')).toHaveCount(3);
  const submitted = await strokes.innerHTML();
  await expect(strokes.locator('path').first()).toHaveAttribute('stroke-width', '32');
  await expect(strokes.locator('path').nth(1)).toHaveAttribute('stroke-width', '240');
  await page.getByRole('button', { name: 'Read highlighted text', exact: true }).click();
  const preview = page.getByRole('button', { name: 'Edit highlights in photo' });
  const source = preview.getByRole('img');
  await expect(source).toHaveAttribute('viewBox', '0 0 800 800');
  expect(await source.locator('g').first().innerHTML()).toBe(submitted);
  await expect(source.locator('g').first()).toHaveAttribute('opacity', '.38');
  await expect(source.locator('mask')).toHaveCount(0);
  await expect(page.getByText('If the characters look wrong, tap the photo to adjust the highlights.', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Suggested readings may be incorrect.', { exact: true })).toBeVisible();
  await preview.click();
  await page.getByRole('button', { name: 'Read whole image', exact: true }).click();
  await expect(source).toBeVisible();
  await expect(source.locator('path, circle')).toHaveCount(0);
  await expect(source).toHaveAttribute('viewBox', '0 0 800 800');
  await preview.click();
  expect(await strokes.innerHTML()).toBe(submitted);
  await page.getByRole('button', { name: 'Close photo editor' }).click();
  await expect(preview).toBeFocused();
  await expect(source.locator('path, circle')).toHaveCount(0);
});

test('long readings keep their source visible and focused characters unobscured in both themes', async ({ page }) => {
  test.setTimeout(60_000);
  // Control recognition output for layout checks; region.spec.ts verifies actual OCR and crop agreement.
  await page.route('**/*paddle.worker*.js', route => route.fulfill({ contentType: 'text/javascript',
    body: `self.onmessage = () => self.postMessage(${JSON.stringify({ type: 'result', value: {
      text: '銀行 咖啡 牛肉麵\n'.repeat(30), initializationMs: 0, recognitionMs: 0, reused: false,
    } })});` }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Read a photo', exact: true }).click();
  await page.getByLabel('Choose an image', { exact: true }).setInputFiles('tests/fixtures/menu-clean.png');
  await page.getByRole('button', { name: 'Read whole image', exact: true }).click();
  const result = page.getByRole('region', { name: 'Photo reading' });
  const heading = result.getByRole('heading', { name: 'Photo reading' });
  await expect(heading).toBeFocused();
  const photo = result.getByRole('button', { name: 'Edit highlights in photo' });
  const tokens = result.getByRole('button', { name: '行, hong4. View other readings' });
  await expect(tokens).toHaveCount(30);
  for (const size of [{ width: 320, height: 700 }, { width: 393, height: 852 }, { width: 852, height: 393 }, { width: 1440, height: 1000 }]) {
    await page.setViewportSize(size);
    const stacked = size.width < 900 && !(size.width >= 600 && size.height <= 500);
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await heading.focus();
      await heading.scrollIntoViewIfNeeded();
      await photo.evaluate(element => element.scrollIntoView({ block: 'start' }));
      const initial = (await photo.boundingBox())!;
      if (stacked) expect(initial.height).toBeLessThanOrEqual(size.height * .35 + 1);
      else expect(initial.x + initial.width).toBeLessThan((await tokens.first().boundingBox())!.x);
      await page.evaluate(() => window.scrollBy(0, 500));
      const pinned = (await photo.boundingBox())!;
      expect(pinned.y).toBeGreaterThanOrEqual(0);
      expect(pinned.y).toBeLessThanOrEqual(9);
      expect(pinned.y + pinned.height).toBeLessThan(size.height);
      await tokens.nth(12).focus();
      await expect.poll(async () => {
        const token = (await tokens.nth(12).boundingBox())!;
        const source = (await photo.boundingBox())!;
        return token.y >= 0 && token.y + token.height <= size.height && (!stacked || token.y >= source.y + source.height);
      }).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`${size.width}-${theme}.png`) });
      await tokens.nth(12).press('Enter');
      await expect(page.getByRole('dialog', { name: 'Readings for 行' })).toBeVisible();
      await page.getByRole('button', { name: 'Close pronunciation details' }).click();
      await expect(tokens.nth(12)).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    }
  }
});

test('a new scan clears its old preview and canceling or failing cannot bring it back', async ({ page }) => {
  let calls = 0;
  await page.route('**/*paddle.worker*.js', route => {
    calls++;
    return route.fulfill({ contentType: 'text/javascript', body: calls === 1
      ? `let scans = 0; self.onmessage = () => { if (++scans === 1) self.postMessage({type:'result',value:{text:'銀行', initializationMs:0, recognitionMs:0, reused:false}}); };`
      : `self.onmessage = () => self.postMessage({type:'error', message:'Could not recognize this photo.'});` });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Read a photo', exact: true }).click();
  const picker = page.getByLabel('Choose an image', { exact: true });
  await picker.setInputFiles('tests/fixtures/menu-clean.png');
  await page.getByRole('button', { name: 'Read whole image', exact: true }).click();
  const preview = page.getByRole('button', { name: 'Edit highlights in photo' });
  await expect(preview).toBeVisible();
  await preview.click();
  await page.getByRole('button', { name: 'Read whole image', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit highlights in photo', includeHidden: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel reading', exact: true }).click();
  await page.getByRole('button', { name: 'Close photo editor' }).click();
  await expect(preview).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continue editing', exact: true })).toBeFocused();
  await picker.setInputFiles('tests/fixtures/orientation-6.jpg');
  await page.getByRole('button', { name: 'Read whole image', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not recognize this photo.');
  await page.getByRole('button', { name: 'Close photo editor' }).click();
  await expect(preview).toHaveCount(0);
  await page.getByRole('button', { name: 'Read text', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Continue editing', exact: true })).toHaveCount(0);
});

test('transparent source previews retain their colors and white backing across themes', async ({ page }) => {
  await page.route('**/*paddle.worker*.js', route => route.fulfill({ contentType: 'text/javascript',
    body: `self.onmessage = () => self.postMessage({type:'result',value:{text:'咖啡',initializationMs:0,recognitionMs:0,reused:false}});` }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Read a photo', exact: true }).click();
  await page.getByLabel('Choose an image', { exact: true }).setInputFiles({ name: 'transparent.svg', mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="600"><rect x="30" y="80" width="180" height="100" fill="#d04040"/><text x="30" y="320" font-size="60" fill="#000">咖啡</text></svg>') });
  await page.getByRole('button', { name: 'Read whole image', exact: true }).click();
  const source = page.getByRole('img', { name: 'Photo used for this reading' });
  await expect(source).toBeVisible();
  await expect(source).toHaveAttribute('viewBox', '0 0 300 600');
  await source.scrollIntoViewIfNeeded();
  const bounds = (await source.boundingBox())!;
  // Exclude rounded frame corners, which intentionally follow the page theme.
  const clip = { x: bounds.x + 10, y: bounds.y + 10, width: bounds.width - 20, height: bounds.height - 20 };
  await page.emulateMedia({ colorScheme: 'light' });
  const light = await page.screenshot({ clip });
  await page.emulateMedia({ colorScheme: 'dark' });
  expect((await page.screenshot({ clip })).equals(light)).toBe(true);
});
