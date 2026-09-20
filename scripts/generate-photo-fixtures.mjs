// These controlled fixtures have known text, not OCR-derived expectations.
// Regeneration needs Playwright Chromium and the Windows Microsoft JhengHei font.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const images = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 520;
    const context = canvas.getContext('2d');
    context.fillStyle = 'white'; context.fillRect(0, 0, 1000, 520);
    context.fillStyle = 'black'; context.font = '72px "Microsoft JhengHei", sans-serif';
    context.fillText('牛肉麵', 70, 130); context.fillText('咖啡', 70, 260); context.fillText('旺角', 70, 390);
    const menu = canvas.toDataURL('image/png').split(',')[1];
    canvas.width = 600; canvas.height = 300;
    context.fillStyle = 'white'; context.fillRect(0, 0, 600, 300);
    context.fillStyle = 'black'; context.font = '60px "Microsoft JhengHei", sans-serif';
    context.fillText('咖啡', 60, 160);
    return { menu, jpeg: canvas.toDataURL('image/jpeg', .95).split(',')[1] };
  });
  await writeFile('tests/fixtures/menu-clean.png', Buffer.from(images.menu, 'base64'));
  const jpeg = Buffer.from(images.jpeg, 'base64');
  // EXIF little-endian TIFF with orientation 6: rotate the stored 600x300 pixels clockwise.
  const exif = Buffer.from([0xff,0xe1,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0]);
  await writeFile('tests/fixtures/orientation-6.jpg', Buffer.concat([jpeg.subarray(0,2), exif, jpeg.subarray(2)]));
} finally { await browser.close(); }

