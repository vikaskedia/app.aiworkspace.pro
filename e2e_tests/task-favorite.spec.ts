import { test, expect } from '@playwright/test';

const SITE_URL = 'https://app.associateattorney.ai';
// const SITE_URL = 'http://localhost';

test('Task add to favorite test', async ({ page }) => {
    // First login
    await page.goto(`${SITE_URL}/login`); 
    await page.fill('input[type="email"]','soumen+040225@grmtech.com'); 
    await page.fill('input[type="password"]', 'jaikalima99'); 
    await page.click('.submit-button'); 

    await page.waitForURL(`${SITE_URL}/all-matters/dashboard`);


    // Navigate to the tasks page
    await page.goto(`${SITE_URL}/single-workspace/3/tasks`); 
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(`${SITE_URL}/single-workspace/3/tasks`);
    
     // Wait for the tasks hierarchy to be visible
     await expect(page.locator('.tasks-hierarchy')).toBeVisible();
     
     // Find and right-click the specific task
     //const taskTitleLocator = page.locator('.tasks-hierarchy .task-card .task-title', { hasText: taskTitle });
     const taskTitleLocator = page.locator('.tasks-hierarchy .task-card .task-title').first();
     await expect(taskTitleLocator).toBeVisible();
     await taskTitleLocator.click({ button: 'right' });
     
     await page.waitForLoadState('networkidle');

     await page.click('.el-icon.star-icon');
     await expect(page.locator('.el-message--success')).toBeVisible();

});
