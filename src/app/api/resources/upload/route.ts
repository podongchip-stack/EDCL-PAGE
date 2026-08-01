import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { verifyApprovedMember } from "@/lib/server/firebaseRest";

// 자료실 파일 업로드 (Vercel Blob 클라이언트 업로드용 토큰 발급).
// BLOB_READ_WRITE_TOKEN 미설정이면 업로드 기능이 꺼진 것으로 취급한다.
// 자료 문서(resources)는 업로드를 마친 클라이언트가 직접 생성한다 (보안규칙 적용).

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// 자료실 폼이 파일 탭 활성화 여부를 판단할 때 호출한다 (승인 구성원 전용)
export async function GET(request: Request) {
  const member = await verifyApprovedMember(request);
  if (!member) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json({
    configured: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    maxSize: MAX_FILE_SIZE,
  });
}

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      { error: "파일 업로드가 아직 설정되지 않았습니다." },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  // 토큰 발급 요청만 구성원 인증을 요구한다.
  // (upload-completed 콜백은 Blob 서비스가 호출하며 handleUpload가 서명을 검증)
  let member: Awaited<ReturnType<typeof verifyApprovedMember>> = null;
  if (body.type === "blob.generate-client-token") {
    member = await verifyApprovedMember(request);
    if (!member) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const jsonResponse = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        // 경로에 업로더 uid를 강제한다 — 삭제 API가 blob 경로만으로
        // 소유자를 판별할 수 있어야 위조 문서로 남의 파일을 지울 수 없다
        if (!member || !pathname.startsWith(`resources/${member.uid}/`)) {
          throw new Error("허용되지 않은 업로드 경로입니다.");
        }
        return {
          maximumSizeInBytes: MAX_FILE_SIZE,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // 클라이언트가 업로드 완료 후 자료 문서를 직접 생성하므로 여기서 할 일 없음
      },
    });
    return Response.json(jsonResponse);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "업로드에 실패했습니다." },
      { status: 400 }
    );
  }
}
