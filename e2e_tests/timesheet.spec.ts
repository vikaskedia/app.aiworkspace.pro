import { test, expect } from '@playwright/test';

const SITE_URL = 'https://app.aiworkspace.pro'; 
// const SITE_URL = 'http://localhost'; 

test('Time log addition working', async ({ page }) => {
    // First login
    await page.goto(`${SITE_URL}/login`);
    await page.fill('input[type="email"]','soumen+040225@grmtech.com');
    await page.fill('input[type="password"]', 'jaikalima99');
    await page.click('.submit-button');
    await page.waitForURL(`${SITE_URL}/all-workspaces/dashboard`);

    // Navigate to specific task page
    await page.goto(`${SITE_URL}/single-workspace/3/tasks/58`);
    await page.waitForLoadState('networkidle');

    // Click the log hours button and wait for dialog
    await page.click('button.log-hours-btn');
    await page.waitForSelector('.log-hours-dialog');

    // Fill in the time inputs and trigger validation
    const hoursInput = page.locator('.time-input-group input[placeholder="HH"]');
    await hoursInput.fill('02');
    await hoursInput.press('Tab'); // Use Tab to trigger blur event

    const minutesInput = page.locator('.time-input-group input[placeholder="MM"]');
    await minutesInput.fill('30');
    await minutesInput.press('Tab'); // Use Tab to trigger blur event

    // Add a unique comment that we can identify
    const testComment = `E2E Test Entry - ${new Date().toISOString()}`;
    await page.fill('.log-hours-dialog textarea', testComment);

    // Wait for and click the submit button
    const submitButton = page.locator('.dialog-footer .el-button--primary');
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    // Wait for success message
    await page.waitForSelector('.el-message--success');

    // Wait for hours logs section and verify entry
    await page.waitForSelector('.hours-logs');
    
    // Get the first row of the hours table (most recent entry)
    const firstRow = page.locator('.hours-table .hours-table-row').first();
    
    // Check if our time entry appears in the first row
    const timeCell = firstRow.locator('text=2h 30m');
    await expect(timeCell).toBeVisible();

    // Check if our comment appears in the first row
    const commentCell = firstRow.locator(`text=${testComment}`);
    await expect(commentCell).toBeVisible();
});
