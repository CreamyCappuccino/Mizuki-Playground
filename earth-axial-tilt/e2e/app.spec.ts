import { expect, test } from '@playwright/test';

test('loads and reacts to axial tilt controls', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Earth Axial Tilt' })).toBeVisible();
  await expect(page.locator('#earth-canvas')).toBeVisible();
  await expect(page.locator('#tilt-readout')).toHaveText('23.44°');

  await page.getByRole('button', { name: '90°' }).click();
  await expect(page.locator('#tilt-readout')).toHaveText('90°');

  await page.locator('#location-select').selectOption('tromso');
  await expect(page.locator('#location-name')).toHaveText('Tromsø');

  await page.getByRole('button', { name: 'Solar', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Solar', exact: true }).first()).toHaveClass(/active/);

  await page.locator('#day').fill('355');
  await page.locator('#day').dispatchEvent('input');
  await expect(page.locator('#day-readout')).toHaveText('355');

  await expect(page.locator('#annual-chart svg')).toBeVisible();

  const relevantErrors = errors.filter(
    (error) => !error.includes('earth_atmos_2048.jpg') && !error.includes('Failed to load resource'),
  );
  expect(relevantErrors).toEqual([]);
});
