import { useEffect, useMemo, useState } from "react";
import { IconBed, IconSeat } from "../components/icons";
import { SectionTitle } from "../components/ui";
import { api, qs } from "../lib/api";
import { seatKey, type Car, type Seat, type Trip } from "../lib/data";
import { vnd } from "../lib/format";
const MAX_SEATS = 10;
type RawSeat = {
  carNo: number;
  number: number;
  tier: string | null;
  carTypeId: string;
  carTypeName: string;
  available: boolean;
  price: number;
};
export function SeatStep({
  trip,
  selected,
  onToggle,
}: {
  trip: Trip;
  selected: Seat[];
  onToggle: (s: Seat) => void;
}) {
  const [cars, setCars] = useState<Car[]>([]),
    [carNo, setCarNo] = useState(1),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [warning, setWarning] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<{ seats: RawSeat[] }>(
      `/trips/${encodeURIComponent(trip.trainId)}/seats?${qs({ from: trip.from.id, to: trip.to.id })}`,
    )
      .then((result) => {
        if (!active) return;
        const grouped = new Map<number, Car>();
        result.seats.forEach((item) => {
          const type =
            item.carTypeId === "LT01"
              ? "seat"
              : item.carTypeId === "LT02"
                ? "k4"
                : item.carTypeId === "LT03"
                  ? "k6"
                  : "other";
          const s: Seat = {
            carNo: item.carNo,
            number: item.number,
            carType: type,
            carTypeName: item.carTypeName,
            tier: item.tier ? Number(item.tier) : undefined,
            price: item.price,
            taken: !item.available,
          };
          if (!grouped.has(item.carNo))
            grouped.set(item.carNo, {
              no: item.carNo,
              type,
              name: item.carTypeName,
              seats: [],
              free: 0,
            });
          const car = grouped.get(item.carNo)!;
          car.seats.push(s);
          if (!s.taken) car.free++;
        });
        const list = [...grouped.values()].sort((a, b) => a.no - b.no);
        setCars(list);
        setCarNo(list[0]?.no ?? 1);
      })
      .catch((e) => {
        if (active) {
          setCars([]);
          setError(e.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [trip.trainId, trip.from.id, trip.to.id]);
  const car = useMemo(() => cars.find((c) => c.no === carNo), [cars, carNo]);
  const keys = new Set(selected.map(seatKey));
  const toggle = (s: Seat) => {
    if (s.taken) return;
    if (!keys.has(seatKey(s)) && selected.length >= MAX_SEATS) {
      setWarning("Mỗi lần đặt tối đa 10 chỗ");
      return;
    }
    setWarning("");
    onToggle(s);
  };
  return (
    <div className="animate-rise">
      <SectionTitle
        eyebrow="Bước 3 · Chọn toa & chỗ"
        title="Chọn toa, rồi chọn chỗ ngồi"
        desc={`Chuyến ${trip.trainCode} (${trip.trainId})`}
      />
      {loading && (
        <div className="rounded-3xl bg-card border border-line p-5">
          Đang gọi fn_kiem_tra_cho_theo_chang và fn_tinh_gia_ve_du_kien...
        </div>
      )}
      {error && (
        <div className="rounded-3xl bg-card border border-signal p-5 text-signal">{error}</div>
      )}
      {!loading && !error && cars.length === 0 && (
        <div className="rounded-3xl bg-card p-5">Chuyến này chưa có toa/chỗ trong PostgreSQL.</div>
      )}
      {cars.length > 0 && (
        <>
          <div className="rounded-3xl bg-card border border-line p-4 md:p-5">
            <div className="flex justify-between mb-3 text-[13px] font-semibold">
              <span>Chọn toa</span>
              <span className="text-muted">← Đầu tàu</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <div className="shrink-0 w-16 h-[76px] rounded-l-[28px] rounded-r-lg bg-ink grid place-items-center text-paper text-[11px] font-mono">
                {trip.trainCode}
              </div>
              {cars.map((c) => (
                <button
                  key={c.no}
                  onClick={() => setCarNo(c.no)}
                  className={`relative shrink-0 w-[104px] h-[76px] rounded-lg border-2 px-2.5 py-2 text-left transition ${c.no === carNo ? "bg-ink border-ink text-paper" : "bg-white border-line hover:border-ink/40"}`}
                >
                  <div className="text-[13px] font-bold">Toa {c.no}</div>
                  <div className="text-[11px]">{c.name}</div>
                  <div className="text-[11px] font-semibold">
                    {c.free}/{c.seats.length} chỗ
                  </div>
                </button>
              ))}
            </div>
          </div>
          {car && (
            <div className="mt-5 rounded-3xl bg-card border border-line p-4 md:p-6">
              <div className="flex flex-wrap justify-between items-start gap-4 mb-5">
                <div className="flex items-center gap-3">
                  <span className="grid place-items-center size-11 rounded-xl bg-moss">
                    {car.type === "seat" ? <IconSeat /> : <IconBed />}
                  </span>
                  <div>
                    <div className="font-bold text-lg">
                      Toa {car.no}: {car.name}
                    </div>
                    <div className="text-[13px] text-muted">
                      Còn {car.free}/{car.seats.length} chỗ trên chặng này
                    </div>
                  </div>
                </div>
                <div className="rounded-full bg-paper px-3 py-1.5 text-[12px]">
                  Giá người lớn từ {vnd(Math.min(...car.seats.map((s) => s.price)))}
                </div>
              </div>
              <div className="overflow-x-auto pb-2">
                <SeatMap car={car} selectedKeys={keys} onToggle={toggle} />
              </div>
              <div className="flex flex-wrap items-center gap-5 mt-5 pt-4 border-t border-line text-[12px] text-muted">
                <span>□ Còn trống</span>
                <span className="text-signal">■ Đang chọn</span>
                <span>▤ Đã bán trên chặng</span>
                {warning && <span className="text-signal">{warning}</span>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SeatMap({
  car,
  selectedKeys,
  onToggle,
}: {
  car: Car;
  selectedKeys: Set<string>;
  onToggle: (seat: Seat) => void;
}) {
  const seatButton = (s: Seat | undefined) =>
    s ? (
      <button
        key={s.number}
        disabled={s.taken}
        onClick={() => onToggle(s)}
        title={`Chỗ ${s.number} · ${vnd(s.price)} · ${s.taken ? "Đã bán" : "Còn trống trên chặng"}`}
        className={`grid place-items-center size-10 md:size-11 rounded-lg text-[12px] font-bold tabular-nums transition ${s.taken ? "bg-ink/[0.06] hatch text-ink/25 cursor-not-allowed" : selectedKeys.has(seatKey(s)) ? "bg-signal text-white shadow-md shadow-signal/40" : "bg-white border border-ink/25 hover:border-ink hover:bg-moss"}`}
      >
        {s.number}
      </button>
    ) : null;
  if (car.type === "seat") {
    const n = Math.ceil(car.seats.length / 4);
    const row = (r: number) => (
      <div className="flex gap-1.5">
        {Array.from({ length: n }, (_, c) => seatButton(car.seats[c * 4 + r]))}
      </div>
    );
    return (
      <div className="inline-block rounded-[28px] border-2 border-line bg-paper/60 px-5 py-4">
        <div className="space-y-1.5">
          {row(0)}
          {row(1)}
        </div>
        <div className="h-8 flex items-center justify-center text-[11px] tracking-[0.3em] uppercase text-muted/70">
          Lối đi
        </div>
        <div className="space-y-1.5">
          {row(2)}
          {row(3)}
        </div>
      </div>
    );
  }
  // Du lieu PostgreSQL: STTCho duoc phan theo tang (LT02: 8 cho/tang, LT03: 6 cho/tang).
  // Phan bo thanh cac khoang: moi khoang 2 giuong / tang. Khong gia lap cho moi.
  const tiers = car.type === "k6" ? [1, 2, 3] : [1, 2];
  const perComp = tiers.length * 2;
  const tierSeats = new Map(
    tiers.map((t) => [
      t,
      car.seats.filter((s) => s.tier === t).sort((a, b) => a.number - b.number),
    ]),
  );
  const compartments = Math.ceil(car.seats.length / perComp);
  return (
    <div className="inline-block rounded-[28px] border-2 border-line bg-paper/60 p-4">
      <div className="flex gap-2">
        {Array.from({ length: compartments }, (_, idx) => (
          <div key={idx} className="rounded-2xl bg-white/70 border border-line p-2">
            <div className="text-[11px] leading-4 font-semibold text-muted text-center mb-1.5">
              Khoang {idx + 1}
            </div>
            <div className="space-y-1.5">
              {[...tiers].reverse().map((t) => (
                <div key={t}>
                  <div className="text-[10px] text-center text-muted mb-0.5">Tầng {t}</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {tierSeats
                      .get(t)
                      ?.slice(idx * 2, idx * 2 + 2)
                      .map(seatButton)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 h-7 rounded-xl bg-ink/[0.04] flex items-center justify-center text-[11px] tracking-[0.3em] uppercase text-muted/70">
        Hành lang
      </div>
    </div>
  );
}
