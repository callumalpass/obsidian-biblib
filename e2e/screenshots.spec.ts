import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp } from './obsidian';
import * as path from 'path';

const DOCS_ASSETS = path.resolve(__dirname, '..', 'docs', 'assets', 'screenshots');

let app: ObsidianApp;

test.beforeAll(async () => {
  app = await launchObsidian();
});

test.afterAll(async () => {
  if (app) {
    await closeObsidian(app);
  }
});

test.describe('Documentation Screenshots', () => {
  test('command palette with BibLib commands', async () => {
    const { page } = app;

    await page.keyboard.press('Control+p');
    await page.waitForSelector('.prompt', { timeout: 5000 });
    await page.keyboard.type('biblib', { delay: 50 });
    await page.waitForTimeout(500);

    const prompt = page.locator('.prompt');
    await expect(prompt).toBeVisible();
    await prompt.screenshot({ path: path.join(DOCS_ASSETS, 'command-palette.png') });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test('create literature note modal (empty)', async () => {
    const { page } = app;

    await page.keyboard.press('Control+p');
    await page.waitForSelector('.prompt', { timeout: 5000 });
    await page.keyboard.type('Create literature note', { delay: 30 });
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal:has(.bibliography-modal)');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Scroll to top of modal content to capture the auto-fill section and top fields
    const modalContent = modal.locator('.modal-content');
    await modalContent.evaluate((el) => el.scrollTop = 0);
    await page.waitForTimeout(200);

    await modal.screenshot({ path: path.join(DOCS_ASSETS, 'create-note-modal.png') });

    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  test('modal after DOI lookup', async () => {
    const { page } = app;

    await page.keyboard.press('Control+p');
    await page.waitForSelector('.prompt', { timeout: 5000 });
    await page.keyboard.type('Create literature note', { delay: 30 });
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    const modal = page.locator('.modal:has(.bibliography-modal)');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Expand auto-fill if collapsed
    const details = modal.locator('.bibliography-autofill-details');
    const summary = details.locator('summary');
    if (await summary.isVisible()) {
      const isOpen = await details.evaluate((el) => el.hasAttribute('open'));
      if (!isOpen) {
        await summary.click();
        await page.waitForTimeout(300);
      }
    }

    // Enter DOI and fetch
    const testDoi = '10.1038/nature12373';
    const idInput = modal.locator('input[type="text"]').first();
    await idInput.fill(testDoi);

    const fetchButton = modal.locator('button:has-text("Lookup")').first();
    await expect(fetchButton).toBeVisible({ timeout: 5000 });
    await fetchButton.click();

    // Wait for fetch to complete — look for populated title field
    await page.waitForTimeout(10000);

    // Scroll to top to show the filled-in fields
    const modalContent = modal.locator('.modal-content');
    await modalContent.evaluate((el) => el.scrollTop = 0);
    await page.waitForTimeout(200);

    await modal.screenshot({ path: path.join(DOCS_ASSETS, 'doi-fetched.png') });

    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });
});
