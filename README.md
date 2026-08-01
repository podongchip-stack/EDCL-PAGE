# EDCL LAB 페이지

연구실 공개 홈페이지 + 구성원 내부 협업 도구.
공개 영역(소개·구성원·논문)은 누구나 볼 수 있고, 내부 도구(일정·프로젝트·자료·예약 등)는 가입 후 관리자 승인을 받은 구성원만 사용한다.

- **스택**: Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + Firebase (Authentication / Firestore)
- **배포**: Vercel (main 브랜치 push 시 자동 배포)
- **분석**: Vercel Web Analytics (대시보드에서 활성화 필요)

## 기능

### 공개 영역 (로그인 불필요)

| 경로 | 설명 |
|------|------|
| `/` | 연구실 소개 랜딩 (관리자가 소개 문구 편집, 한/영 전환) |
| `/members` | 구성원 소개 — 각자 공개를 켠 프로필만 표시 |
| `/publications` | 논문/출판물 목록 (연도별) |

### 내부 도구 (승인된 구성원)

| 경로 | 설명 |
|------|------|
| `/` (로그인 시) | 대시보드 — 공지사항, 담당 순번, 내 작업, 다가오는 일정, 진행중인 작업 |
| `/calendar` | 공유 일정표 — 월/주 뷰, 카테고리 색상(세미나·미팅·마감·휴가·기타), 반복 일정, iCal 내보내기 |
| `/projects` | 프로젝트별 작업 관리 — 목록/칸반 보드, 담당자·마감일, 휴지통(복원/영구삭제) |
| `/resources` | 자료실 — 링크 공유 + 파일 업로드(Vercel Blob 설정 시, 최대 50MB) |
| `/bookings` | 회의실·장비 시간대 예약 (겹침 방지) |
| `/settings` | 화면 테마(시스템/라이트/다크), 이름 변경, 공개 프로필 관리 |
| `/help` | 사용 도움말 |
| `/admin` | 관리자 — 가입 승인/역할 관리, 연구실 소개 편집, 담당 순번, 예약 항목, 데이터 JSON 백업 |

공통: 상단 돋보기 또는 `Ctrl+K`로 통합 검색 (일정·프로젝트·작업·공지·자료).

### 로그인/계정

- 이메일/비밀번호 + Google/GitHub 소셜 로그인 (소셜 첫 로그인 시 자동으로 승인 대기 계정 생성)
- 비밀번호 재설정: `/reset-password`
- 가입 후 관리자 승인(approved) 전에는 `/pending` 대기 화면만 표시

## 1. Firebase 프로젝트 준비 (최초 1회)

