import { test, expect } from '@playwright/test';

test('Talk-to-Dev new topic creation and verification', async ({ page }) => {
    console.log("Initialize test for Talk-to-Dev");
    
    await page.goto('https://app.associateattorney.ai/login'); 
    await page.fill('input[type="email"]', 'soumen+040225@grmtech.com');
    await page.fill('input[type="password"]', 'jaikalima99');
    await page.click('.submit-button');

    // Wait for navigation to the dashboard
    await page.waitForURL('https://app.associateattorney.ai/all-workspaces/dashboard');
    await expect(page).toHaveURL('https://app.associateattorney.ai/all-workspaces/dashboard');

    // Hover over the dropdown container in the header.
    await page.hover('header .header-right .el-dropdown');

    // Wait for the dropdown menu item "Talk to Dev" to be visible
    const talkToDevItem = page.locator('text=Talk to Dev');
    await expect(talkToDevItem).toBeVisible();

    // Click the "Talk to Dev" menu item
    await talkToDevItem.click();

    // Wait for navigation to the Talk-to-Dev page
    await page.waitForURL('https://app.associateattorney.ai/talk-to-dev');
    await expect(page).toHaveURL('https://app.associateattorney.ai/talk-to-dev');

    // Verify that the header contains the text "Talk to Dev"
    const header = page.locator('header .header-center');
    await expect(header).toContainText('Talk to Dev');

    // Locate the "Create New Topic" button and click it
    const createNewTopicButton = page.locator('button:has-text("Create New Topic")');
    await expect(createNewTopicButton).toBeVisible();
    await createNewTopicButton.click();

    // 4. Wait for the "Create New Topic" dialog to appear
    const dialog = page.locator('.el-dialog.new-topic-dialog');
    await expect(dialog).toBeVisible();

    // 5. Fill in the Title field
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await page.fill('input[placeholder="Enter topic title"]', `My Topic Title at ${timestamp}`);

    // 6. Fill in the Description field (this is a contenteditable div)
    await page.fill('div.tiptap.ProseMirror[contenteditable="true"]', `This is my topic description at ${timestamp}.`);

    // 7. Wait for the "Create Topic" button to become enabled and then click it
    const createTopicButton = dialog.locator('footer button:has-text("Create Topic")');

    // Wait until the button is not in a loading state and is enabled.
    await page.waitForFunction(() => {
        const btn = document.querySelector('.el-dialog.new-topic-dialog footer button') as HTMLButtonElement;
        return btn && !btn.disabled && !btn.classList.contains('is-loading');
    }, { timeout: 10000 });
    await createTopicButton.click();

    // Wait for success message
    await page.waitForSelector('.el-message--success');

    // 7. Verify the new topic appears in the topics list
    const firstTopicTitle = page.locator('.topics-list .topic-title h3').first();
    await expect(firstTopicTitle).toHaveText(`My Topic Title at ${timestamp}`);

    console.log(`✅ New topic created named 'My Topic Title at ${timestamp}'`);

    // Click on the first topic in the list
    await firstTopicTitle.click();

    // Wait for the topic details page to load and verify the title
    await page.waitForSelector('.topic-header h2');
    const topicHeaderTitle = await page.locator('.topic-header h2').textContent();
    expect(topicHeaderTitle).toBe(`My Topic Title at ${timestamp}`);

    // Add a reply
    const replyText = `This is a test reply at ${timestamp}`;
    await page.fill('.reply-input .tiptap.ProseMirror[contenteditable="true"]', replyText);
    
    // Click Add Reply button
    const addReplyButton = page.locator('.reply-input button:has-text("Add Reply")');
    await expect(addReplyButton).toBeEnabled();
    await addReplyButton.click();

    // Wait for success message
    await page.waitForSelector('.el-message--success');

    console.log('✅ Topic details verified and reply added successfully');
});