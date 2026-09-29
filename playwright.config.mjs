import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir:".",testMatch:["e2e.test.js","personal-os.e2e.test.js","layout-all.e2e.test.js","ux-12.8.e2e.test.js","training-12.9.e2e.test.js","stabilization-13.0.e2e.test.js","mobile-share-13.1.e2e.test.js","android-acceptance-13.1.1.e2e.test.js","decision-intelligence-13.2.e2e.test.js","intelligence-calibration-13.2.1.e2e.test.js","predictive-trends-13.2.2.e2e.test.js","recovery-13.3.e2e.test.js","gpt-exchange-13.5.e2e.test.js","stabilization-13.7-data-safety.e2e.test.js","stage2-mobile-modal-accessibility.e2e.test.js","stage3-concurrency-safemode.e2e.test.js","stage3-final-hardening.e2e.test.js","ui-polish-13.7.5.e2e.test.js","report-start-finance-13.7.5.e2e.test.js","release-13.9.0.e2e.test.js","interface-13.9.e2e.test.js"],timeout:30000,fullyParallel:false,workers:1,
  use:{baseURL:"http://127.0.0.1:4173",trace:"retain-on-failure"},
  webServer:{command:"npm run preview -- --host 127.0.0.1 --port 4173",url:"http://127.0.0.1:4173",reuseExistingServer:false,timeout:30000},
  projects:[{name:"mobile-chromium",use:{...devices["Pixel 7"]}}]
});
