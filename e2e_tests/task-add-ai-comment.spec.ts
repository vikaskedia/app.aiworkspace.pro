import { test, expect } from '@playwright/test';

const SITE_URL = 'https://app.associateattorney.ai';
//const SITE_URL = 'http://localhost';

test('Task ai comment test', async ({ page }) => {

    // Increase test timeout to 2 minutes
    test.setTimeout(120000);
    
    // First login
    await page.goto(`${SITE_URL}/login`); 
    await page.fill('input[type="email"]','soumen+040225@grmtech.com'); 
    await page.fill('input[type="password"]', 'jaikalima99'); 
    await page.click('.submit-button'); 
    await page.waitForURL(`${SITE_URL}/all-matters/dashboard`);
   
     // Navigate to the tasks page
     await page.goto(`${SITE_URL}/single-matter/3/tasks`); 
     await page.waitForLoadState('networkidle');
     await expect(page).toHaveURL(`${SITE_URL}/single-matter/3/tasks`);

     // Wait for the tasks hierarchy to be visible
     await expect(page.locator('.tasks-hierarchy')).toBeVisible();
     
     // Find and right-click the specific task
     //const taskTitleLocator = page.locator('.tasks-hierarchy .task-card .task-title', { hasText: taskTitle });
     const taskTitleLocator = page.locator('.tasks-hierarchy .task-card .task-title').first();
     await expect(taskTitleLocator).toBeVisible();
     await taskTitleLocator.click({ button: 'right' });
     
     await page.waitForLoadState('networkidle');
     // Type the AI command in tiptap editor
     const tiptapEditor = page.locator('.tiptap');
     await tiptapEditor.click();
     //await page.keyboard.type('@');
     //await page.keyboard.type('@Eleanor show us california law rules');
     // Insert the formatted AI mention HTML
    // await tiptapEditor.evaluate((element) => {
    //     const mentionHtml = '@Eleanor show us california law rules';
    //     element.innerHTML = mentionHtml;
    // });


    // Type @ to trigger mention popup
    await page.keyboard.type('@');
    
    // Wait for mention popup to appear
    await page.waitForSelector('.mention-popup');
    
    // Type the name to filter
    await page.keyboard.type('Eleanor');
    
    // Wait for filtered suggestions
    await page.waitForTimeout(500); // Wait for debounce
    
    // Click the suggestion for Eleanor
    await page.click('.mention-item:has-text("Eleanor")');
    
    // Type the rest of the message
    await page.keyboard.type(' show us california law rules');

    //await page.waitForTimeout(10000);

     // Click the "Add Comment" button
    await page.click('button:has-text("Add Comment")');

    // Wait for the success message
    //await expect(page.locator('.el-message--success')).toBeVisible();

    await page.waitForLoadState('networkidle');

    // Wait for AI response with longer timeout since it can take time
    const aiResponseComment = page.locator('.comment-item.ai-response').first();
    await expect(aiResponseComment).toBeVisible({ timeout: 60000 }); // 60 second timeout

    // Verify Eleanor's name appears in the AI response
    const aiAuthorName = aiResponseComment.locator('.comment-author');
    await expect(aiAuthorName).toContainText('Eleanor', { timeout: 60000 });

    // const commentItem = page.locator('.task-comments-section .comments-list .comment-item.ai-response').first();
    // await expect(commentItem).toBeVisible();

});