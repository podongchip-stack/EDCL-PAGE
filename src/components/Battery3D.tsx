// SOC 게이지 조각 (위→아래). 아래 4칸은 충전 완료, 맨 위 칸은 충전 중처럼 깜빡인다.
const SEGMENTS = [false, true, true, true, true];

// 배터리 밖으로 뻗어나가는 PCB 회로 트레이스 (좌표계: 760×560, 배터리 본체는 280~480 × 120~440)
const TRACES = [
  "M285 170 H160 L130 140 H84", // → DC-DC 컨버터 경유
  "M285 280 H112",
  "M285 390 H210 L180 420 H130", // → PMIC
  "M475 160 H560 L590 130 H610", // → MCU 좌측
  "M475 280 H642 V172", // → MCU 하단
  "M475 360 H540 L570 390 H620", // → 전류센서
  "M350 115 V70 H300",
  "M420 115 V55 H500",
  "M345 445 V500", // → GND
  "M415 445 V480 H470",
];

// 각 트레이스 끝의 접점(비아) 위치 (부품에 연결되는 트레이스는 제외)
const NODES: [number, number][] = [
  [76, 140],
  [104, 280],
  [292, 70],
  [508, 55],
  [478, 480],
];

// 회로 부품 블록 (트레이스 위에 얹혀 배선이 아래로 지나가는 느낌을 낸다)
const BLOCKS = [
  { x: 150, y: 152, w: 70, h: 36, label: "DC-DC", fs: 10 },
  { x: 60, y: 402, w: 70, h: 36, label: "PMIC", fs: 10 },
  { x: 610, y: 98, w: 64, h: 64, label: "MCU", fs: 12 },
  { x: 620, y: 376, w: 56, h: 28, label: "SENSE", fs: 9 },
];

// 정적 장식: 디커플링 커패시터 분기 + 그라운드 심볼
const DECOR = [
  "M200 280 V328", // 커패시터 분기 스템
  "M188 332 H212", // 커패시터 위 판
  "M188 340 H212", // 커패시터 아래 판
  "M200 340 V352",
  "M186 356 H214", // GND
  "M191 362 H209",
  "M196 368 H204",
  "M331 504 H359", // 하단 GND
  "M336 510 H354",
  "M341 516 H349",
];

const MCU_PIN_YS = [110, 130, 150];
const MCU_PIN_XS = [622, 642, 662];

function Hud({
  className,
  label,
  value,
}: {
  className: string;
  label: string;
  value: string;
}) {
  return (
    <div
      className={`absolute rounded-lg border border-cyan-300/25 bg-slate-900/80 px-3 py-1.5 font-mono shadow-[0_0_24px_rgba(34,211,238,0.18)] backdrop-blur ${className}`}
    >
      <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <p className="text-sm font-semibold text-cyan-200">{value}</p>
    </div>
  );
}

