import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

// firestore.rules 회귀 테스트 — 실행: npm run test:rules (Firestore 에뮬레이터에서 돎)

let env: RulesTestEnvironment;

const ADMIN_UID = "admin-uid";
const MEMBER_UID = "member-uid";
const PENDING_UID = "pending-uid";

function db(uid: string | null, email?: string) {
  return uid
    ? env.authenticatedContext(uid, email ? { email } : {}).firestore()
    : env.unauthenticatedContext().firestore();
}

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    await setDoc(doc(f, "users", ADMIN_UID), {
      name: "관리자",
      email: "admin@test.com",
      role: "admin",
      status: "approved",
    });
    await setDoc(doc(f, "users", MEMBER_UID), {
      name: "구성원",
      email: "member@test.com",
      role: "member",
      status: "approved",
    });
    await setDoc(doc(f, "users", PENDING_UID), {
      name: "대기자",
      email: "pending@test.com",
      role: "member",
      status: "pending",
    });
    await setDoc(doc(f, "events", "ev1"), {
      title: "세미나",
      description: "",
      category: "seminar",
      start: new Date(2026, 0, 1),
      end: new Date(2026, 0, 1, 23, 59, 59),
      createdBy: MEMBER_UID,
      createdByName: "구성원",
      createdAt: new Date(),
    });
    await setDoc(doc(f, "publications", "pub1"), {
      title: "논문 A",
      authors: "구성원",
      venue: "학회",
      year: 2026,
      link: "",
      createdBy: MEMBER_UID,
      createdAt: new Date(),
    });
    await setDoc(doc(f, "publicProfiles", MEMBER_UID), {
      name: "구성원",
      position: "석사과정",
      interests: "테스트",
      visible: true,
      updatedAt: new Date(),
    });
    await setDoc(doc(f, "publicProfiles", ADMIN_UID), {
      name: "관리자",
      position: "",
      interests: "",
      visible: false,
      updatedAt: new Date(),
    });
    await setDoc(doc(f, "resources", "res1"), {
      title: "자료",
      url: "https://example.com",
      description: "",
      createdBy: MEMBER_UID,
      createdByName: "구성원",
      createdAt: new Date(),
    });
    await setDoc(doc(f, "siteContent", "labInfo"), {
      intro: "소개",
      professor: "",
      contact: "",
    });
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "edcl-lab-rules-test",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});

describe("공개 콘텐츠", () => {
  it("비로그인도 논문을 읽을 수 있다", async () => {
    await assertSucceeds(getDoc(doc(db(null), "publications", "pub1")));
  });

  it("비로그인도 연구실 소개를 읽을 수 있다", async () => {
    await assertSucceeds(getDoc(doc(db(null), "siteContent", "labInfo")));
  });

  it("비로그인은 visible=true 프로필만 읽을 수 있다", async () => {
    await assertSucceeds(
      getDoc(doc(db(null), "publicProfiles", MEMBER_UID))
    );
    await assertFails(getDoc(doc(db(null), "publicProfiles", ADMIN_UID)));
  });

  it("비로그인은 내부 일정을 읽을 수 없다", async () => {
    await assertFails(getDoc(doc(db(null), "events", "ev1")));
  });
});

describe("승인 상태에 따른 접근", () => {
  it("승인 대기 사용자는 일정을 읽을 수 없다", async () => {
    await assertFails(getDoc(doc(db(PENDING_UID), "events", "ev1")));
  });

  it("승인된 구성원은 일정을 읽고 본인 명의로 만들 수 있다", async () => {
    await assertSucceeds(getDoc(doc(db(MEMBER_UID), "events", "ev1")));
    await assertSucceeds(
      setDoc(doc(db(MEMBER_UID), "events", "ev-new"), {
        title: "새 일정",
        description: "",
        category: "etc",
        start: new Date(),
        end: new Date(),
        createdBy: MEMBER_UID,
        createdByName: "구성원",
        createdAt: new Date(),
      })
    );
  });

  it("타인 명의(createdBy 위조)로는 일정을 만들 수 없다", async () => {
    await assertFails(
      setDoc(doc(db(MEMBER_UID), "events", "ev-forged"), {
        title: "위조",
        description: "",
        category: "etc",
        start: new Date(),
        end: new Date(),
        createdBy: ADMIN_UID,
        createdByName: "관리자",
        createdAt: new Date(),
      })
    );
  });
});

