import { getAdminServices } from "@/lib/server/firebaseAdmin";
import { bearerToken } from "@/lib/server/firebaseRest";

// 관리자가 구성원을 삭제할 때 Firebase Auth 로그인 계정까지 함께 삭제한다.
// FIREBASE_SERVICE_ACCOUNT_KEY 미등록이면 configured:false 를 돌려주고,
// 클라이언트는 기존처럼 Firebase Console 수동 삭제 안내를 보여준다.
export async function POST(request: Request) {
  const admin = getAdminServices();
  if (!admin) {
    return Response.json({ configured: false, deleted: false });
  }

  const idToken = bearerToken(request);
  if (!idToken) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  let callerUid: string;
  try {
    callerUid = (await admin.auth.verifyIdToken(idToken)).uid;
  } catch {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const callerDoc = await admin.db.doc(`users/${callerUid}`).get();
  const caller = callerDoc.data();
  if (!caller || caller.role !== "admin" || caller.status !== "approved") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    uid?: unknown;
  } | null;
  const targetUid = typeof body?.uid === "string" ? body.uid : "";
  if (!targetUid) {
    return Response.json({ error: "uid가 필요합니다." }, { status: 400 });
  }
  if (targetUid === callerUid) {
    return Response.json(
      { error: "본인 계정은 삭제할 수 없습니다." },
      { status: 400 }
    );
  }

  try {
    await admin.auth.deleteUser(targetUid);
  } catch (err) {
    // 이미 없는 계정이면 성공으로 취급한다 (재시도 안전)
    const code = (err as { code?: string }).code;
    if (code !== "auth/user-not-found") {
      return Response.json(
        { error: "로그인 계정 삭제에 실패했습니다." },
        { status: 502 }
      );
    }
  }
  return Response.json({ configured: true, deleted: true });
}