1. [Firebase Console](https://console.firebase.google.com)에서 **프로젝트 추가** (예: `edcl-lab`)
2. **빌드 > Authentication > 시작하기 > 이메일/비밀번호** 사용 설정
   - 소셜 로그인을 쓰려면 **Google**(토글만), **GitHub**(GitHub OAuth App의 Client ID/Secret 필요)도 각각 사용 설정
3. **빌드 > Firestore Database > 데이터베이스 만들기** — **프로덕션 모드**로 시작
4. **프로젝트 설정(톱니바퀴) > 일반 > 내 앱 > 웹 앱 추가(</>)** — 표시되는 `firebaseConfig` 값을 확보
5. 보안 규칙 배포: `npx firebase-tools deploy --only firestore:rules --project <프로젝트ID>`
   (또는 콘솔 규칙 탭에 `firestore.rules` 내용을 붙여넣고 게시)

## 2. 로컬 실행

```bash
copy .env.example .env.local
# → .env.local 에 1-4에서 확보한 firebaseConfig 값을 채운다

npm install
npm run dev
```

http://localhost:3000 접속.

> 이 PC는 보안 정책상 네이티브 SWC 바이너리가 차단되어 있어 dev/build 스크립트가
> `--webpack` 플래그로 고정되어 있다 (`Attempted to load @next/swc-...` 경고는 정상).

## 3. 최초 관리자 지정 (최초 1회)

1. 사이트에서 본인 계정으로 **회원가입**
2. Firebase Console > **Firestore Database > 데이터** > `users` 컬렉션에서 본인 문서를 열어
   - `role` 을 `member` → `admin`
   - `status` 를 `pending` → `approved`
   로 직접 수정
3. 이후의 가입자는 사이트의 `/admin` 페이지에서 승인/관리

## 4. 테스트

JDK가 설치되어 있어야 한다 (Firebase 에뮬레이터가 Java로 동작).

```bash
# Firestore 보안규칙 테스트 (에뮬레이터에서 규칙 회귀 검증)
npm run test:rules

# E2E 스모크 테스트 (에뮬레이터 + Playwright — 공개 페이지, 가입→승인→일정 등록 흐름)
npx playwright install chromium   # 최초 1회
npm run test:e2e
```

E2E는 Firebase **에뮬레이터**를 사용하므로 실제 데이터에 영향을 주지 않는다.
(`NEXT_PUBLIC_USE_EMULATORS=1`일 때만 앱이 에뮬레이터에 붙는다 — 배포 빌드에는 영향 없음)

## 5. Vercel 배포

1. 이 저장소를 GitHub에 push
2. [Vercel](https://vercel.com)에서 **Add New > Project** → 해당 GitHub 저장소 Import (Next.js 자동 감지)
3. **Settings > Environment Variables**에 `.env.local` 과 동일한 `NEXT_PUBLIC_FIREBASE_*` 6개 값을 등록
4. Deploy 후 발급된 도메인(예: `xxx.vercel.app`)을
   Firebase Console > **Authentication > 설정 > 승인된 도메인**에 추가
5. (선택) Vercel 대시보드 > 프로젝트 > **Analytics** 탭에서 Web Analytics 활성화

### 선택 기능 (서버 환경변수 등록 시 활성화)

값이 없으면 해당 기능만 꺼진 채 나머지는 정상 동작한다. `.env.example`의 주석 참고.

| 기능 | 환경변수 | 준비 방법 |
|------|----------|-----------|
| 가입 신청 이메일 알림 | `RESEND_API_KEY`, `JOIN_NOTIFY_EMAIL`, (선택)`RESEND_FROM_EMAIL` | [Resend](https://resend.com) 무료 가입 → API 키 발급, 알림 받을 관리자 이메일 지정(쉼표로 여러 명) |
| 구성원 삭제 시 로그인 계정 자동 삭제 | `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase Console > 프로젝트 설정 > 서비스 계정 > 새 비공개 키 생성 → JSON 원문(또는 base64) 등록 |
| 자료실 파일 업로드 | `BLOB_READ_WRITE_TOKEN` | Vercel 대시보드 > 프로젝트 > **Storage > Create Database > Blob** — 생성 시 자동 등록 |

이후에는 main 브랜치에 push하면 자동으로 배포된다.
보안 규칙(`firestore.rules`)을 수정한 경우에는 별도로 규칙 배포가 필요하다(1-5 참고).

## 데이터 구조 (Firestore)

| 컬렉션 | 문서 내용 |
|--------|-----------|
| `users/{uid}` | name, email, role(`admin`\|`member`), status(`pending`\|`approved`), createdAt |
| `events/{id}` | title, description, category(`seminar`\|`meeting`\|`deadline`\|`vacation`\|`etc`), start, end, createdBy, createdByName, createdAt — 날짜 단위(시작일 00:00 ~ 종료일 23:59) |
| `projects/{id}` | name, description, status(`active`\|`archived`\|`deleted`), deletedAt, createdBy, createdAt |
| `tasks/{id}` | projectId, title, status(`todo`\|`in_progress`\|`done`), assigneeUid, assigneeName, dueDate, createdBy, createdAt |
| `notices/{id}` | title, content, pinned, createdBy, createdByName, createdAt (관리자만 작성) |
| `resources/{id}` | title, url, description, fileName?, fileSize?, createdBy, createdByName, createdAt — fileName이 있으면 Vercel Blob 업로드 파일 |
| `publications/{id}` | title, authors, venue, year, link, createdBy, createdAt (공개 읽기) |
| `publicProfiles/{uid}` | name, position, interests, visible, updatedAt (visible=true만 공개 읽기, 승인된 본인/관리자만 쓰기) |
| `siteContent/labInfo` | intro, introEn, professor, contact (공개 읽기, 관리자만 쓰기) |
| `bookableItems/{id}` | name, description, createdAt (관리자만 관리) |
| `bookings/{id}` | itemId, itemName, date(`YYYY-MM-DD`), startMin, endMin, purpose, createdBy, createdByName, createdAt |
| `rotations/{id}` | title, members[], anchorDate, intervalWeeks, createdAt (관리자만 관리) |

접근 제어는 `firestore.rules`가 강제한다:
승인(`approved`)된 구성원만 내부 데이터를 읽고 쓸 수 있고, 가입은 항상 `member`/`pending`으로 시작되며, 승인·역할 변경·공지·순번·예약 항목·사이트 문구는 admin만 관리한다.
공개 컬렉션(publications, visible한 publicProfiles, siteContent)만 비로그인 읽기가 허용된다.
규칙 회귀는 `npm run test:rules`가 검증한다.
