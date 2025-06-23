import { test, expect, Page } from '@playwright/test';

const getUniqueFileName = () => {
  const timestamp = Date.now();
  return `test_${timestamp}.txt`;
};

const getUniqueFolderName = () => {
  const timestamp = Date.now();
  return `Test_Folder_${timestamp}`;
};

const retryOperation = async (
  page: Page, 
  operation: () => Promise<void>, 
  maxAttempts = 5, 
  delay = 2000
) => {
  let lastError;
  
  // Add initial delay before any Git operation
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Wait for any pending Git operations
      await page.waitForTimeout(delay);
      
      await operation();
      
      // Add delay after successful operation
      await page.waitForTimeout(1000);
      return;
    } catch (error) {
      lastError = error;
      console.log(`Attempt ${attempt} failed:`, error.message);
      
      if (error.message.includes('PushRejected') || 
          error.message.includes('Git reference lock') ||
          error.message.includes('cannot lock ref')) {
        // For Git reference conflicts, use exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
      } else if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
};

test.describe('Files Component', () => {
  test.beforeEach(async ({ page }) => {
    // Increase timeout for navigation
    test.setTimeout(60000);

    // Login first
    await page.goto('https://app.aiworkspace.pro/login');
    await page.fill('input[type="email"]', 'soumen+040225@grmtech.com');
    await page.fill('input[type="password"]', 'jaikalima99');
    await page.click('.submit-button');

    // Wait for authentication to complete and session to be established
    await page.waitForResponse(response => 
      response.url().includes('/auth/v1/token') && 
      response.status() === 200
    );

    // Wait for navigation to dashboard
    await page.waitForURL('https://app.aiworkspace.pro/all-workspaces/dashboard');

    // Navigate to the files page of a matter
    await page.goto('https://app.aiworkspace.pro/single-workspace/19/files');
    
    // Wait for the files component to load and initial API call to complete
    await page.waitForSelector('.manage-files');
    await page.waitForResponse(response => 
      response.url().includes('/api/v1/repos/associateattorney') && 
      response.status() === 200
    );

    // Add this before the test
    await page.route('**/api/v1/repos/associateattorney/**', async (route) => {
      const headers = route.request().headers();
      headers['content-type'] = 'application/json';
      headers['accept'] = 'application/json';
      
      await route.continue({ headers });
    });
  });

  test('displays file list and supports basic operations', async ({ page }) => {
    // Check if the files table is visible
    await expect(page.locator('.el-table')).toBeVisible();
    
    // Test file upload
    await test.step('file upload', async () => {
      const fileName = getUniqueFileName();
      
      await retryOperation(page, async () => {
        // Wait for any previous operations to complete
        await page.waitForTimeout(2000);
        
        // Click upload button
        await page.getByRole('button', { name: 'Upload Files', exact: true }).click();
        
        // Wait for upload dialog with increased timeout
        await expect(page.locator('.el-dialog')).toBeVisible({ timeout: 30000 });
        
        // Upload file
        await page.setInputFiles('.upload-area input[type="file"]', {
          name: fileName,
          mimeType: 'text/plain',
          buffer: Buffer.from('Test content')
        });
        
        // Wait for file to appear in upload list
        await expect(page.locator('.el-upload-list__item')).toBeVisible();
        
        // Set up response promise before clicking upload
        const responsePromise = page.waitForResponse(
          response => response.url().includes('/api/v1/repos/associateattorney') &&
                     response.request().method() === 'POST'
        );
        
        // Click upload button and wait for response
        await Promise.all([
          page.getByRole('button', { name: 'Upload', exact: true }).first().click(),
          responsePromise
        ]).then(async ([_, response]) => {
          const responseText = await response.text();
          
          if (!response.ok()) {
            if (responseText.includes('PushRejected') || 
                responseText.includes('cannot lock ref')) {
              throw new Error('Upload failed due to Git reference lock');
            }
            throw new Error(`Failed to upload: ${responseText}`);
          }
        });
        
        // Wait for loading state to finish with increased timeout
        await page.waitForSelector('.el-loading-mask', { 
          state: 'hidden', 
          timeout: 60000 
        });
        
        // Wait for success message
        await expect(page.getByText('File uploaded successfully')).toBeVisible({ 
          timeout: 60000 
        });
        
        // Wait for dialog to close
        await expect(page.locator('.el-dialog')).not.toBeVisible();
        
        // Add additional wait before checking for file
        await page.waitForTimeout(2000);
        
        // Wait for table to update and file to appear
        const fileCell = page.getByRole('cell', { name: fileName }).locator('.clickable-filename');
        await expect(fileCell).toBeVisible({ timeout: 60000 });
      });
    });

    // Test file filtering
    await test.step('file filtering', async () => {
      // Open filters
      await page.getByRole('button', { name: /Filters/i }).click();
      
      // Filter by text file type
      await page.locator('.el-select').click();
      await page.getByRole('option', { name: 'Text' }).click();
      
      // Verify filtered results
      const rows = await page.locator('.el-table__row').count();
      expect(rows).toBeGreaterThan(0);
      
      // Clear filters
      await page.getByRole('button', { name: 'Clear Filters' }).click();
    });

    // Test file preview
    await test.step('file preview', async () => {
      const fileName = getUniqueFileName();
      
      // Upload a file first
      await page.getByRole('button', { name: 'Upload Files', exact: true }).click();
      await expect(page.locator('.el-dialog')).toBeVisible();
      
      await page.setInputFiles('.upload-area input[type="file"]', {
        name: fileName,
        mimeType: 'text/plain',
        buffer: Buffer.from('Test content')
      });
      
      await expect(page.locator('.el-upload-list__item')).toBeVisible();
      await page.getByRole('button', { name: 'Upload', exact: true }).first().click();
      
      // Wait for upload to complete
      await page.waitForSelector('.el-loading-mask', { state: 'hidden', timeout: 30000 });
      await expect(page.getByText('File uploaded successfully')).toHaveCount(1);
      
      // Wait for the file to appear and be clickable
      const fileCell = page.getByRole('cell', { name: fileName }).locator('.clickable-filename');
      await expect(fileCell).toBeVisible({ timeout: 30000 });
      await fileCell.click();
      
      // Verify preview pane appears
      await expect(page.locator('.preview-container')).toBeVisible();
      
      // Verify content is displayed
      await expect(page.locator('.text-preview')).toContainText('Test content');
    });
  });

  test('supports folder operations', async ({ page }) => {
    // Test folder creation
    await test.step('folder creation', async () => {
      const folderName = getUniqueFolderName();
      
      await retryOperation(page, async () => {
        // Click New Folder button
        await page.getByRole('button', { name: /New Folder/i }).click();
        
        // Wait for dialog to be visible
        await expect(page.locator('.el-dialog')).toBeVisible();
        
        // Fill in folder name
        await page.locator('input[placeholder="Enter folder name"]').fill(folderName);
        
        // Set up API request listener before clicking create
        const responsePromise = page.waitForResponse(
          response => {
            if (!response.url().includes('/api/v1/repos/associateattorney')) return false;
            if (response.request().method() !== 'POST') return false;
            return true;
          }
        );
        
        // Click Create button
        await page.locator('.create-folder-button').click();
        
        // Wait for any previous operations to complete
        await page.waitForTimeout(1000);
        
        // Wait for the API call to complete
        const response = await responsePromise;
        
        if (!response.ok()) {
          const responseText = await response.text();
          if (responseText.includes('PushRejected')) {
            throw new Error('Upload failed due to Git reference lock');
          }
          throw new Error(`Failed to create folder: ${responseText}`);
        }
        
        // Wait for loading state to finish
        await page.waitForSelector('.el-loading-mask', { 
          state: 'hidden', 
          timeout: 30000 
        });
        
        try {
          // Wait for success message
          await page.getByText('Folder created successfully').waitFor({ 
            timeout: 30000,
            state: 'visible' 
          });
        } catch (error) {
          // Check if there's a PushRejected error
          const errorVisible = await page.getByText(/PushRejected Error/).isVisible();
          if (errorVisible) {
            throw new Error('Upload failed due to Git reference lock');
          }
          throw error;
        }
        
        // Verify folder appears in list with increased timeout
        await expect(page.getByText(folderName)).toBeVisible({ timeout: 30000 });
        
        // Verify the response status
        expect(response.status()).toBe(201);
      });
    });

    // Test folder navigation
    await test.step('folder navigation', async () => {
      const folderName = getUniqueFolderName();
      
      // Create a new folder for navigation testing
      await page.getByRole('button', { name: /New Folder/i }).click();
      await page.locator('input[placeholder="Enter folder name"]').fill(folderName);
      await page.locator('.create-folder-button').click();
      
      // Wait for folder creation to complete
      await page.waitForSelector('.el-loading-mask', { state: 'hidden', timeout: 30000 });
      await expect(page.getByText('Folder created successfully')).toBeVisible({ timeout: 30000 });
      await expect(page.getByText(folderName)).toBeVisible({ timeout: 30000 });
      
      // Click into folder
      await page.getByText(folderName).click();
      
      // Wait for loading state to finish
      await page.waitForSelector('.el-loading-mask', { state: 'hidden', timeout: 30000 });
      
      // Verify breadcrumb shows current folder
      await expect(page.locator('.breadcrumbs')).toContainText(folderName);
      
      // Navigate back to root
      await page.getByText('Root').click();
      
      // Wait for loading state to finish
      await page.waitForSelector('.el-loading-mask', { state: 'hidden', timeout: 30000 });
      
      // Verify back at root
      const breadcrumb = await page.locator('.breadcrumbs').textContent();
      expect(breadcrumb).not.toContain(folderName);
    });
  });
});
