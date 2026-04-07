import { test, expect } from "@playwright/test";

test("landing redirects from root and shows hero", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/landing\.html$/);
  await expect(page.locator("h1")).toContainText("DILBERT");
});

test("landing exposes primary CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".hero-cta .btn-pill").first()).toBeVisible();
  await expect(page.locator(".hero-chips .chip").first()).toBeVisible();
});

test("landing keeps booking navigation visible", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("nav .btn-pill")).toBeVisible();
  await expect(page.locator(".hero-cta .btn-ghost")).toBeVisible();
});
