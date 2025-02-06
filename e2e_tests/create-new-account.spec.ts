import { test, expect } from '@playwright/test';

test('Create an new account with valid credentials', async ({ page }) => {
    // Navigate to your login page
    await page.goto('https://app.associateattorney.ai/login'); 

    // Click the "Sign up" link
    await page.click('text=Sign up');

    // Wait for navigation and verify URL
    await page.waitForURL('https://app.associateattorney.ai/signup');
    await expect(page).toHaveURL('https://app.associateattorney.ai/signup');

    console.log("✅ Click on the Sign Up link and redirected to signup page from login page");

    // Generate timestamp for unique email
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Fill in the full name
    await page.fill('input[placeholder="Full Name"]', `SoumenE2Etest${timestamp}`);

    // Fill in the email
    await page.fill('input[placeholder="Work Email"]', `soumen+${timestamp}@grmtech.com`);

    // Fill in the password
    await page.fill('input[placeholder="Password"]', 'jaikalima99');

    // Fill in the confirm password
    await page.fill('input[placeholder="Confirm Password"]', 'jaikalima99');

    // Click the Create Account button and wait for redirect
    await page.click('button:has-text("Create Account")');

    // Verify success message
    await expect(page.locator('.el-message--success')).toBeVisible();

    // Wait for navigation to login page and verify URL
    await page.waitForURL('https://app.associateattorney.ai/login');
    await expect(page).toHaveURL('https://app.associateattorney.ai/login');
    
    console.log(`✅ New account has been created using mailid soumen+${timestamp}@grmtech.com`);
});
