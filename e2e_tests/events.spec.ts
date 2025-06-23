import { test, expect } from '@playwright/test';

const SITE_URL = 'https://app.aiworkspace.pro';
//const SITE_URL = 'http://localhost';

test('Event Creation test', async ({ page }) => {
    // First login
    await page.goto(`${SITE_URL}/login`); 
    await page.fill('input[type="email"]','soumen+040225@grmtech.com'); 
    await page.fill('input[type="password"]', 'jaikalima99'); 
    await page.click('.submit-button'); 
    await page.waitForURL(`${SITE_URL}/all-workspaces/dashboard`);

    // Generate random 6-digit numbers for title and description
    const randomNumber = parseInt(new Date().getTime().toString().slice(-6));
    const eventTitle = `Test Event Title ${randomNumber}`;
    const eventDescription = `This is a test event description ${randomNumber}`;

    // Navigate to the tasks page
    await page.goto(`${SITE_URL}/single-workspace/3/events`); 
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(`${SITE_URL}/single-workspace/3/events`);
    
    // Click the New Event button to open the create event dialog
    await page.click('button:has-text("New Event")');
    
    // Verify the Create New Event dialog is visible
    await expect(page.locator('.create-event-dialog')).toBeVisible();

    // Fill in the task title with random number
    await page.fill('.create-event-dialog input', eventTitle);

    // Fill in the task description with random number using TipTap editor
    await page.locator('.create-event-dialog textarea').fill(eventDescription);

    // Select the event type
    await page.locator('.create-event-dialog .event-type-select').click();
    await page.waitForSelector('.el-select-dropdown__list', { state: 'visible' });
    await page.locator('.el-select-dropdown__list li:has-text("Meeting")').click();

    // Click to open the start time picker
    await page.locator('.create-event-dialog .start-time-picker').click();

    // Wait for the date picker to be visible
    await page.waitForSelector('.el-picker-panel', { state: 'visible' });

    // Fill the start time directly
    await page.fill('.create-event-dialog .start-time-picker input', '2025-02-07 10:00:00');
    
    // Fill the end time directly
    await page.fill('.create-event-dialog .end-time-picker input', '2025-02-07 11:00:00');

    // Select the location
    await page.fill('.create-event-dialog .location-input input', 'Test Location');

    // Click the Create button
    await page.click('.create-event-dialog .dialog-footer button:has-text("Create")');
    await page.waitForLoadState('networkidle');

    // Wait for the dialog to close and verify success message
    await expect(page.locator('.create-event-dialog')).not.toBeVisible();
    await expect(page.locator('.el-message--success')).toBeVisible();

    // Verify the task appears in the tasks hierarchy
    //await expect(page.locator('.tasks-hierarchy .task-card')).toBeVisible();
    const eventInList = page.locator('.events-hierarchy .event-title', { hasText: eventTitle });
    await expect(eventInList).toBeVisible();
});
