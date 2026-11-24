import { useEffect, useState } from "react";
import hero from "../assets/hero.png";
import { StationPicker } from "../components/StationPicker";
import {
  IconArrowRight,
  IconCalendar,
  IconSwap,
  IconShield,
  IconTrain,
  IconClock,
} from "../components/icons";
import { api } from "../lib/api";
import { longDate } from "../lib/format";
type Route = { fromId: string; toId: string; fromName: string; toName: string };
export function SearchStep({
  fromId,
  toId,
  date,
  setFrom,
  setTo,
  setDate,
  onSearch,
}: {
  fromId: string;
  toId: string;
  date: string;
  setFrom: (s: string) => void;
  setTo: (s: string) => void;
  setDate: (s: string) => void;
  onSearch: () => void;
}) {
  const [routes, setRoutes] = useState<Route[]>([]);
  useEffect(() => {
    api<{ routes: Route[] }>("/config")
      .then((r) => setRoutes(r.routes))
      .catch(() => setRoutes([]));
  }, []);
  return (
    <div className="animate-rise">
      <section className="relative rounded-[32px] overflow-hidden min-h-[440px] md:min-h-[500px]">
        <img
          src={hero}
          alt="Tàu hỏa chạy dọc bờ biển miền Trung"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/45 to-transparent" />
        <div className="relative p-7 md:p-12 max-w-xl text-paper">
          <div className="inline-flex items-center gap-2 rounded-full bg-paper/15 backdrop-blur px-3 py-1.5 text-[12px] font-semibold">
            <span className="size-1.5 rounded-full bg-brass" /> Hành trình đường sắt Việt Nam
          </div>
          <h1 className="mt-5 text-4xl md:text-[56px] font-extrabold tracking-tight leading-[1.02]">
            Mỗi hành trình,
            <br />
            một ô cửa sổ.
          </h1>
          <p className="mt-4 text-paper/80 text-[16px] leading-relaxed max-w-md">
            Đặt vé tàu Bắc – Nam trong vài phút. Chọn đúng toa, đúng giường bạn muốn và nhận vé điện
            tử ngay.
          </p>
        </div>
      </section>
      <div className="relative -mt-24 md:-mt-20 mx-3 md:mx-10 rounded-[28px] bg-card border border-line shadow-2xl shadow-ink/15 p-3 md:p-4">
        <div className="grid md:grid-cols-[1fr_auto_1fr_1fr_auto] items-center gap-1 md:gap-2">
          <StationPicker label="Ga đi" value={fromId} exclude={toId} onChange={setFrom} />
          <div className="flex md:block justify-center -my-3 md:my-0 relative z-10">
            <button
              onClick={() => {
                setFrom(toId);
                setTo(fromId);
              }}
              aria-label="Đổi chiều"
              className="grid place-items-center size-11 rounded-full border border-line bg-card hover:bg-moss hover:rotate-180 transition-all duration-300 rotate-90 md:rotate-0"
            >
              <IconSwap width={18} />
            </button>
          </div>
          <StationPicker label="Ga đến" value={toId} exclude={fromId} onChange={setTo} />
          <label className="relative block rounded-2xl px-5 py-4 hover:bg-ink/[0.03] cursor-pointer md:border-l md:border-line md:rounded-l-none">
            <div className="text-[11px] font-bold tracking-[0.16em] uppercase text-muted">
              Ngày đi
            </div>
            <div className="flex gap-2 mt-1 items-center">
              <IconCalendar className="text-signal shrink-0" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent outline-none text-xl font-bold w-full"
              />
            </div>
            <div className="text-[13px] text-muted mt-0.5">
              {date ? longDate(date) : "Chọn ngày"}
            </div>
          </label>
          <button
            disabled={!fromId || !toId || !date}
            onClick={onSearch}
            className="h-14 md:h-[88px] md:w-[88px] rounded-2xl md:rounded-[22px] bg-signal text-white font-semibold flex items-center justify-center gap-2 hover:bg-signal-dark transition active:scale-[0.98] disabled:opacity-40"
          >
            <span className="md:hidden">Tìm chuyến tàu</span>
            <IconArrowRight width={26} />
          </button>
        </div>
        <div className="px-5 pt-3 pb-2 border-t border-line mt-3 text-[12px] text-muted">
          Công ty đường sắt Việt Nam đang phục vụ các chuyến tàu chạy trong khoảng thời gian từ
          10/12/2026-31/1/2027
        </div>
      </div>
      <div className="grid md:grid-cols-[1.4fr_1fr] gap-8 mt-14 px-1">
        <div>
          <h3 className="text-[11px] font-bold tracking-[0.18em] uppercase text-muted mb-4">
            Tuyến phổ biến
          </h3>
          <div className="flex flex-wrap gap-2.5">
            {routes.map((r) => (
              <button
                key={`${r.fromId}-${r.toId}`}
                onClick={() => {
                  setFrom(r.fromId);
                  setTo(r.toId);
                }}
                className="group flex items-center gap-2 h-11 pl-4 pr-3 rounded-full bg-card border border-line hover:border-ink transition"
              >
                <span className="font-semibold">{r.fromName}</span>
                <IconArrowRight width={15} className="text-muted" />
                <span className="font-semibold">{r.toName}</span>
              </button>
            ))}
          </div>
        </div>
        <ul className="grid gap-4 text-[14px]">
          {[
            [IconClock, "Giữ chỗ 10 phút", "Thong thả nhập thông tin, chỗ của bạn được giữ riêng."],
            [IconShield, "Thanh toán an toàn", "Hỗ trợ thẻ nội địa, thẻ quốc tế và ví điện tử."],
            [IconTrain, "Vé điện tử", "Xuất trình mã vé cùng giấy tờ tùy thân khi lên tàu."],
          ].map(([Icon, t, d], i) => {
            const I = Icon as typeof IconTrain;
            return (
              <li key={i} className="flex gap-3.5">
                <span className="grid place-items-center size-10 rounded-xl bg-moss text-ink shrink-0">
                  <I width={19} />
                </span>
                <div>
                  <div className="font-semibold">{t as string}</div>
                  <div className="text-muted">{d as string}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