describe("users 문서 보호", () => {
  it("본인 이름은 바꿀 수 있지만 status는 바꿀 수 없다 (자기 승인 방지)", async () => {
    await assertSucceeds(
      updateDoc(doc(db(PENDING_UID), "users", PENDING_UID), {
        name: "새이름",
      })
    );
    await assertFails(
      updateDoc(doc(db(PENDING_UID), "users", PENDING_UID), {
        status: "approved",
      })
    );
  });

  it("가입 시 admin 역할로는 생성할 수 없다", async () => {
    const uid = "newcomer-uid";
    await assertFails(
      setDoc(doc(db(uid, "new@test.com"), "users", uid), {
        name: "신규",
        email: "new@test.com",
        role: "admin",
        status: "pending",
        createdAt: new Date(),
      })
    );
    await assertSucceeds(
      setDoc(doc(db(uid, "new@test.com"), "users", uid), {
        name: "신규",
        email: "new@test.com",
        role: "member",
        status: "pending",
        createdAt: new Date(),
      })
    );
  });
});

describe("관리자 전용 컬렉션", () => {
  it("공지는 관리자만 만들 수 있다", async () => {
    await assertFails(
      setDoc(doc(db(MEMBER_UID), "notices", "n1"), {
        title: "공지",
        content: "",
        pinned: false,
        createdBy: MEMBER_UID,
        createdByName: "구성원",
        createdAt: new Date(),
      })
    );
    await assertSucceeds(
      setDoc(doc(db(ADMIN_UID), "notices", "n2"), {
        title: "공지",
        content: "",
        pinned: false,
        createdBy: ADMIN_UID,
        createdByName: "관리자",
        createdAt: new Date(),
      })
    );
  });

  it("순번과 예약 항목은 관리자만 만들 수 있다", async () => {
    await assertFails(
      setDoc(doc(db(MEMBER_UID), "rotations", "r1"), {
        title: "세미나",
        members: ["a"],
        anchorDate: "2026-08-02",
        intervalWeeks: 1,
        createdAt: new Date(),
      })
    );
    await assertSucceeds(
      setDoc(doc(db(ADMIN_UID), "bookableItems", "i1"), {
        name: "회의실",
        description: "",
        createdAt: new Date(),
      })
    );
  });

  it("연구실 소개는 구성원이 수정할 수 없다", async () => {
    await assertFails(
      setDoc(doc(db(MEMBER_UID), "siteContent", "labInfo"), {
        intro: "변조",
        professor: "",
        contact: "",
      })
    );
  });
});

describe("소유권 기반 삭제", () => {
  it("자료는 작성자가 지울 수 있고, 타인은 지울 수 없다", async () => {
    await assertFails(
      deleteDoc(doc(db(PENDING_UID), "resources", "res1"))
    );
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users", "other-uid"), {
        name: "타인",
        email: "other@test.com",
        role: "member",
        status: "approved",
      });
    });
    await assertFails(deleteDoc(doc(db("other-uid"), "resources", "res1")));
    await assertSucceeds(deleteDoc(doc(db(MEMBER_UID), "resources", "res1")));
  });

  it("자료는 정의된 필드로만 만들 수 있다 (파일 업로드 필드 포함)", async () => {
    await assertSucceeds(
      setDoc(doc(db(MEMBER_UID), "resources", "res-file"), {
        title: "업로드 파일",
        url: "https://store.public.blob.vercel-storage.com/resources/uid/a.pdf",
        description: "",
        fileName: "a.pdf",
        fileSize: 1024,
        createdBy: MEMBER_UID,
        createdByName: "구성원",
        createdAt: new Date(),
      })
    );
    await assertFails(
      setDoc(doc(db(MEMBER_UID), "resources", "res-extra"), {
        title: "위조",
        url: "https://example.com",
        description: "",
        extraField: "임의 필드",
        createdBy: MEMBER_UID,
        createdByName: "구성원",
        createdAt: new Date(),
      })
    );
  });

  it("예약은 createdBy를 위조해 만들 수 없다", async () => {
    await assertFails(
      setDoc(doc(db(MEMBER_UID), "bookings", "b1"), {
        itemId: "i1",
        itemName: "회의실",
        date: "2026-08-02",
        startMin: 540,
        endMin: 600,
        purpose: "",
        createdBy: ADMIN_UID,
        createdByName: "관리자",
        createdAt: new Date(),
      })
    );
  });

  it("예약 날짜는 YYYY-MM-DD 형식이어야 한다 (유령 예약 방지)", async () => {
    const base = {
      itemId: "i1",
      itemName: "회의실",
      startMin: 540,
      endMin: 600,
      purpose: "",
      createdBy: MEMBER_UID,
      createdByName: "구성원",
      createdAt: new Date(),
    };
    await assertFails(
      setDoc(doc(db(MEMBER_UID), "bookings", "b-bad"), { ...base, date: "" })
    );
    await assertSucceeds(
      setDoc(doc(db(MEMBER_UID), "bookings", "b-ok"), {
        ...base,
        date: "2026-08-02",
      })
    );
  });
});

