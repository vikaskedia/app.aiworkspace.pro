import { test, expect } from '@playwright/test';

const getUniqueGoalTitle = () => {
  const timestamp = Date.now();
  return `Test Goal ${timestamp}`;
};

test.describe('Goals Component', () => {
  test.beforeEach(async ({ page }) => {
    // Increase timeout for navigation
    test.setTimeout(120000);

    // Login first
    await page.goto('https://app.associateattorney.ai/login');
    await page.fill('input[type="email"]', 'soumen+040225@grmtech.com');
    await page.fill('input[type="password"]', 'jaikalima99');
    await page.click('.submit-button');

    // Wait for authentication and navigation
    await page.waitForResponse(response => 
      response.url().includes('/auth/v1/token') && 
      response.status() === 200
    );
    await page.waitForURL('https://app.associateattorney.ai/all-matters/dashboard');

    // Navigate to goals page of a matter
    await page.goto('https://app.associateattorney.ai/single-matter/19/goals');
    
    // Wait for goals component to load
    await page.waitForSelector('.el-table');
  });

  test('supports basic goal operations', async ({ page }) => {
    // Test goal creation
    await test.step('goal creation', async () => {
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

    // Test goal filtering

    // await test.step('goal filtering', async () => {
    //   // Open filters
    //   await page.getByRole('button', { name: /Filters/i }).click();
      
    //   // Filter by high priority
    //   await page.locator('.el-select').first().click();
    //   await page.getByRole('option', { name: 'High' }).click();
      
    //   // Verify filtered results
    //   const rows = await page.locator('.el-table__row').count();
    //   expect(rows).toBeGreaterThan(0);
      
    //   // Clear filters
    //   await page.getByRole('button', { name: 'Clear Filters' }).click();
    // });

    // // Test goal status update
    // await test.step('goal status update', async () => {
    //   const goalTitle = getUniqueGoalTitle();
      
    //   // Create a new goal first
    //   await page.getByRole('button', { name: 'New Goal' }).click();
    //   await page.fill('input[placeholder="Enter goal title"]', goalTitle);
    //   await page.getByRole('button', { name: 'Create Goal' }).click();
    //   await expect(page.getByText('Goal created successfully')).toBeVisible();
      
    //   // Update status to completed
    //   await page.getByText(goalTitle).click();
    //   await page.locator('.el-select').first().click();
    //   await page.getByRole('option', { name: 'Completed' }).click();
      
    //   // Verify status update
    //   await expect(page.getByText('completed')).toBeVisible();
    // });

    // // Test AI chat integration
    // await test.step('AI chat integration', async () => {
    //   // Click on a goal title to open chat
    //   await page.getByRole('cell', { name: /Test Goal/ }).first().click();
      
    //   // Verify chat panel appears
    //   await expect(page.locator('.ai-chat-panel')).toBeVisible();
      
    //   // Close chat panel
    //   await page.getByRole('button', { name: 'Close' }).click();
    //   await expect(page.locator('.ai-chat-panel')).not.toBeVisible();
    // });
  });
}); 