import { expect, test } from "@playwright/test";

test("premium discovery remains usable",async({page})=>{
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator(".site-header")).toHaveCSS("position","sticky");
  await expect(page.getByRole("heading",{name:/Every home job/i})).toBeVisible();
  await expect(page.getByRole("button",{name:/Use my current location/i})).toBeVisible();
  await expect(page.getByRole("button",{name:"Use my live location"})).toBeVisible();
  const search=page.getByPlaceholder(/plumber/i);
  await search.fill("Plumbing");
  await expect(search).toHaveValue("Plumbing");
  const close=page.locator(".hero .predictive-close");
  await expect(close).toBeVisible();
  await close.click();
  await expect(page.locator(".hero .predictive-results")).toBeHidden();
});

test("mobile menu exposes the complete brand and navigation",async({page,isMobile})=>{
  test.skip(!isMobile);
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator(".site-header")).toHaveCSS("position","sticky");
  await expect(page.getByText("Mafundi Mtaani",{exact:false}).first()).toBeVisible();
  const toggle=page.locator(".mobile-menu-button");
  await toggle.click();
  await expect(page.getByRole("link",{name:"Services",exact:true})).toBeVisible();
  await expect(page.locator(".site-header nav")).toHaveCSS("z-index","70");
  await expect(toggle).toHaveAttribute("aria-expanded","true");
});

test("role portals stay separated",async({page})=>{
  await page.goto("/artisan/login",{waitUntil:"domcontentloaded"});
  await expect(page.getByText("Artisan portal")).toBeVisible();
  await page.goto("/operations/login",{waitUntil:"domcontentloaded"});
  await expect(page.getByText("Operations portal")).toBeVisible();
});

test("map offers live location instead of a fixed estate",async({page})=>{
  await page.goto("/map",{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("button",{name:/follow my live location/i})).toBeVisible();
  await expect(page.getByText("Selected area")).toBeVisible();
});

test("artisan directory supports proof-based browsing",async({page})=>{
  await page.goto("/artisans",{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{name:/Choose the right artisan/i})).toBeVisible();
  await expect(page.getByPlaceholder("Trade, name or skill")).toBeVisible();
  await expect(page.getByLabel("Minimum rating")).toBeVisible();
  await expect(page.getByLabel("Minimum experience")).toBeVisible();
});

test("iOS keeps service controls dark",async({page,isMobile,browserName})=>{
  test.skip(!isMobile||browserName!=="webkit");
  await page.goto("/",{waitUntil:"domcontentloaded"});
  const card=page.locator(".category-card").first();
  await expect(card).toHaveCSS("color","rgb(10, 12, 10)");
  await expect(card.locator("svg").first()).toHaveCSS("stroke","rgb(10, 12, 10)");
});
