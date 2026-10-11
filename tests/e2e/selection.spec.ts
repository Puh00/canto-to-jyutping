import { expect, test } from '@playwright/test';
import { supportMissingWebAudio } from '../fixtures/web-audio';

test.beforeEach(async ({ page }, info) => { await supportMissingWebAudio(page, info); });

for (const mode of ['text', 'photo'] as const) {
  test(`${mode} reading copies the exact source through native Copy events`, async ({ page, context, browserName }) => {
    const source = '銀行\nCoffee $28，𠀀\u{E0100} e\u0301 👩‍👩‍👧‍👦\n';
    await page.route('**/*paddle.worker*.js', route => route.fulfill({ contentType: 'text/javascript',
      body: `self.onmessage = () => self.postMessage(${JSON.stringify({ type: 'result', value: {
        text: source, initializationMs: 0, recognitionMs: 0, reused: false,
      } })});` }));
    await page.goto('/');
    if (mode === 'text') {
      await page.getByRole('textbox', { name: 'Cantonese text' }).fill(source);
    } else {
      await page.getByRole('button', { name: 'Read a photo', exact: true }).click();
      await page.getByLabel('Choose an image', { exact: true }).setInputFiles('tests/fixtures/menu-clean.png');
      await page.getByRole('button', { name: 'Read whole image', exact: true }).click();
    }
    const reading = page.locator('div[lang="zh-Hant"]');
    await expect(reading).toContainText('ngan4');
    // Put keyboard focus in the reading, as a user selecting its characters would.
    await reading.getByRole('button').first().focus();
    for (const backwards of [false, true]) {
      const copied = await reading.evaluate((element, reverse) => {
        const selection = getSelection()!;
        selection.removeAllRanges();
        if (reverse) selection.setBaseAndExtent(element, element.childNodes.length, element, 0);
        else selection.setBaseAndExtent(element, 0, element, element.childNodes.length);
        const clipboardData = new DataTransfer();
        const event = new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData });
        element.dispatchEvent(event);
        return { text: clipboardData.getData('text/plain'), handled: event.defaultPrevented };
      }, backwards);
      expect(copied).toEqual({ text: source, handled: true });
    }
    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.keyboard.press('ControlOrMeta+c');
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(source);
    }
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.screenshot({ path: test.info().outputPath(`${mode}-${colorScheme}.png`), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    }
  });
}

test('dragging across characters selects source text without activating audio or alternatives', async ({ page }) => {
  const audio: string[] = [];
  await page.route('**/audio/wordshk-202207/*.mp3', route => { audio.push(route.request().url()); return route.abort(); });
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Cantonese text' }).fill('銀行你好');
  const reading = page.locator('div[lang="zh-Hant"]');
  const first = reading.locator('[data-source-start]').first();
  const last = reading.locator('[data-source-start]').last();
  await first.scrollIntoViewIfNeeded();
  const start = (await first.boundingBox())!;
  const end = (await last.boundingBox())!;
  await page.mouse.move(start.x + 1, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width - 1, end.y + end.height / 2, { steps: 20 });
  await page.mouse.up();
  expect(await page.evaluate(() => getSelection()?.isCollapsed)).toBe(false);
  const copied = await reading.evaluate(element => {
    const clipboardData = new DataTransfer();
    element.dispatchEvent(new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData }));
    return clipboardData.getData('text/plain');
  });
  expect(copied).toBe('銀行你好');
  expect(audio).toEqual([]);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('copy follows highlighted results and a replacement whole-image scan', async ({ page }) => {
  await page.route('**/*paddle.worker*.js', route => route.fulfill({ contentType: 'text/javascript',
    body: `let scans = 0; self.onmessage = () => self.postMessage({type:'result',value:{
      text: ++scans === 1 ? '銀行' : '咖啡 Coffee $28', initializationMs:0,recognitionMs:0,reused:false}});` }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Read a photo', exact: true }).click();
  await page.getByLabel('Choose an image', { exact: true }).setInputFiles('tests/fixtures/menu-clean.png');
  const stage = page.getByRole('group', { name: 'Highlight text in photo' });
  await stage.press('Space');
  await stage.press('ArrowRight');
  await stage.press('Enter');
  await page.getByRole('button', { name: 'Read highlighted text', exact: true }).click();
  const reading = page.locator('div[lang="zh-Hant"]');
  for (const source of ['銀行', '咖啡 Coffee $28']) {
    await expect(reading.locator('[data-source-start]').first()).toHaveText(source[0]!);
    const copied = await reading.evaluate(element => {
      getSelection()!.setBaseAndExtent(element, 0, element, element.childNodes.length);
      const clipboardData = new DataTransfer();
      element.dispatchEvent(new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData }));
      const text = clipboardData.getData('text/plain');
      getSelection()!.removeAllRanges();
      return text;
    });
    expect(copied).toBe(source);
    if (source === '銀行') {
      await page.getByRole('button', { name: 'Edit highlights in photo' }).click();
      await page.getByRole('button', { name: 'Read whole image', exact: true }).click();
    }
  }
});
