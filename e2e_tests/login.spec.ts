import { test, expect } from '@playwright/test';

test('Login test with valid credentials', async ({ page }) => {
    // Navigate to your login page
    await page.goto('https://app.associateattorney.ai/login'); 

    // Fill in the email
    await page.fill('input[type="email"]','soumen+040225@grmtech.commmmm');

    // Fill in the password
    await page.fill('input[type="password"]', 'jaikalima99mmmm');

    // Click the Sign In button
    await page.click('.submit-button');

    // Wait for navigation or successful login response
    await page.waitForURL('https://app.associateattorney.ai/all-matters/dashboard');

    // Verify login was successful (e.g., check if dashboard is visible)
    await expect(page).toHaveURL('https://app.associateattorney.ai/all-matters/dashboard');
});
