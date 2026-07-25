import { expect, test } from "@playwright/test";

const publicRoutes = [
  "/",
  "/artisans",
  "/map",
  "/join",
  "/client/login",
  "/artisan/login",
  "/operations/login",
  "/register",
  "/privacy",
  "/terms",
  "/refunds",
  "/accessibility",
  "/offline",
];

for (const route of publicRoutes) {
  test(`${route} stays inside the viewport`, async ({ page }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toBeVisible();

    const layout = await page.evaluate(() => {
      const root = document.documentElement;
      const brokenImages = Array.from(document.images)
        .filter((image) => image.complete && image.naturalWidth === 0)
        .map((image) => image.currentSrc || image.src);
      return {
        viewport: root.clientWidth,
        content: root.scrollWidth,
        brokenImages,
      };
    });

    expect(layout.content, `horizontal overflow on ${route}`).toBeLessThanOrEqual(
      layout.viewport + 1,
    );
    expect(layout.brokenImages, `broken images on ${route}`).toEqual([]);
  });
}

test("homepage remains composed through the sticky-search transition", async ({
  page,
  isMobile,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".hero")).toBeVisible();
  await expect(page.locator(".hero-market-card")).toBeVisible();

  await page.evaluate(() => window.scrollTo({ top: 720, behavior: "instant" }));
  await expect(page.locator(".search-dock")).toBeVisible();

  const dock = await page.locator(".search-dock").boundingBox();
  const viewport = page.viewportSize();
  expect(dock).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(dock!.x).toBeGreaterThanOrEqual(0);
  expect(dock!.x + dock!.width).toBeLessThanOrEqual(viewport!.width + 1);

  if (isMobile) {
    await expect(page.locator(".mobile-app-nav")).toBeVisible();
    await expect(page.locator(".header-live-location .location-compact")).toHaveText(
      "Near me",
    );
  } else {
    await expect(page.locator(".dock-navigation")).toBeVisible();
  }
});
