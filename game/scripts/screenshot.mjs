import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const outDir = process.env.OUT_DIR ?? '/tmp/shots';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

page.on('console', (m) => {
  if (m.type() === 'error') console.log('[console.error]', m.text());
});
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);
await page.screenshot({ path: `${outDir}/01-title.png` });

// New campaign -> create
await page.click('[data-action="goto-create"]');
await page.waitForTimeout(600);
await page.screenshot({ path: `${outDir}/02-create.png` });

// Start
await page.click('[data-action="start-new"]');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/03-roster.png` });

// Create a world
const worldBtn = page.locator('[data-action="open-world-create"]').first();
if (await worldBtn.count()) {
  await worldBtn.click();
  await page.waitForTimeout(400);
  await page.click('[data-action="create-world"]');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${outDir}/04-worlds.png` });
}

// Back to characters, battle event
await page.click('[data-action="open-characters"]');
await page.waitForTimeout(500);
const battle = page.locator('[data-action="roll-battle"]').first();
if (await battle.count()) {
  await battle.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${outDir}/05-event.png` });
  // pick the combat-starting choice (first one usually battle)
  const choices = page.locator('[data-action="resolve-event"]');
  const n = await choices.count();
  console.log('choices:', n);
  if (n > 0) {
    await choices.first().click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${outDir}/06-after-choice.png` });
    // If in combat, take a few action screenshots
    const tech = page.locator('[data-action="combat-tech"]:not([disabled])').first();
    if (await tech.count()) {
      await page.screenshot({ path: `${outDir}/07-combat.png` });
      await tech.click();
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${outDir}/08-combat-attack.png` });
      const cont = page.locator('[data-action="continue-turn"]').first();
      if (await cont.count()) {
        await cont.click();
        await page.waitForTimeout(900);
      }
      await page.screenshot({ path: `${outDir}/09-combat-later.png` });
    }
  }
}

await browser.close();
console.log('done');
