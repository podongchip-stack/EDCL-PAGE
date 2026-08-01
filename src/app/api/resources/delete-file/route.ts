import { del } from "@vercel/blob";
import {
  getDocStringFields,
  verifyApprovedMember,
} from "@/lib/server/firebaseRest";

// 파일 자료 삭제 시 Vercel Blob의 실제 파일을 함께 지운다.
// 클라이언트는 이 API가 성공한 뒤에 자료 문서(resources)를 삭제한다.
//
// 권한은 Firestore 문서의 createdBy가 아니라 "blob 경로에 새겨진 업로더 uid"로
// 판별한다 — resources 문서는 승인 구성원 누구나 임의 url로 만들 수 있으므로
// 문서 기준 검사는 위조 문서로 남의 파일을 지우는 confused deputy가 된다.
// 업로드 라우트가 경로를 resources/{uid}/... 로 강제하므로 경로가 곧 소유권이다.

function isBlobUrl(raw: string): boolean {
  try {
    return new URL(raw).hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

// blob URL 경로(resources/{uid}/파일명)에서 업로더 uid를 파싱한다.
// 형식이 다르면 null — 정상 업로드로는 생길 수 없는 경로이므로 관리자만 지울 수 있다.
function blobOwnerUid(raw: string): string | null {
  try {
    const segments = new URL(raw).pathname.split("/").filter(Boolean);
    if (segments.length < 3 || segments[0] !== "resources") return null;
    return decodeURIComponent(segments[1]);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ configured: false, deleted: false });
  }

  const member = await verifyApprovedMember(request);
  if (!member) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const isAdmin = member.role === "admin";

  const body = (await request.json().catch(() => null)) as {
    resourceId?: unknown;
    blobUrl?: unknown;
  } | null;

  // 모드 1: blobUrl 직접 정리 — 업로드는 됐지만 문서 생성에 실패한 파일 후처리.
  // 문서가 없으므로 본인 경로(resources/{본인 uid}/...)의 blob만 지울 수 있다.
  const blobUrl = typeof body?.blobUrl === "string" ? body.blobUrl : "";
  if (blobUrl) {
    if (!isBlobUrl(blobUrl) || blobOwnerUid(blobUrl) !== member.uid) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    try {
      await del(blobUrl);
    } catch {
      return Response.json(
        { error: "파일 삭제에 실패했습니다." },
        { status: 502 }
      );
    }
    return Response.json({ configured: true, deleted: true });
  }

  // 모드 2: 자료 문서 기준 삭제
  const resourceId =
    typeof body?.resourceId === "string" ? body.resourceId : "";
  // Firestore REST 경로에 안전한 문서 ID만 허용한다
  if (!resourceId || !/^[A-Za-z0-9_-]+$/.test(resourceId)) {
    return Response.json({ error: "resourceId가 필요합니다." }, { status: 400 });
  }

  const resource = await getDocStringFields(
    `resources/${resourceId}`,
    member.idToken
  );
  if (!resource) {
    return Response.json({ error: "자료를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!resource.url || !isBlobUrl(resource.url)) {
    // 링크 자료는 지울 파일이 없다 — 클라이언트는 그대로 문서 삭제를 진행한다
    return Response.json({
      configured: true,
      deleted: false,
      reason: "not-a-file",
    });
  }

  const owner = blobOwnerUid(resource.url);
  if (!isAdmin && (owner === null || owner !== member.uid)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await del(resource.url);
  } catch {
    return Response.json(
      { error: "파일 삭제에 실패했습니다." },
      { status: 502 }
    );
  }
  return Response.json({ configured: true, deleted: true });
}
