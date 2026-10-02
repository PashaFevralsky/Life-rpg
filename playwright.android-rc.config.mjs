import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir:".",
  testMatch:["android-ui-14.e2e.test.js","android-tab-swipe-14.e2e.test.js","finance-roundtrip-14.e2e.test.js"],
  timeout:30000,
  fullyParallel:false,
  workers:1,
  use:{baseURL:"http://127.0.0.1:4174",trace:"retain-on-failure"},
  webServer:{
    command:"npx vite preview --host 127.0.0.1 --port 4174",
    url:"http://127.0.0.1:4174",
    reuseExistingServer:false,
    timeout:30000
  },
  projects:[{name:"android-rc-mobile",use:{...devices["Pixel 7"]}}]
});
