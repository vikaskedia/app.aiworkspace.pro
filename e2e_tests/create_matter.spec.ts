import { test, expect } from '@playwright/test';

test('Create workspace after login and edit it', async ({ page }) => {
    // Navigate to your login page
    await page.goto('https://app.aiworkspace.pro/login');
    //await page.goto('http://localhost/login');

    // Fill in the email
    await page.fill('input[type="email"]','soumen+040225@grmtech.com');

    // Fill in the password
    await page.fill('input[type="password"]', 'jaikalima99');

    // Click the Sign In button
    await page.click('.submit-button');

    // Wait for navigation or successful login response
    await page.waitForURL('https://app.aiworkspace.pro/all-workspaces/dashboard');
    //await page.waitForURL('http://localhost/all-workspaces/dashboard');

    // Verify login was successful (e.g., check if dashboard is visible)
    await expect(page).toHaveURL('https://app.aiworkspace.pro/all-workspaces/dashboard');
    //await expect(page).toHaveURL('http://localhost/all-workspaces/dashboard');

    // Click the "New Workspace" button
    const button = page.locator('#idOfButtonToCreateNewMatter');
    await button.waitFor({ state: 'visible', timeout: 50000 }); // Wait until button appears

    // Click the button to create a new matter
    await button.click();

    // Wait for the dialog with the specific ID to appear
    const dialog = page.locator('#idOfDialogToCreateNewMatter');
    await dialog.waitFor({ state: 'visible', timeout: 10000 });

    // Generate a unique timestamped title
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); // Format timestamp
    const matterTitle = `Sample Workspace ${timestamp}`;

    // Fill in the Title field
    await page.fill('#idOfInputMatterTitle', matterTitle);

    // Fill in the Description field
    await page.fill('#idOfInputMatterDescription', 'This is a sample description for the new matter.');

    // Locate the "Create Workspace" button inside the dialog
    const createButton = dialog.locator('.el-button--primary:has-text("Create Workspace")');

    // Wait for the button to be enabled
    await createButton.waitFor({ state: 'visible', timeout: 5000 });

    // Click the "Create Workspace" button
    await createButton.click();

    // Wait for the workspace to appear in the grid
    const matterGrid = page.locator('.workspaces-grid');
    await matterGrid.waitFor({ state: 'visible', timeout: 10000 });

    // Verify the new workspace appears in the list
    const newMatter = matterGrid.locator(`.matter-card h3:has-text("${matterTitle}")`);
    await expect(newMatter).toBeVisible();

    console.log(`✅ Workspace "${matterTitle}" successfully created and found in the list.`);

    // Locate and click the button next to the correct workspace title
    const buttonToClick = newMatter.locator('..').locator('.el-dropdown button'); // Move to parent and find button
    await buttonToClick.waitFor({ state: 'visible', timeout: 5000 });
    await buttonToClick.click();

    console.log(`✅ Workspace "${matterTitle}" created and button clicked.`);

    const ariaControlsValue = await buttonToClick.getAttribute('aria-controls');
    console.log('Dropdown aria-controls value:', ariaControlsValue);
    
    // Now we can use this ID to find the specific dropdown menu
    const viewDashboardOption = page.locator(`#${ariaControlsValue} .el-dropdown-menu__item:has-text("View Dashboard")`);
    await viewDashboardOption.waitFor({ state: 'visible', timeout: 5000 });
    await viewDashboardOption.click();

    await expect(page).toHaveURL(new RegExp('/single-workspace/\\d+/dashboard$'));
    
    console.log(`✅ Workspace "${matterTitle}" created and navigated to view dashboard`);

    // Verify in this page the workspace title is visible which is in <header> tag under matter-selector class
    const matterTitleInHeader = page.locator('header .matter-selector');
    await matterTitleInHeader.waitFor({ state: 'visible', timeout: 5000 });
    await expect(matterTitleInHeader).toHaveText(matterTitle);

    console.log(`✅ Workspace "${matterTitle}" created and navigated to view dashboard and verified the workspace title is visible`);
    
    // Click on the Dashboard section in the header
    const currentSection = page.locator('header .current-section');
    await currentSection.waitFor({ state: 'visible', timeout: 5000 });
    await expect(currentSection).toContainText('Dashboard');
    await currentSection.click();

    // Get the aria-controls value from the dropdown trigger
    const sectionAriaControls = await currentSection.getAttribute('aria-controls');
    console.log('Section dropdown aria-controls value:', sectionAriaControls);

    // Click Settings in the dropdown menu
    const settingsOption = page.locator(`#${sectionAriaControls} .el-dropdown-menu__item:has-text("Settings")`);
    await settingsOption.waitFor({ state: 'visible', timeout: 5000 });
    await settingsOption.click();

    // Verify navigation to settings page
    await expect(page).toHaveURL(new RegExp('/single-workspace/\\d+/settings$'));

    // Verify the workspace title is visible in the settings page in the first input field to edit
    const matterTitleInSettings = page.locator('.section .el-form input.el-input__inner').first();
    await matterTitleInSettings.waitFor({ state: 'visible', timeout: 5000 });
    await expect(matterTitleInSettings).toHaveValue(matterTitle);

    // Now edit the workspace title
    const currentTitle = await matterTitleInSettings.inputValue();
    await matterTitleInSettings.fill(currentTitle + ' edited');
    
    // Click on the save changes button to edit the workspace title
    const saveButton = page.locator('.section .el-button--primary:has-text("Save Changes")').first();
    await saveButton.waitFor({ state: 'visible', timeout: 5000 });
    await saveButton.click();

    // Wait for success message
    await page.waitForSelector('.el-message--success');

    // Verify the workspace title is updated
    await expect(matterTitleInHeader).toHaveText(currentTitle + ' edited');

    console.log(`✅ Workspace "${matterTitle}" created and navigated to view dashboard and verified the workspace title is visible and edited`);  
    
});
