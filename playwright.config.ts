import { defineConfig } from "@playwright/test";

// 테스트 대상 dev 서버(웹앱)가 Firebase 에뮬레이터에 붙도록 한다.
// 이 변수는 test:e2e 실행 시에만 존재하므로 배포 빌드에는 영향이 없다.
process.env.NEXT_PUBLIC_USE_EMULATORS = "1";

export default defineConfig({
  testDir: "tests/e2e",
  // 에뮬레이터 데이터를 공유하므로 순차 실행한다
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    // Next 16 dev 서버는 127.0.0.1 오리진의 dev 리소스 요청을 차단하므로 localhost를 쓴다
    baseURL: "http://localhost:3100",
  },
  webServer: {
    command: "npm run dev -- -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