describe("공개 프로필 쓰기 보호", () => {
  it("승인 대기 계정은 공개 프로필을 만들 수 없다 (공개 페이지 사칭 방지)", async () => {
    await assertFails(
      setDoc(doc(db(PENDING_UID), "publicProfiles", PENDING_UID), {
        name: "침입자",
        position: "박사과정",
        interests: "",
        visible: true,
        updatedAt: new Date(),
      })
    );
  });

  it("승인된 구성원은 본인 공개 프로필만 쓸 수 있다", async () => {
    await assertSucceeds(
      setDoc(doc(db(MEMBER_UID), "publicProfiles", MEMBER_UID), {
        name: "구성원",
        position: "석사과정",
        interests: "테스트",
        visible: true,
        updatedAt: new Date(),
      })
    );
    await assertFails(
      setDoc(doc(db(MEMBER_UID), "publicProfiles", ADMIN_UID), {
        name: "변조",
        position: "",
        interests: "",
        visible: true,
        updatedAt: new Date(),
      })
    );
  });

  it("관리자는 타인의 공개 프로필을 삭제할 수 있다 (강퇴 정리)", async () => {
    await assertSucceeds(
      deleteDoc(doc(db(ADMIN_UID), "publicProfiles", MEMBER_UID))
    );
  });

  it("졸업생 표시(isAlumni) 필드를 저장할 수 있다", async () => {
    await assertSucceeds(
      setDoc(doc(db(MEMBER_UID), "publicProfiles", MEMBER_UID), {
        name: "구성원",
        position: "석사 졸업",
        interests: "",
        isAlumni: true,
        visible: true,
        updatedAt: new Date(),
      })
    );
  });
});

describe("소식·회의록·저널클럽", () => {
  it("소식은 비로그인도 읽을 수 있지만 구성원은 쓸 수 없다 (관리자 전용)", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "news", "n1"), {
        title: "소식",
        content: "",
        date: "2026-08-01",
        link: "",
        createdBy: ADMIN_UID,
        createdAt: new Date(),
      });
    });
    await assertSucceeds(getDoc(doc(db(null), "news", "n1")));
    await assertFails(
      setDoc(doc(db(MEMBER_UID), "news", "n2"), {
        title: "무단 소식",
        content: "",
        date: "2026-08-01",
        link: "",
        createdBy: MEMBER_UID,
        createdAt: new Date(),
      })
    );
    await assertSucceeds(
      setDoc(doc(db(ADMIN_UID), "news", "n3"), {
        title: "관리자 소식",
        content: "",
        date: "2026-08-01",
        link: "",
        createdBy: ADMIN_UID,
        createdAt: new Date(),
      })
    );
  });

  it("회의록은 승인 대기 계정이 읽을 수 없고, 구성원은 본인 명의로 쓸 수 있다", async () => {
    await assertSucceeds(
      setDoc(doc(db(MEMBER_UID), "meetingNotes", "m1"), {
        title: "랩미팅",
        date: "2026-08-01",
        content: "",
        createdBy: MEMBER_UID,
        createdByName: "구성원",
        createdAt: new Date(),
      })
    );
    await assertFails(getDoc(doc(db(PENDING_UID), "meetingNotes", "m1")));
    await assertFails(getDoc(doc(db(null), "meetingNotes", "m1")));
  });

  it("저널클럽 update로 createdBy를 바꿔 소유권을 탈취할 수 없다", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "readings", "r-owned"), {
        title: "타인 논문",
        link: "",
        presenterName: "",
        scheduledDate: "",
        status: "queued",
        createdBy: ADMIN_UID,
        createdByName: "관리자",
        createdAt: new Date(),
      });
    });
    // 상태 토글은 허용
    await assertSucceeds(
      updateDoc(doc(db(MEMBER_UID), "readings", "r-owned"), {
        status: "done",
      })
    );
    // createdBy 변경(소유권 탈취)은 거부
    await assertFails(
      updateDoc(doc(db(MEMBER_UID), "readings", "r-owned"), {
        createdBy: MEMBER_UID,
      })
    );
  });

  it("저널클럽 논문은 createdBy를 위조해 만들 수 없다", async () => {
    await assertFails(
      setDoc(doc(db(MEMBER_UID), "readings", "r1"), {
        title: "논문",
        link: "",
        presenterName: "",
        scheduledDate: "",
        status: "queued",
        createdBy: ADMIN_UID,
        createdByName: "관리자",
        createdAt: new Date(),
      })
    );
    await assertSucceeds(
      setDoc(doc(db(MEMBER_UID), "readings", "r2"), {
        title: "논문",
        link: "",
        presenterName: "",
        scheduledDate: "",
        status: "queued",
        createdBy: MEMBER_UID,
        createdByName: "구성원",
        createdAt: new Date(),
      })
    );
  });
});
