import { test, expect } from '@playwright/test';

const SITE_URL = 'https://app.associateattorney.ai';
// const SITE_URL = 'http://localhost';

test('Task add to archive test', async ({ page }) => {
    // First login
    await page.goto(`${SITE_URL}/login`); 
    await page.fill('input[type="email"]','soumen+040225@grmtech.com'); 
    await page.fill('input[type="password"]', 'jaikalima99'); 
    await page.click('.submit-button'); 
    await page.waitForURL(`${SITE_URL}/all-workspaces/dashboard`);

    // Navigate to the tasks page
    await page.goto(`${SITE_URL}/single-workspace/3/tasks`); 
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(`${SITE_URL}/single-workspace/3/tasks`);
    
    // Wait for the tasks hierarchy to be visible
    await expect(page.locator('.tasks-hierarchy')).toBeVisible();
    
    // Find the first task card and wait for it to be visible
    const taskCard = page.locator('.tasks-hierarchy .task-card').first();
    await expect(taskCard).toBeVisible();

    // Hover over the task card to make action icons visible
    await taskCard.hover();

    // Wait for and click the delete icon in the hover actions
    const deleteIcon = taskCard.locator('.hover-actions .action-icon.delete');
    await expect(deleteIcon).toBeVisible();
    await deleteIcon.click();

    // Verify success message
    await expect(page.locator('.el-message--success')).toBeVisible();
});
