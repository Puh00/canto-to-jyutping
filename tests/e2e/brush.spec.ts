import { expect, test } from '@playwright/test';

test('brush popover adjusts future strokes without drawing or moving the photo', async ({ page, isMobile }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Read a photo', exact: true }).click();
  const picker = page.getByLabel('Choose an image', { exact: true });
  await picker.setInputFiles('tests/fixtures/menu-clean.png');
  const brush = page.getByRole('button', { name: 'Brush size', exact: true });
  const slider = page.getByRole('slider', { name: 'Brush size', exact: true });
  const stage = page.getByRole('group', { name: 'Highlight text in photo' });
  const paths = stage.locator('svg path');
  await expect(brush).toHaveAttribute('aria-expanded', 'false');
  await expect(slider).toBeHidden();
  await stage.press('Space');
  await stage.press('ArrowRight');
  await stage.press('Enter');
  const firstStroke = await paths.first().getAttribute('stroke-width');
  await brush.focus();
  await page.keyboard.press('Enter');
  await expect(slider).toBeFocused();
  await expect(slider).toHaveValue('12');
  await slider.press('End');
  await expect(slider).toHaveValue('30');
  await slider.press('ArrowLeft');
  await expect(slider).toHaveValue('29');
  await slider.press('Home');
  await expect(slider).toHaveValue('4');
  await expect(paths).toHaveCount(1);
  await expect(paths.first()).toHaveAttribute('stroke-width', firstStroke!);
  await expect(page.getByLabel('Photo zoom', { exact: true })).toHaveText('100%');
  const bounds = (await slider.boundingBox())!;
  if (isMobile) await page.touchscreen.tap(bounds.x + bounds.width * .7, bounds.y + bounds.height / 2);
  else {
    await page.mouse.click(bounds.x + bounds.width * .7, bounds.y + bounds.height / 2);
    await slider.dispatchEvent('wheel', { deltaY: -300, bubbles: true });
  }
  const adjustedSize = Number(await slider.inputValue());
  expect(adjustedSize).toBeGreaterThan(12);
  await expect(page.getByLabel('Photo zoom', { exact: true })).toHaveText('100%');
  await expect(paths).toHaveCount(1);
  await slider.press('Escape');
  await expect(slider).toBeHidden();
  await expect(brush).toBeFocused();
  await brush.click();
  await expect(slider).toHaveValue(String(adjustedSize));
  await brush.click();
  await expect(slider).toBeHidden();
  await brush.click();
  await page.getByText('Highlight the text', { exact: true }).click();
  await expect(slider).toBeHidden();
  await stage.press('Space');
  await stage.press('ArrowRight');
  await stage.press('Enter');
  await expect(paths).toHaveCount(2);
  await expect(paths.first()).toHaveAttribute('stroke-width', firstStroke!);
  expect(Number(await paths.nth(1).getAttribute('stroke-width'))).toBeGreaterThan(Number(firstStroke));
  await page.getByRole('button', { name: 'Undo highlight', exact: true }).click();
  await expect(paths).toHaveCount(1);
  await picker.setInputFiles('tests/fixtures/menu-clean.png');
  await brush.click();
  await expect(slider).toHaveValue('12');
  await expect(paths).toHaveCount(0);
});

test('brush panel stays in the viewport for narrow and short photos in both themes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Read a photo', exact: true }).click();
  for (const [shape, width, height] of [['portrait', 120, 900], ['landscape', 900, 120]] as const) {
    const png = await page.evaluate(({ width, height }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#fff'; context.fillRect(0, 0, width, height);
      return canvas.toDataURL('image/png').split(',')[1]!;
    }, { width, height });
    await page.getByLabel('Choose an image', { exact: true }).setInputFiles({ name: shape + '.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    for (const theme of ['light', 'dark']) {
      const toggle = page.getByRole('switch', { name: 'Dark mode', exact: true });
      if (await toggle.getAttribute('aria-checked') !== String(theme === 'dark')) await toggle.click();
      const brush = page.getByRole('button', { name: 'Brush size', exact: true });
      await brush.click();
      const panel = page.locator(`[id="${await brush.getAttribute('aria-controls')}"]`);
      await expect(panel).toBeVisible();
      const bounds = (await panel.boundingBox())!;
      const buttonBounds = (await brush.boundingBox())!;
      const viewport = page.viewportSize()!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
      expect(bounds.y >= buttonBounds.y + buttonBounds.height || bounds.y + bounds.height <= buttonBounds.y).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      await page.screenshot({ path: test.info().outputPath(`${shape}-${theme}.png`), fullPage: true });
      await page.getByRole('slider', { name: 'Brush size', exact: true }).press('Escape');
    }
  }
});
