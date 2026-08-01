import { expect, test } from "@playwright/test";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// E2E 스모크 — Firebase 에뮬레이터 위에서 핵심 흐름을 검증한다 (npm run test:e2e).
// 관리자 승인 단계는 UI 대신 admin SDK로 에뮬레이터 데이터를 직접 수정해 대체한다.

// .env.local 의 NEXT_PUBLIC_FIREBASE_PROJECT_ID 와 같아야 에뮬레이터 네임스페이스가 일치한다
const PROJECT_ID = "edcl-lab";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";

function adminDb() {
  if (getApps().length === 0) {
    initializeApp({ projectId: PROJECT_ID });
  }
  return getFirestore();
}

const email = `e2e-${Date.now()}@test.local`;
const password = "e2e-password-123";

test.describe.configure({ mode: "serial" });

test("공개 페이지(홈·구성원·논문)가 로그인 없이 열린다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "EDCL LAB" })).toBeVisible();

  await page.goto("/members");
  await expect(page.getByRole("heading", { name: "구성원" })).toBeVisible();

  await page.goto("/publications");
  await expect(page.getByRole("heading", { name: "논문" })).toBeVisible();
});

test("회원가입하면 승인 대기 화면으로 이동한다", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("이름").fill("E2E 테스터");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByLabel("비밀번호 확인").fill(password);
  await page.getByRole("button", { name: "회원가입" }).click();

  await expect(
    page.getByRole("heading", { name: "승인 대기 중" })
  ).toBeVisible();
});

test("승인된 계정은 로그인 후 대시보드를 보고 일정을 등록할 수 있다", async ({
  page,
}) => {
  // 관리자 승인 (에뮬레이터 데이터 직접 수정)
  const snap = await adminDb()
    .collection("users")
    .where("email", "==", email)
    .get();
  expect(snap.size).toBe(1);
  await snap.docs[0].ref.update({ status: "approved" });

  // 로그인
  await page.goto("/login");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByRole("heading", { name: "대시보드" })).toBeVisible();

  // 일정 등록: 달력 첫 칸 클릭 → 모달에서 제목 입력 → 저장 → 칩 표시 확인
  await page.goto("/calendar");
  await expect(page.getByRole("heading", { name: "일정표" })).toBeVisible();
  await page.locator("div.min-h-24").first().click();
  await expect(
    page.getByRole("heading", { name: "새 일정 등록" })
  ).toBeVisible();
  await page.getByLabel("제목").fill("E2E 스모크 일정");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(
    page.getByRole("button", { name: "E2E 스모크 일정", exact: true })
  ).toBeVisible();
});
