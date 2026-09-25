import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir:".",testMatch:["e2e.test.js","personal-os.e2e.test.js","layout-all.e2e.test.js","ux-12.8.e2e.test.js"],timeout:30000,fullyParallel:false,workers:1,
  use:{baseURL:"http://127.0.0.1:4173",trace:"retain-on-failure"},
  webServer:{command:"npm run preview -- --host 127.0.0.1 --port 4173",url:"http://127.0.0.1:4173",reuseExistingServer:false,timeout:30000},
  projects:[{name:"mobile-chromium",use:{...devices["Pixel 7"]}}]
});
