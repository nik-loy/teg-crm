import { test, expect } from '@playwright/test';

test.describe('Event Creation', () => {
  test('should be able to create an event', async ({ page }) => {
    // 1. Visit Login
    await page.goto("/login");
    
    // 2. Input Password and submit
    await page.fill('input[type="password"]', "TEGmoney");
    await page.click('button[type="submit"]');
    
    // 3. Confirm redirected to today
    await expect(page).toHaveURL(/\/today/);

    // 4. Go to Events via sidebar
    const link = page.locator("aside").getByRole("link", { name: "Events", exact: true });
    await link.click();
    await expect(page).toHaveURL(/\/events/);
    
    // Open Add Event dialog
    await page.click('button:has-text("Add Event")');
    
    // Fill the form
    await page.fill('input[placeholder="e.g. Bits & Pretzels 2026"]', 'Test Event Playwright');
    await page.fill('input[type="date"]', '2026-06-26');
    await page.fill('input[placeholder="https://lu.ma/..."]', 'https://lu.ma/test');
    
    // Submit
    await page.click('button:has-text("Save Event")');
    
    // Verify dialog closes and event appears in the list
    await expect(page.locator('text="Test Event Playwright"').first()).toBeVisible({ timeout: 5000 });
  });

  test('should show validation error for invalid Luma URL', async ({ page }) => {
    // 1. Visit Login
    await page.goto("/login");
    
    // 2. Input Password and submit
    await page.fill('input[type="password"]', "TEGmoney");
    await page.click('button[type="submit"]');
    
    // 3. Confirm redirected to today
    await expect(page).toHaveURL(/\/today/);

    // 4. Go to Events via sidebar
    const link = page.locator("aside").getByRole("link", { name: "Events", exact: true });
    await link.click();
    await expect(page).toHaveURL(/\/events/);
    
    // Open Add Event dialog
    await page.click('button:has-text("Add Event")');
    
    // Fill the form with invalid URL
    await page.fill('input[placeholder="e.g. Bits & Pretzels 2026"]', 'Test Event Invalid URL');
    await page.fill('input[type="date"]', '2026-06-26');
    await page.fill('input[placeholder="https://lu.ma/..."]', 'invalid-url');
    
    // Click Save Event
    await page.click('button:has-text("Save Event")');
    
    // The dialog should still be open, and the input should be marked invalid
    const urlInput = page.locator('input[placeholder="https://lu.ma/..."]');
    const isInvalid = await urlInput.evaluate((el: HTMLInputElement) => !el.checkValidity());
    expect(isInvalid).toBe(true);
    
    // Confirm that the dialog is still visible
    await expect(page.locator('text="Add Target Event"')).toBeVisible();
  });
});
