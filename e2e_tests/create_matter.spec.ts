import { test, expect } from '@playwright/test';

test('Create matter after login', async ({ page }) => {
    // Navigate to your login page
    await page.goto('https://app.associateattorney.ai/login');
    //await page.goto('http://localhost/login');

    // Fill in the email
    await page.fill('input[type="email"]','soumen+040225@grmtech.com');

    // Fill in the password
    await page.fill('input[type="password"]', 'jaikalima99');

    // Click the Sign In button
    await page.click('.submit-button');

    // Wait for navigation or successful login response
    await page.waitForURL('https://app.associateattorney.ai/all-matters/dashboard');
    //await page.waitForURL('http://localhost/all-matters/dashboard');

    // Verify login was successful (e.g., check if dashboard is visible)
    await expect(page).toHaveURL('https://app.associateattorney.ai/all-matters/dashboard');
    //await expect(page).toHaveURL('http://localhost/all-matters/dashboard');

    // Click the "New Matter" button
    const button = page.locator('#idOfButtonToCreateNewMatter');
    await button.waitFor({ state: 'visible', timeout: 50000 }); // Wait until button appears

    // Click the button to create a new matter
    await button.click();

    // Wait for the dialog with the specific ID to appear
    const dialog = page.locator('#idOfDialogToCreateNewMatter');
    await dialog.waitFor({ state: 'visible', timeout: 10000 });

    // Generate a unique timestamped title
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); // Format timestamp
    const matterTitle = `Sample Matter ${timestamp}`;

    // Fill in the Title field
    await page.fill('#idOfInputMatterTitle', matterTitle);

    // Fill in the Description field
    await page.fill('#idOfInputMatterDescription', 'This is a sample description for the new matter.');

    // Locate the "Create Matter" button inside the dialog
    const createButton = dialog.locator('.el-button--primary:has-text("Create Matter")');

    // Wait for the button to be enabled
    await createButton.waitFor({ state: 'visible', timeout: 5000 });

    // Click the "Create Matter" button
    await createButton.click();

    // Wait for the matter to appear in the grid
    const matterGrid = page.locator('.matters-grid');
    await matterGrid.waitFor({ state: 'visible', timeout: 10000 });

    // Verify the new matter appears in the list
    const newMatter = matterGrid.locator(`.matter-card h3:has-text("${matterTitle}")`);
    await expect(newMatter).toBeVisible();

    console.log(`✅ Matter "${matterTitle}" successfully created and found in the list.`);

});
