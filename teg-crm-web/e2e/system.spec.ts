import { test, expect } from "@playwright/test";

test.describe("TEG CRM Sidebar Navigation", () => {
  test.beforeEach(async ({ page }) => {
    // 1. Visit Login
    await page.goto("/login");
    
    // 2. Input Password and submit
    await page.fill('input[type="password"]', "TEGmoney");
    await page.click('button[type="submit"]');
    
    // 3. Confirm redirected to today
    await expect(page).toHaveURL(/\/today/);
    await expect(page.locator("h1")).toContainText("Today");
  });

  const sidebarButtons = [
    { label: "Today", url: /\/today/, expectedTitle: "Today" },
    { label: "Pending Req.", url: /\/pending-requests/, expectedTitle: "Pending Requests" },
    { label: "Enrichment", url: /\/connections/, expectedTitle: "Enrichment" },
    { label: "Write a message", url: /\/messages/, expectedTitle: "Write a message" },
    { label: "Contacts", url: /\/contacts/, expectedTitle: "Contacts" },
    { label: "Events", url: /\/events/, expectedTitle: "Events" },
    { label: "Dashboard", url: /\/dashboard/, expectedTitle: "Dashboard" },
  ];

  for (const btn of sidebarButtons) {
    test(`navigates to ${btn.label} via sidebar`, async ({ page }) => {
      const link = page.locator("aside").getByRole("link", { name: btn.label, exact: true });
      await link.click();
      await expect(page).toHaveURL(btn.url);
      await expect(page.locator("h1")).toContainText(btn.expectedTitle);
    });
  }

  test("allows selecting and editing an event entry", async ({ page }) => {
    // 1. Go to events
    const link = page.locator("aside").getByRole("link", { name: "Events", exact: true });
    await link.click();
    await expect(page).toHaveURL(/\/events/);

    // 2. Wait for at least one card to be visible and click it
    const eventCard = page.locator("main a").first();
    await expect(eventCard).toBeVisible();
    await eventCard.click();

    // 3. Confirm we are on the event detail page
    await expect(page).toHaveURL(/\/events\/[a-z0-9-]+/);

    // 4. Click on Prompts Settings tab
    const settingsTab = page.getByRole("button", { name: "Prompts Settings" });
    await settingsTab.click();

    // 5. Fill out the outreach prompt
    const outreachTextArea = page.locator('textarea[placeholder*="Hi {name}"]');
    await expect(outreachTextArea).toBeVisible();
    
    // We expect a dialog to appear when we click Save
    const dialogPromise = page.waitForEvent("dialog");

    const originalText = await outreachTextArea.inputValue();
    const testText = originalText + " (E2E Test Edit)";
    await outreachTextArea.fill(testText);

    // 6. Click Save
    await page.getByRole("button", { name: "Save Prompts Settings" }).click();

    // 7. Verify the dialog alert was triggered
    const dialog = await dialogPromise;
    expect(dialog.message()).toContain("saved successfully");
    await dialog.accept();

    // Clean up: restore original text
    const cleanupDialogPromise = page.waitForEvent("dialog");
    await outreachTextArea.fill(originalText);
    await page.getByRole("button", { name: "Save Prompts Settings" }).click();
    const cleanupDialog = await cleanupDialogPromise;
    await cleanupDialog.accept();
  });
});
