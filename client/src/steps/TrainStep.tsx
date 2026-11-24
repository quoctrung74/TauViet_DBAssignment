import { useEffect, useState } from "react";
import { StationPicker } from "../components/StationPicker";
import { IconArrowRight, IconCalendar, IconSwap } from "../components/icons";
import { SectionTitle } from "../components/ui";
import { api, qs } from "../lib/api";
import { stationById, type Trip } from "../lib/data";
import { addDays, shortDate } from "../lib/format";
const minute = (date: string) => {
  const d = new Date(date);
  return d.getHours() * 60 + d.getMinutes();
};
const displayTime = (date: string) => (date ? date.slice(11, 16) : "--:--");
export function TrainStep({
  fromId,
  toId,
  date,
  setFrom,
  setTo,
  setDate,
  selected,
  onSelect,
}: {
  fromId: string;
  toId: string;
  date: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  setDate: (v: string) => void;
  selected: Trip | null;
  onSelect: (t: Trip) => void;
}) {
  const [trips, setTrips] = useState<Trip[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<Record<string, { cars: number; seats: number }>>({});
  const from = stationById(fromId),
    to = stationById(toId);
  useEffect(() => {
    if (!fromId || !toId || !date) {
      setTrips([]);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    setCounts({});
    api<{ trips: any[] }>(`/trips?${qs({ from: fromId, to: toId, date })}`)
      .then((data) => {
        if (!active) return;
        const next: Trip[] = data.trips.map((row) => {
          const departAt = String(row.ThoiGianDiDuKien).replace(" ", "T"),
            arriveAt = String(row.ThoiGianDenDuKien).replace(" ", "T");
          const t: Trip = {
            key: row.MaChuyenTau,
            trainId: row.MaChuyenTau,
            trainCode: row.MaMacTau,
            from,
            to,
            date: departAt.slice(0, 10),
            departAt,
            arriveAt,
            depMin: minute(departAt),
            arrMin: minute(arriveAt),
            fromSeq: row.ThuTuGaLen,
            toSeq: row.ThuTuGaXuong,
            status: row.TrangThai,
          };
          return t;
        });
        setTrips(next);
        for (const t of next)
          api<{ cars: any[] }>(`/trips/${encodeURIComponent(t.trainId)}/cars`)
            .then((r) => {
              if (active)
                setCounts((prev) => ({
                  ...prev,
                  [t.trainId]: {
                    cars: r.cars.length,
                    seats: r.cars.reduce((s, c) => s + Number(c.TongSoCho), 0),
                  },
                }));
            })
            .catch(() => {});
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setTrips([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fromId, toId, date]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(date, i - 3));
  return (
    <div className="animate-rise">
      <SectionTitle
        eyebrow="Bước 2 · Chọn chuyến"
        title={`${from.name} → ${to.name}`}
        desc={`${trips.length} chuyến tàu · ${date}`}
      />
      <div className="grid sm:grid-cols-[1fr_auto_1fr_1fr] items-center gap-1 rounded-3xl bg-card border border-line p-2 mb-4">
        <StationPicker compact label="Ga đi" value={fromId} exclude={toId} onChange={setFrom} />
        <button
          onClick={() => {
            setFrom(toId);
            setTo(fromId);
          }}
          aria-label="Đổi chiều"
          className="justify-self-center grid place-items-center size-9 rounded-full border border-line hover:bg-moss transition rotate-90 sm:rotate-0"
        >
          <IconSwap width={16} />
        </button>
        <StationPicker compact label="Ga đến" value={toId} exclude={fromId} onChange={setTo} />
        <label className="block rounded-2xl px-4 py-2.5 hover:bg-ink/[0.03] cursor-pointer sm:border-l sm:border-line">
          <div className="text-[11px] font-bold tracking-[0.16em] uppercase text-muted">
            Ngày đi
          </div>
          <div className="flex gap-2">
            <IconCalendar width={17} className="text-signal" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent outline-none text-lg font-bold w-full"
            />
          </div>
        </label>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
        {days.map((d) => {
          const x = shortDate(d);
          return (
            <button
              key={d}
              onClick={() => setDate(d)}
              className={`shrink-0 w-[76px] py-2.5 rounded-2xl border text-center ${date === d ? "bg-ink text-paper border-ink" : "bg-card border-line"}`}
            >
              <div className="text-[11px]">{x.wd}</div>
              <div className="font-bold">{x.dm}</div>
            </button>
          );
        })}
      </div>
      {loading && (
        <div className="rounded-3xl bg-card border border-line p-6">
          Đang gọi procedure sp_tim_chuyen_tau...
        </div>
      )}
      {error && (
        <div className="rounded-3xl bg-card border border-signal p-6 text-signal">{error}</div>
      )}
      {!loading && !error && trips.length === 0 && (
        <div className="rounded-3xl bg-card border border-line p-6 text-muted">
          Không tìm thấy chuyến trong PostgreSQL cho ngày và cặp ga đã chọn. Hệ thống không tự sinh
          chuyến giả.
        </div>
      )}
      <div className="space-y-3">
        {trips.map((t, i) => {
          const past = new Date(t.departAt).getTime() <= Date.now();
          return (
            <div
              key={t.key}
              style={{ animationDelay: `${i * 50}ms` }}
              className={`animate-rise rounded-3xl border bg-card ${selected?.key === t.key ? "border-ink ring-4 ring-ink/10" : "border-line"} ${past ? "opacity-75" : ""}`}
            >
              <div className="p-5 md:p-6 grid md:grid-cols-[110px_1fr_auto] gap-5 items-center">
                <div>
                  <div className="font-mono font-bold text-2xl">{t.trainCode}</div>
                  <div className="text-[12px] text-muted">{t.trainId}</div>
                </div>
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
                  <div>
                    <div className="text-[28px] font-bold tabular-nums">
                      {displayTime(t.departAt)}
                    </div>
                    <div className="text-[13px] text-muted">{t.from.name}</div>
                  </div>
                  <div className="h-px bg-line">
                    <div className="text-center text-[11px] text-muted -mt-6">{t.date}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[28px] font-bold tabular-nums">
                      {displayTime(t.arriveAt)}
                    </div>
                    <div className="text-[13px] text-muted">{t.to.name}</div>
                  </div>
                </div>
                <button
                  onClick={() => onSelect(t)}
                  className="h-12 px-5 rounded-full bg-ink text-paper font-semibold flex items-center justify-center gap-2 hover:bg-signal transition"
                >
                  {past ? "Xem dữ liệu chuyến" : "Chọn chuyến"}
                  <IconArrowRight width={17} />
                </button>
              </div>
              <div className="px-6 py-3 border-t border-line text-[13px] text-muted">
                {counts[t.trainId]
                  ? `${counts[t.trainId].cars} toa · ${counts[t.trainId].seats} chỗ`
                  : "Đang lấy dữ liệu toa bằng sp_tong_hop_cho_theo_toa..."}
                {past ? " · Chuyến thuộc dữ liệu lịch sử" : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
