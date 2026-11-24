import { useEffect, useState } from "react";
import { api, qs } from "../lib/api";
import { SectionTitle, Field, Button, inputCls } from "../components/ui";
import { IconArrowLeft } from "../components/icons";
import { todayISO, vnd } from "../lib/format";

type Item = {
  itemNo: number;
  passengerName: string;
  customerName: string;
  trainId: string;
  trainCode: string;
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  departure: string;
  carNo: number;
  seatNo: number;
  price: number;
  eligible: boolean;
  ticketId: string | null;
  ticketStatus: string | null;
};
type Target = { trainId: string; carNo: number; seatNo: number };
type TripOption = { MaChuyenTau: string; MaMacTau: string; ThoiGianDiDuKien: string };
type SeatOption = { carNo: number; number: number; carTypeName: string; available: boolean };
type Result = {
  ticketId: string;
  passengerName: string;
  oldPrice: number;
  newPrice: number;
  fee: number;
  settlement: number;
  requestId?: string;
  replacementTicketId?: string;
  replacementOrderId?: string;
};
type Action = "return" | "exchange";
const card = "rounded-3xl bg-card border border-line p-5 md:p-7";

function ExchangeChoice({
  item,
  disabled,
  onChange,
}: {
  item: Item;
  disabled: boolean;
  onChange: (target: Target | null) => void;
}) {
  const [date, setDate] = useState(item.departure.slice(0, 10));
  const [trainId, setTrainId] = useState("");
  const [seat, setSeat] = useState("");
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [seats, setSeats] = useState<SeatOption[]>([]);
  const [tripMessage, setTripMessage] = useState("");
  const [seatMessage, setSeatMessage] = useState("");
  const { fromId: from, toId: to } = item;
  useEffect(() => {
    if (!date) return;
    let active = true;
    setTripMessage("Đang tìm chuyến…");
    api<{ trips: TripOption[] }>(`/trips?${qs({ from, to, date })}`)
      .then(({ trips }) => {
        if (!active) return;
        const future = trips.filter(
          (t) => new Date(t.ThoiGianDiDuKien.replace(" ", "T") + "+07:00").getTime() > Date.now(),
        );
        setTrips(future);
        setTripMessage(future.length ? "" : "Không có chuyến phù hợp trong ngày này.");
      })
      .catch((e: Error) => {
        if (active) setTripMessage(e.message);
      });
    return () => {
      active = false;
    };
  }, [date, from, to]);
  useEffect(() => {
    if (!trainId) return;
    let active = true;
    setSeatMessage("Đang tìm chỗ trống…");
    api<{ seats: SeatOption[] }>(`/trips/${encodeURIComponent(trainId)}/seats?${qs({ from, to })}`)
      .then(({ seats }) => {
        if (!active) return;
        const available = seats.filter(
          (s) =>
            s.available &&
            !(trainId === item.trainId && s.carNo === item.carNo && s.number === item.seatNo),
        );
        setSeats(available);
        setSeatMessage(available.length ? "" : "Chuyến này không còn chỗ phù hợp.");
      })
      .catch((e: Error) => {
        if (active) setSeatMessage(e.message);
      });
    return () => {
      active = false;
    };
  }, [trainId, from, to, item.trainId, item.carNo, item.seatNo]);
  return (
    <fieldset disabled={disabled} className="rounded-2xl border border-line p-4">
      <legend className="px-2 font-semibold">
        {item.passengerName} · {item.ticketId}
      </legend>
      <p className="text-sm text-muted mb-3">
        {item.fromName} → {item.toName}
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Ngày đi mới">
          <input
            className={inputCls()}
            type="date"
            min={todayISO()}
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setTrips([]);
              setTripMessage("");
              setTrainId("");
              setSeats([]);
              setSeatMessage("");
              setSeat("");
              onChange(null);
            }}
          />
        </Field>
        <Field label="Chuyến thay thế">
          <select
            className={inputCls()}
            value={trainId}
            disabled={!trips.length}
            onChange={(e) => {
              setTrainId(e.target.value);
              setSeats([]);
              setSeatMessage("");
              setSeat("");
              onChange(null);
            }}
          >
            <option value="">Chọn chuyến</option>
            {trips.map((t) => (
              <option key={t.MaChuyenTau} value={t.MaChuyenTau}>
                {t.MaMacTau} · {t.ThoiGianDiDuKien.slice(11, 16)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Chỗ thay thế">
          <select
            className={inputCls()}
            value={seat}
            disabled={!seats.length}
            onChange={(e) => {
              setSeat(e.target.value);
              const choice = seats.find((s) => `${s.carNo}:${s.number}` === e.target.value);
              onChange(choice ? { trainId, carNo: choice.carNo, seatNo: choice.number } : null);
            }}
          >
            <option value="">Chọn chỗ</option>
            {seats.map((s) => (
              <option key={`${s.carNo}:${s.number}`} value={`${s.carNo}:${s.number}`}>
                Toa {s.carNo} · Chỗ {s.number} · {s.carTypeName}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {(tripMessage || seatMessage) && (
        <p className="text-sm text-muted mt-2">{tripMessage || seatMessage}</p>
      )}
    </fieldset>
  );
}

function ChangeOrder({
  orderId,
  items,
  onBack,
  onOpen,
}: {
  orderId: string;
  items: Item[];
  onBack: () => void;
  onOpen: (id: string) => void;
}) {
  const [chosen, setChosen] = useState<string[]>([]);
  const [action, setAction] = useState<Action>("return");
  const [targets, setTargets] = useState<Record<string, Target | null>>({});
  const [quote, setQuote] = useState<Result[]>([]);
  const [done, setDone] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [changed, setChanged] = useState<string[]>([]);
  const selected = items.filter((item) => item.ticketId && chosen.includes(item.ticketId));
  const canQuote =
    selected.length > 0 &&
    (action === "return" || selected.every((item) => targets[item.ticketId!]));
  const invalidate = () => {
    setQuote([]);
    setError("");
    setDone([]);
  };
  const submit = async (confirm: boolean) => {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ results: Result[] }>(
        `/orders/${encodeURIComponent(orderId)}/ticket-changes${confirm ? "" : "/quote"}`,
        {
          method: "POST",
          body: JSON.stringify({
            action,
            tickets: selected.map(({ ticketId }) => ({
              ticketId,
              ...(action === "exchange" && targets[ticketId!]),
            })),
            expectedSettlements: confirm ? quote.map((r) => r.settlement) : undefined,
          }),
        },
      );
      if (confirm) {
        setDone(data.results);
        setChanged((prev) => [...prev, ...data.results.map((r) => r.ticketId)]);
        setChosen([]);
        setQuote([]);
        setTargets({});
      } else setQuote(data.results);
    } catch (e) {
      setQuote([]);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const net = quote.reduce((sum, row) => sum + Math.round(row.settlement * 100), 0) / 100;
  return (
    <div className="animate-rise max-w-4xl space-y-5">
      <button
        type="button"
        disabled={busy}
        onClick={onBack}
        className="flex gap-2 items-center font-semibold text-muted"
      >
        <IconArrowLeft width={16} /> Tra cứu đặt chỗ khác
      </button>
      <SectionTitle
        eyebrow={`Mã đặt chỗ ${orderId}`}
        title="Đổi hoặc trả vé"
        desc={`Người đặt: ${items[0].customerName}`}
      />
      <section className={card}>
        <h2 className="text-lg font-bold mb-4">1. Chọn vé</h2>
        <div className="space-y-2">
          {items.map((item) => {
            const id = item.ticketId;
            const checked = !!id && chosen.includes(id);
            const cancelled = !!id && changed.includes(id);
            return (
              <label
                key={item.itemNo}
                className={`flex flex-wrap gap-3 items-center rounded-2xl p-4 border ${checked ? "border-ink bg-moss" : "border-line"}`}
              >
                <input
                  type="checkbox"
                  className="size-5 accent-signal"
                  checked={checked}
                  disabled={
                    busy || !item.eligible || cancelled || (!checked && chosen.length >= 10)
                  }
                  onChange={() => {
                    if (!id) return;
                    invalidate();
                    setChosen((prev) => (checked ? prev.filter((x) => x !== id) : [...prev, id]));
                    setTargets((prev) => ({ ...prev, [id]: null }));
                  }}
                />
                <div className="flex-1">
                  <div className="font-semibold">{item.passengerName}</div>
                  <div className="text-sm text-muted">
                    Tàu {item.trainCode} · {item.departure.slice(0, 16)} · Toa {item.carNo} · Chỗ{" "}
                    {item.seatNo}
                  </div>
                </div>
                <span className="font-semibold">{money(item.price)}</span>
                <span className="rounded-full bg-paper px-3 py-1 text-sm">
                  {cancelled
                    ? "Đã hủy"
                    : item.ticketStatus === "Có hiệu lực" && !item.eligible
                      ? "Không thể đổi/trả"
                      : item.ticketStatus || "Chưa phát hành"}
                </span>
              </label>
            );
          })}
        </div>
      </section>
      <section className={`${card} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">2. Chọn thao tác</h2>
          <div className="inline-flex gap-1 rounded-full bg-paper p-1">
            {(["return", "exchange"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={action === value}
                disabled={busy}
                onClick={() => {
                  if (action !== value) {
                    setAction(value);
                    setTargets({});
                    invalidate();
                  }
                }}
                className={`rounded-full px-4 py-2 font-semibold ${action === value ? "bg-ink text-paper" : ""}`}
              >
                {value === "return" ? "Trả vé" : "Đổi chuyến"}
              </button>
            ))}
          </div>
        </div>
        {!selected.length && !done.length && (
          <p className="text-muted">Chọn vé còn đủ điều kiện để tiếp tục.</p>
        )}
        {action === "exchange" &&
          selected.map((item) => (
            <ExchangeChoice
              key={item.ticketId}
              item={item}
              disabled={busy}
              onChange={(target) => {
                setTargets((prev) => ({ ...prev, [item.ticketId!]: target }));
                invalidate();
              }}
            />
          ))}
        {error && (
          <p role="alert" className="text-signal">
            {error}
          </p>
        )}
        {!!quote.length && (
          <>
            <ul className="divide-y divide-line border-b border-line">
              {quote.map((r) => (
                <li key={r.ticketId} className="py-3 flex flex-wrap justify-between gap-2">
                  <span className="font-semibold">{r.passengerName}</span>
                  <span className="text-sm text-muted">
                    Vé cũ {money(r.oldPrice)} ·{" "}
                    {action === "exchange" && `Vé mới ${money(r.newPrice)} · `}
                    Phí 10% {money(r.fee)} · {settlementLabel(r.settlement)}{" "}
                    {money(Math.abs(r.settlement))}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div>
                <div className="text-sm text-muted">{settlementLabel(net)} (tổng ròng)</div>
                <div className="text-2xl font-bold">{money(Math.abs(net))}</div>
              </div>
              <Button disabled={busy} onClick={() => void submit(true)}>
                {busy
                  ? "Đang xử lý…"
                  : `Xác nhận ${action === "return" ? "trả" : "đổi"} ${quote.length} vé`}
              </Button>
            </div>
          </>
        )}
        {canQuote && !quote.length && (
          <Button disabled={busy} onClick={() => void submit(false)}>
            {busy ? "Đang tính…" : "Tính phí đổi/trả"}
          </Button>
        )}
        {!!done.length && (
          <div role="status" className="rounded-2xl bg-moss p-4">
            <p className="font-bold">Đã xử lý {done.length} vé</p>
            {done.map((r) => (
              <div key={r.requestId} className="text-sm mt-2">
                {r.passengerName} · Yêu cầu {r.requestId} · {settlementLabel(r.settlement)}{" "}
                {money(Math.abs(r.settlement))}
                {r.replacementOrderId && (
                  <button
                    className="ml-2 underline"
                    type="button"
                    onClick={() => onOpen(r.replacementOrderId!)}
                  >
                    Xem vé mới {r.replacementTicketId}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const settlementLabel = (amount: number) =>
  amount < 0 ? "Hoàn tiền" : amount > 0 ? "Thu thêm" : "Không chênh lệch";
const money = (amount: number) =>
  Number.isInteger(amount)
    ? vnd(amount)
    : `${amount.toLocaleString("vi-VN", { minimumFractionDigits: 2 })} ₫`;

export function ManageTickets({
  orderId,
  onOpen,
}: {
  orderId: string | null;
  onOpen: (v: string) => void;
}) {
  const [input, setInput] = useState("");
  const [id, setId] = useState(orderId || "");
  const [loaded, setLoaded] = useState<{ id: string; items: Item[]; error: string } | null>(null);
  useEffect(() => {
    setId(orderId || "");
  }, [orderId]);
  useEffect(() => {
    if (!id) return;
    let active = true;
    api<{ items: Item[] }>(`/orders/${encodeURIComponent(id)}`)
      .then(({ items }) => {
        if (active)
          setLoaded({ id, items, error: items.length ? "" : "Không tìm thấy vé cho mã đơn này." });
      })
      .catch((e: Error) => {
        if (active) setLoaded({ id, items: [], error: e.message });
      });
    return () => {
      active = false;
    };
  }, [id]);
  if (id && loaded?.id === id && loaded.items.length)
    return (
      <ChangeOrder
        key={id}
        orderId={id}
        items={loaded.items}
        onOpen={(next) => {
          setId(next);
          onOpen(next);
        }}
        onBack={() => {
          setId("");
          setLoaded(null);
          setInput("");
          onOpen("");
        }}
      />
    );
  return (
    <div className="animate-rise max-w-4xl">
      <SectionTitle eyebrow="Đổi / Trả vé" title="Tra cứu đơn đặt vé" />
      <form
        className={`${card} flex flex-wrap items-end gap-3`}
        onSubmit={(e) => {
          e.preventDefault();
          const next = input.trim().toUpperCase();
          if (next) {
            setId(next);
            onOpen(next);
          }
        }}
      >
        <div className="flex-1">
          <Field label="Mã đơn đặt vé">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className={inputCls()}
              placeholder="DD001"
              required
              maxLength={30}
            />
          </Field>
        </div>
        <Button type="submit" disabled={!!id && loaded?.id !== id}>
          Tra cứu
        </Button>
      </form>
      {id && loaded?.id !== id && <p className="text-muted mt-4">Đang tra cứu đơn…</p>}
      {id && loaded?.id === id && loaded.error && (
        <p role="alert" className="text-signal mt-4">
          {loaded.error}
        </p>
      )}
    </div>
  );
}
