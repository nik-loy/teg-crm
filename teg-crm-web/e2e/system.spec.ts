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
    { label: "Enrichment", url: /\/enrichment/, expectedTitle: "Enrichment" },
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

  test("allows selecting and editing an event entry and verifies leads", async ({ page }) => {
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

    // 4. Verify that leads are correctly entered for this event
    const leadsTab = page.getByRole("button", { name: /Leads \(\d+\)/ });
    await leadsTab.click();
    // Default seed data includes "John Doe" and "Jane Roe"
    await expect(page.locator("text=John Doe").first()).toBeVisible();
    await expect(page.locator("text=Jane Roe").first()).toBeVisible();

    // 5. Click on Prompts Settings tab
    const settingsTab = page.getByRole("button", { name: "Prompts Settings" });
    await settingsTab.click();

    // 6. Fill out the outreach prompt
    const outreachTextArea = page.locator('textarea[placeholder*="Hi {name}"]');
    await expect(outreachTextArea).toBeVisible();
    
    // We expect a dialog to appear when we click Save
    const dialogPromise = page.waitForEvent("dialog");

    const originalText = await outreachTextArea.inputValue();
    const testText = originalText + " (E2E Test Edit)";
    await outreachTextArea.fill(testText);

    // 7. Click Save
    await page.getByRole("button", { name: "Save Prompts Settings" }).click();

    // 8. Verify the dialog alert was triggered
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

  test("triggers Export Leads download", async ({ page }) => {
    // Start waiting for download before clicking
    const downloadPromise = page.waitForEvent('download');
    
    // Click the Export Leads button in the sidebar
    const exportBtn = page.locator("aside").getByRole("button", { name: "Export Leads" });
    await exportBtn.click();
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("leads_export.xlsx");
  });
});


