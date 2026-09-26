import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/*paddle.worker*.js', route => route.fulfill({ contentType: 'text/javascript',
    body: `self.onmessage = () => self.postMessage({type:'result',value:{text:'銀行',initializationMs:0,recognitionMs:0,reused:false}});` }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Read a photo', exact: true }).click();
});

test('controls follow the photo state and dropdown supports keyboard dismissal and responsive layouts', async ({ page }) => {
  const picker = page.getByLabel('Choose an image', { exact: true });
  const camera = page.getByLabel('Take a photo', { exact: true });
  const newPhoto = page.getByRole('button', { name: 'New photo', exact: true });
  const resume = page.getByRole('button', { name: 'Continue editing', exact: true });
  await expect(picker).toBeVisible();
  await expect(camera).toHaveAttribute('capture', 'environment');
  await expect(picker).not.toHaveAttribute('capture');
  await expect(newPhoto).toHaveCount(0);
  await picker.setInputFiles('tests/fixtures/menu-clean.png');
  await page.getByRole('button', { name: 'Close photo editor' }).click();
  await expect(resume).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Your photo', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Clear photo', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit photo', exact: true })).toHaveCount(0);
  await newPhoto.press('Enter');
  await expect(newPhoto).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Tab');
  await expect(camera).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(picker).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(newPhoto).toBeFocused();
  await expect(picker).toBeHidden();
  await newPhoto.press('Enter');
  await page.keyboard.press('Shift+Tab');
  await expect(resume).toBeFocused();
  await expect(picker).toBeHidden();
  await newPhoto.click();
  await page.getByRole('heading', { name: 'Your photo', exact: true }).click();
  await expect(picker).toBeHidden();
  await resume.click();
  const stage = page.getByRole('group', { name: 'Highlight text in photo' });
  await stage.press('Space');
  await stage.press('Enter');
  await page.getByRole('button', { name: 'Read highlighted text', exact: true }).click();
  const reading = page.getByRole('region', { name: 'Photo reading' });
  await expect(reading.getByRole('heading')).toBeFocused();
  await expect(resume).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Choose a photo, then highlight the text.' })).toHaveCount(0);
  await expect(page.getByText('Your photo reading is ready.', { exact: true })).toHaveCount(0);
  await expect(reading.getByRole('button', { name: 'New photo', exact: true })).toBeVisible();
  for (const size of [{ width: 320, height: 700 }, { width: 852, height: 393 }, { width: 1440, height: 1000 }]) {
    await page.setViewportSize(size);
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await newPhoto.click();
      const heading = (await reading.getByRole('heading').boundingBox())!;
      const action = (await newPhoto.boundingBox())!;
      expect(Math.abs(heading.y + heading.height / 2 - action.y - action.height / 2)).toBeLessThan(2);
      for (const control of [camera, picker]) {
        const rect = (await control.boundingBox())!;
        expect(rect.height).toBeGreaterThanOrEqual(44);
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(size.width);
        expect(rect.y + rect.height).toBeLessThanOrEqual(size.height);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      await page.screenshot({ path: test.info().outputPath(`${size.width}-${colorScheme}.png`) });
      await picker.press('Escape');
    }
  }
  await page.getByRole('button', { name: 'Edit highlights in photo' }).click();
  await page.getByRole('button', { name: 'Undo highlight' }).click();
  await page.getByRole('button', { name: 'Close photo editor' }).click();
  await expect(resume).toBeFocused();
  await expect(reading).toHaveCount(0);
});

test('canceling or failing a replacement retains the reading, selection and zoom until a new image opens', async ({ page }) => {
  const picker = page.getByLabel('Choose an image', { exact: true });
  await picker.setInputFiles('tests/fixtures/menu-clean.png');
  const stage = page.getByRole('group', { name: 'Highlight text in photo' });
  await stage.press('+');
  await stage.press('Space');
  await stage.press('ArrowRight');
  await stage.press('Enter');
  const stroke = await stage.locator('path').getAttribute('d');
  await page.getByRole('button', { name: 'Read highlighted text', exact: true }).click();
  const preview = page.getByRole('button', { name: 'Edit highlights in photo' });
  await expect(preview).toBeVisible();
  const original = await preview.locator('svg').innerHTML();
  const newPhoto = page.getByRole('button', { name: 'New photo', exact: true });
  for (const label of ['Take a photo', 'Choose an image']) {
    await newPhoto.click();
    const input = page.getByLabel(label, { exact: true });
    await Promise.all([page.waitForEvent('filechooser'), input.click()]);
    await input.dispatchEvent('cancel');
    await expect(newPhoto).toBeFocused();
    await expect(newPhoto).toHaveAttribute('aria-expanded', 'false');
    expect(await preview.locator('svg').innerHTML()).toBe(original);
  }
  await newPhoto.click();
  await picker.setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('broken') });
  await expect(page.getByRole('alert')).toContainText('This image could not be opened.');
  expect(await preview.locator('svg').innerHTML()).toBe(original);
  await preview.click();
  await expect(page.getByLabel('Photo zoom', { exact: true })).toHaveText('150%');
  await expect(stage.locator('path')).toHaveAttribute('d', stroke!);
  await page.getByRole('button', { name: 'Close photo editor' }).click();
  await expect(preview).toBeFocused();
  await newPhoto.click();
  await picker.setInputFiles('tests/fixtures/orientation-6.jpg');
  await expect(stage).toBeVisible();
  await expect(stage.locator('path')).toHaveCount(0);
  await expect(page.getByLabel('Photo zoom', { exact: true })).toHaveText('100%');
  await expect(page.getByRole('region', { name: 'Photo reading', includeHidden: true })).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Read whole image', exact: true }).click();
  await expect(preview.locator('svg')).toHaveAttribute('viewBox', '0 0 300 600');
});
