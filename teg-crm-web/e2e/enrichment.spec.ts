import { test, expect } from "@playwright/test";

test.describe("Enrichment System Test", () => {
  test("enrich a contact and verify rating score and rationale", async ({ page }) => {
    // 1. Visit Login
    await page.goto("/login");
    
    // 2. Input Password and submit
    await page.fill('input[type="password"]', "TEGmoney");
    await page.click('button[type="submit"]');
    
    // 3. Confirm redirected to today
    await expect(page).toHaveURL(/\/today/);

    // 4. Go to Contacts via sidebar
    const link = page.locator("aside").getByRole("link", { name: "Contacts", exact: true });
    await link.click();
    await expect(page).toHaveURL(/\/contacts/);

    // 5. Open Enrich Profile Dialog
    await page.getByRole("button", { name: "Enrich Profile", exact: true }).click();

    // 6. Fill in the textarea with test profile data for Jane Roe
    const profileText = `Jane Roe
Software Engineer at NextGen
London, UK
I have 10 years of experience with React and AI, focusing on scalable agentic pipelines.`;
    await page.locator('textarea').fill(profileText);

    // Wait for the CRM database search to finish and show match
    await expect(page.locator("text=Matched: Jane Roe")).toBeVisible({ timeout: 10000 });

    // 7. Click Enrich Profile submit button inside the dialog
    // The button in the footer
    await page.getByRole("dialog").getByRole("button", { name: "Enrich Profile", exact: true }).click();

    // 8. Wait for the dialog to disappear, indicating success
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 20000 });

    // 9. Now we are back in the contacts table. Search for Jane Roe
    const searchInput = page.locator('input[placeholder="Search name…"]');
    await searchInput.fill('Jane Roe');
    await searchInput.press('Enter');

    // 10. Verify that Jane Roe's row has a rating score and rationale
    const row = page.locator('tr', { hasText: 'Jane Roe' }).first();
    
    // The rating score should be visible (e.g., ⭐ 5/5)
    await expect(row.locator('text=⭐')).toBeVisible({ timeout: 5000 });
    
    // The rationale is in the last column, verify it's not the default "—"
    const rationaleText = await row.locator('td').nth(4).innerText();
    expect(rationaleText).not.toBe("—");
    expect(rationaleText.length).toBeGreaterThan(5);
  });
});
