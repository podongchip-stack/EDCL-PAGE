// Crossref 공개 API로 DOI 메타데이터를 조회한다 (인증 불필요, CORS 허용)

export interface DoiMeta {
  title: string;
  authors: string;
  venue: string;
  year: number | null;
  link: string;
}

// 입력에서 DOI를 추출한다 (https://doi.org/... 형태나 본문 붙여넣기 허용)
export function extractDoi(raw: string): string | null {
  const m = /10\.\d{4,9}\/[^\s"'<>]+/.exec(raw.trim());
  if (!m) return null;
  // 문장 끝 문장부호가 딸려 온 경우 정리
  return m[0].replace(/[.,;)\]]+$/, "");
}

export async function fetchDoiMeta(doi: string): Promise<DoiMeta | null> {
  const res = await fetch(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}`
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    message?: {
      title?: string[];
      author?: { given?: string; family?: string; name?: string }[];
      "container-title"?: string[];
      event?: { name?: string };
      issued?: { "date-parts"?: number[][] };
    };
  };
  const msg = data.message;
  if (!msg) return null;
  const title = Array.isArray(msg.title) ? (msg.title[0] ?? "") : "";
  const authors = Array.isArray(msg.author)
    ? msg.author
        .map((a) => a.name || [a.given, a.family].filter(Boolean).join(" "))
        .filter((v) => v.length > 0)
        .join(", ")
    : "";
  const venue =
    (Array.isArray(msg["container-title"]) && msg["container-title"][0]) ||
    msg.event?.name ||
    "";
  const year = msg.issued?.["date-parts"]?.[0]?.[0] ?? null;
  return { title, authors, venue, year, link: `https://doi.org/${doi}` };
}
