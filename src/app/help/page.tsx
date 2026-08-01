"use client";

import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/contexts/AuthContext";

interface HelpSection {
  title: string;
  items: string[];
  adminOnly?: boolean;
}

const SECTIONS: HelpSection[] = [
  {
    title: "시작하기",
    items: [
      "회원가입(또는 Google/GitHub 로그인) 후 관리자가 승인하면 모든 기능을 쓸 수 있습니다.",
      "비밀번호를 잊었다면 로그인 화면의 \"비밀번호를 잊으셨나요?\"에서 재설정 메일을 받을 수 있습니다.",
      "상단의 돋보기 버튼 또는 Ctrl+K로 일정·프로젝트·작업·공지·자료를 한 번에 검색할 수 있습니다.",
    ],
  },
  {
    title: "대시보드",
    items: [
      "공지사항, 담당 순번(세미나 발표 등), 내가 맡은 작업, 다가오는 일정, 진행중인 작업을 한눈에 봅니다.",
      "공지 제목을 누르면 내용이 펼쳐집니다. 관리자는 공지를 작성하고 상단에 고정할 수 있습니다.",
    ],
  },
  {
    title: "일정표",
    items: [
      "달력의 날짜를 누르면 새 일정을 등록합니다. 일정은 날짜 단위이며 분류(세미나·미팅·마감·휴가·기타)별로 색이 다릅니다.",
      "매주·2주마다·매월 반복 일정을 만들 수 있고, 각 회차는 개별 일정으로 등록되어 따로 수정·삭제합니다.",
      "월/주 버튼으로 보기를 전환하고, \"iCal 내보내기\"로 받은 파일을 구글 캘린더나 휴대폰 캘린더에 가져올 수 있습니다.",
    ],
  },
  {
    title: "프로젝트·작업",
    items: [
      "프로젝트를 만들고 그 안에 작업을 추가합니다. 작업에는 담당자와 마감일을 지정할 수 있습니다.",
      "목록/보드 버튼으로 전환합니다. 보드에서는 카드를 끌어 상태(할 일→진행중→완료)를 바꿉니다.",
      "프로젝트 삭제는 휴지통으로 이동합니다. 휴지통에서 복원하거나 영구 삭제할 수 있습니다.",
    ],
  },
  {
    title: "자료실·예약",
    items: [
      "자료실에는 논문·드라이브 등 함께 쓰는 링크를 모아둡니다. 파일 업로드가 설정된 경우 파일(최대 50MB)도 직접 올릴 수 있습니다.",
      "예약 페이지에서 회의실·장비의 사용 시간대를 잡습니다. 이미 잡힌 시간과 겹치면 예약되지 않습니다.",
      "예약 항목이 비어 있다면 관리자에게 등록을 요청하세요.",
    ],
  },
  {
    title: "설정",
    items: [
      "화면 테마(시스템/라이트/다크)를 선택할 수 있습니다. 이 설정은 브라우저별로 저장됩니다.",
      "이름을 바꾸면 기존 작업·일정·자료에 표시된 이름도 함께 바뀝니다.",
      "공개 프로필을 켜면 로그인 없이 볼 수 있는 구성원 페이지에 이름·직책·연구 분야가 표시됩니다.",
    ],
  },
  {
    title: "공개 페이지",
    items: [
      "로그아웃 상태의 홈은 연구실 소개 페이지입니다. 구성원·논문 페이지도 로그인 없이 볼 수 있습니다.",
      "논문은 승인된 구성원 누구나 등록할 수 있습니다 (논문 페이지 우측 상단 \"논문 추가\").",
    ],
  },
  {
    title: "관리자 기능",
    adminOnly: true,
    items: [
      "관리자 페이지에서 가입 신청을 승인/거절하고 구성원 역할을 바꿉니다.",
      "연구실 소개(공개 홈 문구), 담당 순번, 예약 항목(회의실·장비)도 관리자 페이지에서 관리합니다.",
      "\"데이터 백업\"으로 전체 데이터를 JSON 파일로 내려받아 보관하세요.",
      "구성원 거절/삭제 시 서버에 서비스 계정 키가 등록돼 있으면 로그인 계정(Firebase Auth)도 자동 삭제되고, 없으면 Firebase Console에서 별도로 삭제해야 합니다.",
    ],
  },
];

function HelpContent() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const visibleSections = SECTIONS.filter((s) => !s.adminOnly || isAdmin);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        도움말
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        EDCL LAB 페이지의 기능을 간단히 안내합니다.
      </p>

      <div className="mt-6 space-y-4">
        {visibleSections.map((section) => (
          <section
            key={section.title}
            className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
          >
            <h2 className="border-b border-gray-200 px-5 py-3 font-semibold text-gray-900 dark:border-gray-800 dark:text-gray-100">
              {section.title}
            </h2>
            <ul className="space-y-2 p-5 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
              {section.items.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export default function HelpPage() {
  return (
    <AuthGuard>
      <HelpContent />
    </AuthGuard>
  );
}
