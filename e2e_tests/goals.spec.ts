import { test, expect } from '@playwright/test';

const SITE_URL = 'https://app.associateattorney.ai';
//const SITE_URL = 'http://localhost';

const getUniqueGoalTitle = () => {
  const timestamp = Date.now();
  return `Test Goal ${timestamp}`;
};

test.describe('Goals Component', () => {

  test.beforeEach(async ({ page }) => {
    // Increase timeout for navigation
    test.setTimeout(60000);

    // Login first
    await page.goto(`${SITE_URL}/login`);
    await page.fill('input[type="email"]', 'soumen+040225@grmtech.com');
    await page.fill('input[type="password"]', 'jaikalima99');
    await page.click('.submit-button');
    // Wait for authentication and navigation
    await page.waitForResponse(response => 
      response.url().includes('/auth/v1/token') && 
      response.status() === 200
    );
    await page.waitForURL(`${SITE_URL}/all-matters/dashboard`);

    // Navigate to goals page of a matter
    await page.goto(`${SITE_URL}/single-matter/19/goals`);
    // Wait for goals component to load
    await page.waitForSelector('.el-table');
  });

  test('Goals operations', async ({ page }) => {

    // Test goal creation
    await test.step('Create a new goal and generate AI tasks', async () => {
      const goalTitle = getUniqueGoalTitle();
      
      // Click New Goal button
      await page.getByRole('button', { name: 'New Goal' }).click();
      
      // Wait for dialog
      await expect(page.locator('.el-dialog')).toBeVisible();
      // Fill goal details using new class names
      await page.fill('.el-input input[placeholder="Enter goal title"]', goalTitle);
      await page.locator('.goal-description-input textarea').fill('Test goal description');
      await page.locator('.goal-status-input').click();
      await page.getByRole('option', { name: 'In Progress' }).click();
      await page.locator('.goal-priority-input').click();
      await page.getByRole('option', { name: 'High' }).click();
      
      // Create goal and wait for API response with increased timeout
      await Promise.all([
        page.waitForResponse(
          response => response.url().includes('/rest/v1/goals') && response.status() === 201,
          { timeout: 10000 }
        ),
        page.locator('.goal-create-button').click()
      ]);
      
      // Wait for success message with increased timeout
      await expect(page.getByText('Goal created successfully')).toBeVisible({ timeout: 10000 });

      // Wait for AI task suggestion dialog with increased timeout
      await expect(page.locator('.el-dialog').filter({ hasText: 'Select Tasks to Create' })).toBeVisible({ timeout: 60000 });
      await expect(page.getByText('The AI has suggested the following tasks to achieve your goal:')).toBeVisible();

      // Wait for task suggestions to load and be interactive
      await page.waitForSelector('.task-suggestion', { timeout: 60000, state: 'attached' });
      await page.waitForTimeout(2000); // Give extra time for Vue to bind events

      // Wait for checkbox group to be ready
      await page.waitForSelector('.el-checkbox-group', { timeout: 10000 });

      // Click the task suggestion div first
      await page.locator('.task-suggestion').first().click();
      
      // Wait for checked state with increased timeout
      await expect(page.locator('.task-suggestion .el-checkbox.is-checked')).toBeVisible({ 
        timeout: 10000 
      });

      // Click create selected tasks button and wait for API response
      await Promise.all([
        page.waitForResponse(response => 
          response.url().includes('/rest/v1/tasks') && 
          response.status() === 201
        ),
        page.getByRole('button', { name: 'Create Selected Tasks' }).click()
      ]);

      // Verify tasks created successfully
      await expect(page.getByText('Tasks created successfully')).toBeVisible();
    });

    await test.step('Edit Goal Title', async () => {
      // Navigate to goals page
      //await page.goto(`${SITE_URL}/single-matter/19/goals`);
        
          // Wait for goals table to be visible
      await page.waitForSelector('.el-table');
      
      // Hover over the title to reveal edit icon
      const titleContainer = page.locator('.el-table .el-table_1_column_1 .editable-field').first();
      await titleContainer.hover();
      
      // Click the edit icon
      const editIcon = titleContainer.locator('.edit-icon');
      await editIcon.click();
      
      // Generate new title
      const goalTitle = getUniqueGoalTitle();
      
      // Find and fill the input field
      const titleInput = page.locator('.el-table .el-table_1_column_1 .el-input input[type="text"]').first();
      await titleInput.fill(goalTitle + ' - edited');
      
      // Press Enter to save
      await titleInput.press('Enter');
      
      // Wait for success message
      //await expect(page.locator('.el-message--success')).toBeVisible();

    });

    await test.step('Edit Goal Description', async () => {
      // Navigate to goals page
      //await page.goto(`${SITE_URL}/single-matter/19/goals`);
        
          // Wait for goals table to be visible
      await page.waitForSelector('.el-table');
      
      // Hover over the title to reveal edit icon
      const titleContainer = page.locator('.el-table .el-table_1_column_2 .editable-field').first();
      await titleContainer.hover();
      
      // Click the edit icon
      const editIcon = titleContainer.locator('.edit-icon');
      await editIcon.click();
      
      // Generate new description
      const goalDescription = getUniqueGoalTitle();

      // Find and fill the input field
      const descriptionInput = page.locator('.el-table .el-table_1_column_2 .el-textarea textarea').first();
      await descriptionInput.fill(goalDescription + ' description - edited');

       // Click Save button
      await page.locator('.el-table .el-table_1_column_2 .el-button--primary').first().click(); 


      // Wait for success message
      //await expect(page.locator('.el-message--success')).toBeVisible();

    });

    await test.step('Edit Goal Status', async () => {
      // Navigate to goals page
      //await page.goto(`${SITE_URL}/single-matter/19/goals`);
        
          // Wait for goals table to be visible
      await page.waitForSelector('.el-table');
      
      // Find and click the status tag in the third column
      const statusTag = page.locator('.el-table .el-table_1_column_3 .el-tag').first();
      await statusTag.click();
      
       // Wait for and find the visible dropdown
       const visibleDropdown = page.locator('.el-popper[aria-hidden="false"]');
       await visibleDropdown.waitFor({ state: 'visible' });
       
       // Click "Not Started" option within the visible dropdown
       await visibleDropdown.locator('.status-option', { hasText: 'Not Started' }).click();
      
      // Wait for success message
      //await expect(page.locator('.el-message--success')).toBeVisible();

    });

    await test.step('Edit Goal Priority', async () => {
      // Navigate to goals page
      //await page.goto(`${SITE_URL}/single-matter/19/goals`);
        
          // Wait for goals table to be visible
      await page.waitForSelector('.el-table');
      
      // Find and click the status tag in the third column
      const priorityTag = page.locator('.el-table .el-table_1_column_4 .el-tag').first();
      await priorityTag.click();
      

       // Wait for and find the visible dropdown
       const visibleDropdown = page.locator('.el-popper[aria-hidden="false"]');
       await visibleDropdown.waitFor({ state: 'visible' });
       
       // Click "Not Started" option within the visible dropdown
       await visibleDropdown.locator('.status-option', { hasText: 'Low' }).click();
      

      // Wait for success message
      //await expect(page.locator('.el-message--success')).toBeVisible();

    });

    await test.step('Edit Goal Due Date', async () => {
  
      // Navigate to goals page
      //await page.goto(`${SITE_URL}/single-matter/19/goals`);
        
          // Wait for goals table to be visible
      await page.waitForSelector('.el-table');
      
      // Find and click the status tag in the third column
      const dueDateTag = page.locator('.el-table .el-table_1_column_5 .editable-field').first();
      await dueDateTag.click();
      
       // Wait for and find the visible dropdown
       const visibleDropdown = page.locator('.el-popper[aria-hidden="false"]');
       await visibleDropdown.waitFor({ state: 'visible' });
       
       // Click "Not Started" option within the visible dropdown
       await visibleDropdown.locator('.due-date-editor .el-input input[type="text"]').click();

       const visibleCalendarDropdown = page.locator('.el-popper.el-picker__popper[aria-hidden="false"]');
       await visibleCalendarDropdown.waitFor({ state: 'visible' });

       // Click on the date 2025-02-15 
       await visibleCalendarDropdown.locator('.el-date-table td').nth(25).click();

      // Wait for success message
      //await expect(page.locator('.el-message--success')).toBeVisible();

    });

    await test.step('Edit Goal Progress', async () => {
      // Navigate to goals page
      //await page.goto(`${SITE_URL}/single-matter/19/goals`);
        
      // Wait for goals table to be visible
      await page.waitForSelector('.el-table');
      
      // Find and click the status tag in the third column
      const progressTag = page.locator('.el-table .el-table_1_column_6 .el-progress').first();
      await progressTag.click();
      

       // Wait for and find the visible dropdown
       const visibleDropdown = page.locator('.el-popper[aria-hidden="false"]');
       await visibleDropdown.waitFor({ state: 'visible' });
       
       // Generate random index between 0 and 4 (inclusive)
      const randomIndex = Math.floor(Math.random() * 5);
      // Click on the progress bar 
      await visibleDropdown.locator('.el-slider__marks-stop').nth(randomIndex).click();

      // Wait for success message
      //await expect(page.locator('.el-message--success')).toBeVisible();

    });

    await test.step('Add Goal Comment', async () => {
    
      // Navigate to goals page
      //await page.goto(`${SITE_URL}/single-matter/19/goals`);
        
      // Wait for goals table to be visible
      await page.waitForSelector('.el-table');
      
      // Hover over the title to reveal edit icon
      const titleContainer = page.locator('.el-table .el-table_1_column_1 .clickable-title').first();
      await titleContainer.click();

      // Wait for the drawer to be visible
      await expect(page.locator('.el-drawer.open')).toBeVisible();

      const commentDrawer = page.locator('.el-drawer.open .el-drawer__body');

      await commentDrawer.locator('.el-textarea textarea').click();

      await commentDrawer.locator('.el-textarea textarea').fill('This is a test comment');

      await commentDrawer.locator('.el-button--primary').click();

      // Wait for success message
      //await expect(page.locator('.el-message--success')).toBeVisible();
    
    });
    
  });


  
    

}); 