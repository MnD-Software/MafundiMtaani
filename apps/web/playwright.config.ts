import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir:"./tests/e2e", timeout:60_000, workers:1, retries:process.env.CI?2:0,
  use:{baseURL:process.env.PLAYWRIGHT_BASE_URL||"http://127.0.0.1:3012",trace:"retain-on-failure",screenshot:"only-on-failure"},
  webServer:process.env.PLAYWRIGHT_BASE_URL?undefined:{
    command:"npm run start -- --hostname 127.0.0.1 --port 3012",
    url:"http://127.0.0.1:3012",
    reuseExistingServer:true,
    timeout:120_000,
    env:{API_URL:process.env.API_URL||"https://mafundimtaani.onrender.com"},
  },
  projects:[
    {name:"chromium-desktop",use:{...devices["Desktop Chrome"]}},
    {name:"firefox-desktop",use:{...devices["Desktop Firefox"]}},
    {name:"iphone-safari",use:{...devices["iPhone 13"],browserName:"webkit"}},
    {name:"android-chrome",use:{...devices["Pixel 7"]}},
  ],
});
