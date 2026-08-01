import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  initializeAuth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

if (!apiKey && typeof window !== "undefined") {
  console.error(
    "Firebase 환경변수가 비어 있습니다. .env.example 을 .env.local 로 복사해 값을 채운 뒤 다시 실행하세요."
  );
}

// 환경변수가 없는 빌드(프리렌더) 단계에서도 초기화가 실패하지 않도록 placeholder를 쓴다.
// 실제 값은 .env.local(로컬) / Vercel 환경변수(배포)에서 주입된다.
const firebaseConfig = {
  apiKey: apiKey || "placeholder-api-key",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "placeholder.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "placeholder",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "placeholder.appspot.com",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "0",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "placeholder",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// 기본값인 IndexedDB 저장소는 소셜 로그인 팝업이 탭을 가리면 연결을 닫아
// "Database is closing/hidden" 오류로 로그인이 실패한다. localStorage 저장소는
// 이 동작이 없고, 오리진 격리 기반 보안 수준은 IndexedDB와 동일하다.
// initializeAuth는 팝업 리졸버를 자동 등록하지 않으므로 명시적으로 넘긴다.
export const auth =
  typeof window === "undefined"
    ? getAuth(app)
    : initializeAuth(app, {
        persistence: browserLocalPersistence,
        popupRedirectResolver: browserPopupRedirectResolver,
      });
export const db = getFirestore(app);
