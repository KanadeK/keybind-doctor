import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
});

test('runs the real five-format example and exposes its evidence', async ({
  page,
}, testInfo) => {
  await expect(
    page.getByRole('heading', {
      name: 'Shortcut conflicts, diagnosed.',
    }),
  ).toBeVisible();
  await expect(page.locator('.summary-bar > div').first().locator('span')).toHaveText('21');
  await expect(page.getByRole('tab', { name: /Findings/ })).toContainText('16');
  await expect(page.locator('.finding-row')).toHaveCount(16);

  await page
    .locator('.finding-row')
    .filter({ hasText: 'Two commands compete' })
    .filter({ hasText: 'Ctrl + Alt + T' })
    .click();
  await expect(page.locator('.finding-detail')).toContainText('PowerToys');
  await expect(page.locator('.finding-detail')).toContainText('AutoHotkey');

  await page.getByRole('tab', { name: /Repair plan/ }).click();
  await expect(page.locator('.repair-row')).toHaveCount(12);
  await expect(page.locator('.summary-status')).toContainText('PLAN COMPLETE');

  if (testInfo.project.name === 'chromium') {
    await page.screenshot({
      path: 'test-results/workbench-dark.png',
      fullPage: true,
      animations: 'disabled',
    });
  }
});

test('accepts a user manifest locally and downloads the report', async ({ page }) => {
  const removeButtons = page.getByRole('button', { name: /^Remove / });
  while ((await removeButtons.count()) > 0) {
    await removeButtons.first().click();
  }
  await expect(page.getByText('No files loaded. Use the example or add your own.')).toBeVisible();

  const manifest = JSON.stringify({
    version: 1,
    application: 'Acceptance App',
    bindings: [
      {
        key: 'ctrl+alt+j',
        command: 'acceptance.run',
        scope: 'application',
      },
    ],
  });
  await page.locator('input[type="file"]').setInputFiles({
    name: 'acceptance.keybind.json',
    mimeType: 'application/json',
    buffer: Buffer.from(manifest),
  });
  await expect(page.locator('.summary-bar > div').first().locator('span')).toHaveText('1');
  await expect(page.getByText('No overlapping shortcuts found.')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSON', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('keybind-doctor-report.json');
});

test('supports theme and platform changes without a reload', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.getByRole('button', { name: 'macOS' }).click();
  await expect(page.getByRole('button', { name: 'macOS' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.summary-bar > div').first().locator('span')).toHaveText('21');
});

test('has no serious accessibility violations or page-level mobile overflow', async ({
  page,
}) => {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(serious).toEqual([]);

  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
});

test('honors reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  const duration = await page.locator('.signal-lane i').first().evaluate((element) => {
    return getComputedStyle(element).animationDuration;
  });
  const seconds = duration.endsWith('ms')
    ? Number.parseFloat(duration) / 1000
    : Number.parseFloat(duration);
  expect(seconds).toBeLessThanOrEqual(0.0000011);
});
