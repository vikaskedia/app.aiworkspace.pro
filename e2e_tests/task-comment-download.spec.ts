import { test, expect } from '@playwright/test';
import { first } from 'lodash';

const SITE_URL = 'https://app.aiworkspace.pro';
// const SITE_URL = 'http://localhost';

test('Task comment download test', async ({ page }) => {
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
    
    // Find and right-click the specific task
    const taskTitleLocator = page.locator('.tasks-hierarchy .task-card .task-title').first();
    await expect(taskTitleLocator).toBeVisible();
    await taskTitleLocator.click({ button: 'right' });
    
    await page.waitForLoadState('networkidle');

    // Type the comment text
    const tiptapEditor = page.locator('.tiptap');
    await tiptapEditor.click();
    await page.keyboard.type('This is a test comment');

    // Click the "Add Comment" button
    await page.click('button:has-text("Add Comment")');
    await page.waitForLoadState('networkidle');

    // Verify the comment is added successfully
    await expect(page.locator('.el-message--success')).toBeVisible();

    // Find and verify the comment item
    const commentItem = page.locator('.task-comments-section .comments-list .comment-item').first();
    await expect(commentItem).toBeVisible();

    const cidValue = await commentItem.evaluate((element) => {
        const classList = Array.from(element.classList);
        const cidClass = classList.find(className => className.startsWith('cid-'));
        return cidClass ? cidClass.replace('cid-', '') : null;
    });

    // Click on the comment actions dropdown
    const commentActions = commentItem.locator('.comment-actions .el-dropdown');
    await expect(commentActions).toBeVisible();
    await commentActions.click();

    // Verify PDF download link is visible in the dropdown
    const pdfLink = page.locator(`.download-pdf-item-${cidValue}`);
    await expect(pdfLink).toBeVisible();
    await pdfLink.click();

    
    // Click on the comment actions dropdown
    const commentActions2 = commentItem.locator('.comment-actions .el-dropdown');
    await expect(commentActions2).toBeVisible();
    await commentActions2.click();

    // Verify DOC download link is visible in the dropdown
    const docLink = page.locator(`.download-doc-item-${cidValue}`);
    await expect(docLink).toBeVisible();
    await docLink.click();
    // Verify success message
    //await expect(page.locator('.el-message--success')).toBeVisible();
    
});
