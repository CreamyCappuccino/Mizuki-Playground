import { expect, test } from '@playwright/test';

test.describe('Planet Lab v2.1', () => {
  test('compares Earth and Mars without inventing a Mars climate model', async ({ page }) => {
    await page.goto('/planet-lab.html#planet=1&a=earth&b=mars&ls=90&lat=25');
    await expect(page.locator('[data-pl="title"]')).toContainText('Earth');
    await expect(page.locator('#pl-card-a h2')).toHaveText('Earth');
    await expect(page.locator('#pl-card-b h2')).toHaveText('Mars');
    await expect(page.locator('#pl-card-b .pl-capability')).toContainText('Not provided');
    await expect(page.locator('#pl-card-a .pl-metrics')).toContainText('W/m²');
    await expect(page.locator('#pl-card-b .pl-metrics')).toContainText('AU');
  });

  test('uses a versioned share state and can switch to Japanese Large', async ({ page }) => {
    await page.goto('/planet-lab.html#planet=1&a=mars&b=earth&ls=251&lat=-30');
    await expect(page.locator('#pl-world-a')).toHaveValue('mars');
    await expect(page.locator('#pl-season')).toHaveValue('251');
    await page.locator('#pl-language').selectOption('ja');
    await expect(page.locator('[data-pl="scope"]')).toContainText('Mars');
    await page.locator('#pl-large').check();
    await expect(page.locator('#pl-shell')).toHaveClass(/large/);
    await page.locator('[data-season="270"]').click();
    await expect(page).toHaveURL(/ls=270/);
    await expect(page.locator('#pl-url')).toHaveValue(/planet=1/);
  });
});
