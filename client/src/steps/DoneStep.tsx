import { IconCheck } from "../components/icons";
import { Button } from "../components/ui";
import { seatLabel, type Contact, type Passenger, type Seat, type Trip } from "../lib/data";
import { vnd } from "../lib/format";
export function DoneStep({
  code,
  trip,
  seats,
  passengers,
  contact,
  total,
  onNew,
  onViewMine,
}: {
  code: string;
  trip: Trip;
  seats: Seat[];
  passengers: Passenger[];
  contact: Contact;
  total: number;
  onNew: () => void;
  onViewMine: () => void;
}) {
  return (
    <div className="animate-rise max-w-3xl mx-auto">
      <div className="text-center">
        <span className="inline-grid place-items-center size-16 rounded-full bg-ink text-paper">
          <IconCheck width={30} />
        </span>
        <h1 className="text-3xl md:text-4xl font-extrabold mt-5">Thanh toán thành công</h1>
        <p className="text-muted mt-2">
          Đơn đã thanh toán và vé đã được phát hành trong hệ thống mô phỏng.
        </p>
        <div className="inline-flex gap-6 mt-6 rounded-2xl bg-card border border-line px-6 py-4">
          <div>
            <div className="text-[11px] uppercase text-muted">Mã đơn</div>
            <div className="font-mono text-lg font-bold text-signal">{code}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase text-muted">Tổng tiền</div>
            <div className="text-xl font-bold">{vnd(total)}</div>
          </div>
        </div>
      </div>
      <div className="space-y-3 mt-9">
        {seats.map((s, i) => (
          <article key={i} className="rounded-3xl bg-card border border-line p-6">
            <div className="font-bold">{passengers[i]?.fullName}</div>
            <div className="text-[13px] text-muted mt-2">
              {trip.trainCode} · {trip.from.name} → {trip.to.name} · {trip.date}
            </div>
            <div className="text-[13px] mt-2">
              {seatLabel(s)} · {vnd(s.price)}
            </div>
            <div className="text-[12px] text-muted mt-2">Vé có hiệu lực</div>
          </article>
        ))}
      </div>
      <div className="flex justify-center gap-3 mt-10">
        <Button variant="ghost" onClick={onNew}>
          Đặt đơn mới
        </Button>
        <Button variant="dark" onClick={onViewMine}>
          Tra cứu đơn
        </Button>
      </div>
    </div>
  );
}
