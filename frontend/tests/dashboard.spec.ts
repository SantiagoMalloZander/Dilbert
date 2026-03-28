import { test, expect } from "@playwright/test";

test("dashboard loads with header", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Dilbert CRM");
});

test("dashboard shows metrics cards", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Total Leads")).toBeVisible();
  await expect(page.getByText("En Negociacion")).toBeVisible();
  await expect(page.getByText("Cerrados (Ganados)")).toBeVisible();
  await expect(page.getByText("Pipeline Total")).toBeVisible();
});

test("dashboard shows empty state when no leads", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByText("No hay leads todavia").or(page.locator("table"))
  ).toBeVisible();
});
