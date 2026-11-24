import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getStationCatalogue, stationById, subscribeStations } from "../lib/data";
import { refreshStations } from "../lib/stationApi";
import { normalize } from "../lib/format";
import { IconSearch } from "./icons";
export function StationPicker({
  label,
  value,
  exclude,
  onChange,
  align = "left",
  compact = false,
}: {
  label: string;
  value: string;
  exclude?: string;
  onChange: (s: string) => void;
  align?: "left" | "right";
  compact?: boolean;
}) {
  const stations = useSyncExternalStore(subscribeStations, getStationCatalogue);
  const station = stationById(value);
  const [open, setOpen] = useState(false),
    [q, setQ] = useState(""),
    [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", click);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const list = stations.filter(
    (s) =>
      s.id !== exclude &&
      (normalize(s.name).includes(normalize(q)) || normalize(s.region).includes(normalize(q))),
  );
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setQ("");
          setError("");
          void refreshStations().catch((e) => setError(e.message));
        }}
        className={`w-full text-left rounded-2xl hover:bg-ink/[0.03] transition ${compact ? "px-4 py-2.5" : "px-5 py-4"} ${align === "right" ? "md:text-right" : ""}`}
      >
        <div className="text-[11px] font-bold tracking-[0.16em] uppercase text-muted">{label}</div>
        <div
          className={`font-bold tracking-tight mt-1 ${compact ? "text-lg" : "text-2xl md:text-[28px]"}`}
        >
          {station.name}
        </div>
        {!compact && (
          <div className="text-[13px] text-muted mt-0.5">
            {station.name === "Chọn ga"
              ? "Dữ liệu trực tiếp PostgreSQL"
              : `Ga ${station.name} · ${station.region}`}
          </div>
        )}
      </button>
      {open && (
        <div className="absolute z-30 top-full mt-2 w-[min(340px,calc(100vw-48px))] rounded-2xl bg-card border border-line shadow-2xl shadow-ink/15 overflow-hidden animate-rise left-0">
          <div className="flex items-center gap-2 px-4 border-b border-line">
            <IconSearch className="text-muted shrink-0" width={18} />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm ga hoặc tỉnh thành…"
              className="w-full h-12 bg-transparent outline-none text-[15px]"
            />
          </div>
          <ul className="max-h-72 overflow-auto py-1.5">
            {error && <li className="p-3 text-signal text-sm">{error}</li>}
            {!error && list.length === 0 && (
              <li className="px-4 py-6 text-center text-muted text-sm">
                Không có ga phù hợp trong PostgreSQL
              </li>
            )}
            {list.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => {
                    onChange(s.id);
                    setOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-moss/70"
                >
                  <span>
                    <span className="font-semibold">{s.name}</span>
                    <span className="text-muted text-[13px] ml-2">{s.region}</span>
                  </span>
                  <span className="font-mono text-[11px] text-muted">{s.id}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
