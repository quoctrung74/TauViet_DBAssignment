import type { ReactNode } from "react";
import { IconHome, IconRefund, IconSearch, IconTicket, IconTrain } from "./icons";

export type View = "home" | "book" | "manage" | "mine" | "admin";

const ITEMS: { id: View; label: string; Icon: typeof IconHome }[] = [
  { id: "home", label: "Trang chủ", Icon: IconHome },
  { id: "book", label: "Tìm vé", Icon: IconSearch },
  { id: "manage", label: "Đổi/Trả vé", Icon: IconRefund },
  { id: "mine", label: "Đơn của tôi", Icon: IconTicket },
  { id: "admin", label: "Quản trị", Icon: IconTrain },
];

export function NavBar({
  view,
  onNavigate,
  ticketCount,
}: {
  view: View;
  onNavigate: (v: View) => void;
  ticketCount: number;
}) {
  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-6">
      <div className="h-16 flex items-center justify-between gap-4">
        <button onClick={() => onNavigate("home")} className="flex items-center gap-2.5 shrink-0">
          <span className="grid place-items-center size-9 rounded-xl bg-ink text-paper">
            <IconTrain width={19} />
          </span>
          <span className="font-extrabold tracking-tight text-[17px]">
            Tàu Việt<span className="text-signal">.</span>
          </span>
        </button>

        <nav className="hidden md:flex items-center gap-1 rounded-full bg-card border border-line p-1">
          {ITEMS.map(({ id, label, Icon }) => (
            <NavItem
              key={id}
              active={view === id}
              onClick={() => onNavigate(id)}
              badge={id === "mine" ? ticketCount : 0}
            >
              <Icon width={17} />
              {label}
            </NavItem>
          ))}
        </nav>

        <span className="hidden lg:block text-[13px] text-muted shrink-0">Tổng đài 1900 0109</span>
      </div>

      {/* Mobile: full-width tab row under the brand */}
      <nav className="md:hidden grid grid-cols-5 gap-1 pb-2">
        {ITEMS.map(({ id, label, Icon }) => {
          const active = view === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`relative flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold transition ${
                active ? "bg-ink text-paper" : "text-muted"
              }`}
            >
              <Icon width={18} />
              {label}
              {id === "mine" && ticketCount > 0 && (
                <span className="absolute top-0.5 right-3 grid place-items-center min-w-4 h-4 px-1 rounded-full bg-signal text-white text-[10px]">
                  {ticketCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function NavItem({
  active,
  onClick,
  badge,
  children,
}: {
  active: boolean;
  onClick: () => void;
  badge: number;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2 h-9 px-4 rounded-full text-[14px] font-semibold transition ${
        active ? "bg-ink text-paper" : "text-ink-soft hover:bg-ink/5"
      }`}
    >
      {children}
      {badge > 0 && (
        <span
          className={`grid place-items-center min-w-5 h-5 px-1 rounded-full text-[11px] ${active ? "bg-signal text-white" : "bg-signal/10 text-signal"}`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