// 은은하게 떠서 흔들리는 CSS 3D 배터리 표지 연출.
export default function Battery3D() {
  return (
    <div className="relative mx-auto h-[400px] w-[290px] select-none [perspective:1100px] sm:h-[440px] sm:w-[320px]">
      <div className="absolute inset-0 animate-battery-float [transform-style:preserve-3d]">
        {/* 배경 발광 */}
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl [transform:translate(-50%,-50%)_translateZ(-70px)]"
        />

        {/* 배터리 주변으로 뻗어나가는 회로 트레이스 + 부품(MCU·PMIC·DC-DC·전류센서) */}
        <svg
          aria-hidden
          viewBox="0 0 760 560"
          fill="none"
          className="absolute left-1/2 top-1/2 h-[560px] w-[760px] [transform:translate(-50%,-50%)_translateZ(-50px)]"
        >
          {TRACES.map((d, i) => (
            <g key={d}>
              <path d={d} strokeWidth="2" className="stroke-cyan-300/15" />
              <path
                d={d}
                pathLength={100}
                strokeDasharray="12 88"
                strokeWidth="2"
                strokeLinecap="round"
                className="animate-trace-flow stroke-cyan-300/80"
                style={{ animationDelay: `${i * -0.45}s` }}
              />
            </g>
          ))}

          {DECOR.map((d) => (
            <path
              key={d}
              d={d}
              strokeWidth="1.5"
              className="stroke-cyan-300/30"
            />
          ))}

          {/* MCU 핀 */}
          {MCU_PIN_YS.map((y) => (
            <g key={y} strokeWidth="2" className="stroke-cyan-300/30">
              <line x1="598" x2="610" y1={y} y2={y} />
              <line x1="674" x2="686" y1={y} y2={y} />
            </g>
          ))}
          {MCU_PIN_XS.map((x) => (
            <g key={x} strokeWidth="2" className="stroke-cyan-300/30">
              <line x1={x} x2={x} y1="86" y2="98" />
              <line x1={x} x2={x} y1="162" y2="174" />
            </g>
          ))}

          {BLOCKS.map((b) => (
            <g key={b.label}>
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx="6"
                strokeWidth="1.5"
                className="fill-slate-900/60 stroke-cyan-300/40"
              />
              <text
                x={b.x + b.w / 2}
                y={b.y + b.h / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={b.fs}
                letterSpacing="0.12em"
                className="fill-cyan-200/60 font-mono"
              >
                {b.label}
              </text>
            </g>
          ))}

          {NODES.map(([cx, cy]) => (
            <circle
              key={`${cx}-${cy}`}
              cx={cx}
              cy={cy}
              r="3.5"
              strokeWidth="1.5"
              className="fill-slate-950 stroke-cyan-300/40"
            />
          ))}
        </svg>

        {/* 배터리 본체 */}
        <div className="absolute left-1/2 top-1/2 h-[320px] w-[200px] rounded-[26px] border border-white/10 bg-gradient-to-b from-slate-800 to-slate-900 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] [transform:translate(-50%,-50%)] [transform-style:preserve-3d]">
          {/* 상단 단자 */}
          <div className="absolute -top-4 left-1/2 h-4 w-16 -translate-x-1/2 rounded-t-lg border border-b-0 border-white/10 bg-slate-700" />

          {/* SOC 게이지 */}
          <div className="absolute inset-4 flex flex-col gap-2.5 [transform:translateZ(24px)]">
            {SEGMENTS.map((filled, i) =>
              filled ? (
                <div
                  key={i}
                  className="flex-1 animate-charge-shimmer rounded-xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 bg-[length:200%_100%] shadow-[0_0_18px_rgba(45,212,191,0.45)]"
                />
              ) : (
                <div
                  key={i}
                  className="relative flex-1 rounded-xl border border-white/10 bg-white/5"
                >
                  <div className="absolute inset-0 animate-charge-pulse rounded-xl bg-gradient-to-r from-emerald-400/60 to-cyan-400/60" />
                </div>
              )
            )}
          </div>

          {/* 광택 */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[26px] bg-gradient-to-tr from-transparent via-white/[0.06] to-white/[0.12] [transform:translateZ(30px)]"
          />
        </div>

        {/* 충전 상태 표시 */}
        <div className="absolute -top-2 left-1/2 flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-slate-900/80 px-3 py-1 backdrop-blur [transform:translateX(-50%)_translateZ(70px)]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-emerald-300">
            Charging
          </span>
        </div>

        {/* 계측값 HUD */}
        <Hud className="left-0 top-14 [transform:translateZ(80px)]" label="SOC" value="82%" />
        <Hud className="right-0 top-32 [transform:translateZ(55px)]" label="Volt" value="3.98 V" />
        <Hud className="bottom-28 left-1 [transform:translateZ(65px)]" label="Temp" value="27.4 °C" />
        <Hud className="bottom-12 right-1 [transform:translateZ(90px)]" label="SOH" value="97%" />
      </div>
    </div>
  );
}
