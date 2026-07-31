# EDCL LAB 페이지

연구실 구성원끼리 일정과 진행중인 작업을 공유하는 내부 웹페이지.
**기존에 사용하던 LAB PAGE를 리뉴얼**한 프로젝트다 (회원 승인제·공유 일정표·작업 관리 중심으로 재구축).

- **스택**: Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + Firebase (Authentication / Firestore)
- **배포**: Vercel

## 기능

| 경로 | 설명 |
|------|------|
| `/` | 대시보드 — 다가오는 일정 + 진행중인 작업 요약 |
| `/login`, `/signup` | 로그인 / 회원가입 — 이메일/비밀번호 + Google/GitHub 소셜 로그인 (가입 후 관리자 승인 필요) |
| `/pending` | 승인 대기 안내 |
| `/calendar` | 공유 일정표 — 월간 캘린더 + 다가오는 일정 리스트 |
| `/projects` | 프로젝트별 작업 관리 (상태·담당자·마감일) |
| `/admin` | 관리자 — 가입 승인/거절, 역할 변경 (admin 전용) |

## 1. Firebase 프로젝트 준비 (최초 1회)

1. [Firebase Console](https://console.firebase.google.com)에서 **프로젝트 추가** (예: `edcl-lab`)
2. **빌드 > Authentication > 시작하기 > 이메일/비밀번호** 사용 설정
   - 소셜 로그인을 쓰려면 **Google**(토글만), **GitHub**(GitHub OAuth App의 Client ID/Secret 필요)도 각각 사용 설정
   - 소셜 첫 로그인 시 자동으로 승인 대기(pending) 계정이 생성된다 (별도 회원가입 불필요)
3. **빌드 > Firestore Database > 데이터베이스 만들기** — 위치는 `asia-northeast3`(서울) 권장, **프로덕션 모드**로 시작
4. **프로젝트 설정(톱니바퀴) > 일반 > 내 앱 > 웹 앱 추가(</>)** — 앱 등록 후 표시되는 `firebaseConfig` 값을 확보
5. **Firestore Database > 규칙** 탭에 이 저장소의 `firestore.rules` 파일 내용을 붙여넣고 **게시**

## 2. 로컬 실행

```bash
# 저장소 루트에서
copy .env.example .env.local
# → .env.local 을 열어 1-4에서 확보한 firebaseConfig 값을 채운다

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

## 4. Vercel 배포

1. 이 저장소를 GitHub에 push
2. [Vercel](https://vercel.com)에서 **Add New > Project** → 해당 GitHub 저장소 Import (Next.js 자동 감지)
3. **Settings > Environment Variables**에 `.env.local` 과 동일한 `NEXT_PUBLIC_FIREBASE_*` 6개 값을 등록
4. Deploy 후 발급된 도메인(예: `xxx.vercel.app`)을
   Firebase Console > **Authentication > 설정 > 승인된 도메인**에 추가

## 데이터 구조 (Firestore)

| 컬렉션 | 문서 내용 |
|--------|-----------|
| `users/{uid}` | name, email, role(`admin`\|`member`), status(`pending`\|`approved`), createdAt |
| `events/{id}` | title, description, start, end, allDay, createdBy, createdByName, createdAt |
| `projects/{id}` | name, description, status(`active`\|`archived`), createdBy, createdAt |
| `tasks/{id}` | projectId, title, status(`todo`\|`in_progress`\|`done`), assigneeUid, assigneeName, dueDate, createdBy, createdAt |

접근 제어는 `firestore.rules`가 강제한다:
승인(`approved`)된 구성원만 내부 데이터를 읽고 쓸 수 있으며, 가입은 항상 `member`/`pending`으로 시작되고, 승인·역할 변경은 admin만 가능하다.
