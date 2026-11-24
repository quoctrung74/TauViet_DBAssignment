import { IconCheck } from "./icons";

export const STEPS = ["Hành trình", "Chuyến tàu", "Toa & chỗ", "Hành khách", "Thanh toán"];

export function Stepper({ step, onJump }: { step: number; onJump: (i: number) => void }) {
  return (
    <ol className="flex items-center gap-1 md:gap-2 overflow-x-auto min-w-0 no-print">
      {STEPS.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <li key={label} className="flex items-center gap-1 md:gap-2 shrink-0">
            <button
              disabled={!done}
              onClick={() => onJump(i)}
              className={`flex items-center gap-2 rounded-full pl-1 pr-3 h-8 text-[13px] font-semibold transition ${
                active ? "bg-ink text-paper" : done ? "text-ink hover:bg-ink/5" : "text-muted/70"
              }`}
            >
              <span
                className={`grid place-items-center size-6 rounded-full text-[11px] font-bold ${
                  active ? "bg-signal text-white" : done ? "bg-moss text-ink" : "border border-line"
                }`}
              >
                {done ? <IconCheck width={13} height={13} strokeWidth={3} /> : i + 1}
              </span>
              <span className={active ? "" : "hidden sm:inline"}>{label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <span className={`w-4 md:w-8 h-px ${done ? "bg-ink/40" : "bg-line"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
