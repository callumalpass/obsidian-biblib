import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp } from './obsidian';

let app: ObsidianApp;

test.beforeAll(async () => {
  app = await launchObsidian();
});

test.afterAll(async () => {
  if (app) {
    await closeObsidian(app);
  }
});

test.describe('BibLib Plugin', () => {
  test('should load and show commands in command palette', async () => {
    const { page } = app;

    // Open command palette with Ctrl+P
    await page.keyboard.press('Control+p');
    await page.waitForSelector('.prompt', { timeout: 5000 });

    // Search for BibLib commands
    await page.keyboard.type('biblib', { delay: 50 });
    await page.waitForTimeout(500);

    // Verify that BibLib commands appear
    const suggestions = page.locator('.suggestion-item');
    await expect(suggestions.first()).toBeVisible();

    // Screenshot: command palette with BibLib commands
    await page.screenshot({ path: 'test-results/screenshots/command-palette-biblib.png' });

    // Check for expected commands
    const suggestionText = await page.locator('.prompt-results').textContent();
    expect(suggestionText).toContain('Create literature note');

    // Close command palette
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test('should open bibliography modal via command', async () => {
    const { page } = app;

    // Open command palette
    await page.keyboard.press('Control+p');
    await page.waitForSelector('.prompt', { timeout: 5000 });

    // Search for the create literature note command
    await page.keyboard.type('Create literature note', { delay: 30 });
    await page.waitForTimeout(500);

    // Verify suggestion is visible then press Enter to execute
    const suggestion = page.locator('.suggestion-item').first();
    await expect(suggestion).toBeVisible();

    // Press Enter to execute the command
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Wait for the modal to appear (class is on contentEl inside .modal)
    const modal = page.locator('.modal:has(.bibliography-modal)');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Screenshot: bibliography modal opened
    await page.screenshot({ path: 'test-results/screenshots/bibliography-modal.png' });

    // Verify modal content
    await expect(modal.locator('h2')).toContainText('Enter bibliographic information');

    // Verify the auto-fill section exists
    await expect(modal.locator('.bibliography-autofill-details')).toBeVisible();

    // Close the modal
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  test('should fetch citation data from DOI', async () => {
    const { page } = app;

    // Open command palette and run create literature note command
    await page.keyboard.press('Control+p');
    await page.waitForSelector('.prompt', { timeout: 5000 });
    await page.keyboard.type('Create literature note', { delay: 30 });
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal:has(.bibliography-modal)');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Expand the auto-fill details if collapsed
    const details = modal.locator('.bibliography-autofill-details');
    const summary = details.locator('summary');
    if (await summary.isVisible()) {
      // Check if details is open
      const isOpen = await details.evaluate((el) => el.hasAttribute('open'));
      if (!isOpen) {
        await summary.click();
        await page.waitForTimeout(300);
      }
    }

    // Find the identifier input and enter a DOI
    // Using a well-known DOI for testing
    const testDoi = '10.1038/nature12373';
    const idInput = modal.locator('input[type="text"]').first();
    await idInput.fill(testDoi);

    // Screenshot: DOI entered before lookup
    await page.screenshot({ path: 'test-results/screenshots/doi-entered.png' });

    // Click the Lookup button
    const fetchButton = modal.locator('button:has-text("Lookup")').first();
    await expect(fetchButton).toBeVisible({ timeout: 5000 });
    await fetchButton.click();

    // Wait for the lookup to complete
    await page.waitForTimeout(10000); // Give API time to respond

    // Screenshot: citation data fetched
    await page.screenshot({ path: 'test-results/screenshots/citation-fetched.png' });

    // Close the modal
    await page.keyboard.press('Escape');
  });
});
