import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
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

export const auth = getAuth(app);
export const db = getFirestore(app);
