import { useEffect, useState, type ReactNode } from "react";
import { IconClock, IconX } from "./icons";
import { seatKey, seatLabel, type Seat, type Trip, type Passenger } from "../lib/data";
import { vnd } from "../lib/format";
export function orderTotal(seats: Seat[], _passengers: Passenger[]) {
  return seats.reduce((total, seat) => total + seat.price, 0);
}
export function HoldTimer({ until }: { until: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const seconds = Math.max(0, Math.ceil((until - now) / 1000));
  return (
    <div className="flex items-center gap-2.5 rounded-2xl px-4 py-3 text-[13px] bg-moss text-ink">
      <IconClock width={18} />
      Chỗ của bạn được giữ trong
      <span className="ml-auto font-mono font-bold">
        {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
      </span>
    </div>
  );
}
export function Summary({
  trip,
  seats,
  passengers,
  onRemoveSeat,
  hold,
  action,
}: {
  trip: Trip | null;
  seats: Seat[];
  passengers: Passenger[];
  onRemoveSeat?: (s: Seat) => void;
  hold?: ReactNode;
  action?: ReactNode;
}) {
  const total = orderTotal(seats, passengers);
  return (
    <aside className="rounded-3xl bg-ink text-paper overflow-hidden">
      <div className="p-6">
        <div className="text-[11px] font-bold tracking-[0.18em] uppercase text-brass">
          Chuyến đi của bạn
        </div>
        {trip ? (
          <>
            <div className="flex justify-between mt-4">
              <span className="font-mono text-[13px] px-2 py-0.5 rounded-md bg-paper/10">
                Tàu {trip.trainCode}
              </span>
              <span className="text-[13px] text-paper/60">{trip.date}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mt-4">
              <div>
                <div className="text-2xl font-bold tabular-nums">{trip.departAt.slice(11, 16)}</div>
                <div className="text-[13px] text-paper/70">{trip.from.name}</div>
              </div>
              <div className="text-center text-paper/50">→</div>
              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums">{trip.arriveAt.slice(11, 16)}</div>
                <div className="text-[13px] text-paper/70">{trip.to.name}</div>
              </div>
            </div>
          </>
        ) : (
          <p className="text-paper/60 text-sm mt-3">Chọn chuyến tàu để xem chi tiết hành trình.</p>
        )}
      </div>
      {trip && (
        <div className="border-t border-dashed border-paper/20 p-6">
          <div className="flex justify-between text-[13px] text-paper/60 mb-3">
            <span>Chỗ đã chọn</span>
            <span>{seats.length}/10</span>
          </div>
          {seats.length === 0 ? (
            <p className="text-sm text-paper/50">Chưa có chỗ nào được chọn.</p>
          ) : (
            <ul className="space-y-2.5 max-h-64 overflow-auto">
              {seats.map((s, i) => (
                <li key={seatKey(s)} className="flex items-start gap-3 text-sm">
                  <span className="grid place-items-center min-w-9 h-9 rounded-lg bg-paper/10 font-mono font-bold">
                    {s.number}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{seatLabel(s)}</div>
                    <div className="text-[12px] text-paper/55">
                      {passengers[i]?.fullName || ""} ·{" "}
                      {passengers[i]?.typeName || passengers[i]?.type || "DT01"}
                    </div>
                  </div>
                  <span className="font-medium tabular-nums">{vnd(s.price)}</span>
                  {onRemoveSeat && (
                    <button
                      onClick={() => onRemoveSeat(s)}
                      aria-label="Bỏ chọn"
                      className="text-paper/40 hover:text-paper"
                    >
                      <IconX width={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="bg-paper/[0.06] p-6 space-y-4">
        <div className="flex justify-between items-end">
          <div>
            <div className="text-[13px] text-paper/60">Tổng tiền dự kiến</div>
          </div>
          <div className="text-[26px] font-bold tabular-nums">{vnd(total)}</div>
        </div>
        {hold}
        {action && <div className="hidden lg:block">{action}</div>}
      </div>
    </aside>
  );
}
