import { useCallback, useEffect, useMemo, useState } from "react";
import { NavBar, type View } from "./components/NavBar";
import { Stepper } from "./components/Stepper";
import { HoldTimer, Summary, orderTotal } from "./components/Summary";
import { IconArrowLeft, IconArrowRight } from "./components/icons";
import { Button } from "./components/ui";
import { refreshStations } from "./lib/stationApi";
import { api, qs, type ApiQuote } from "./lib/api";
import { seatKey, type Contact, type Passenger, type Seat, type Trip } from "./lib/data";
import { todayISO, vnd } from "./lib/format";
import {
  paymentReady,
  validateContact,
  validatePassenger,
  type PaymentState,
} from "./lib/validate";
import { DoneStep } from "./steps/DoneStep";
import { PassengerStep } from "./steps/PassengerStep";
import { PaymentStep } from "./steps/PaymentStep";
import { SearchStep } from "./steps/SearchStep";
import { SeatStep } from "./steps/SeatStep";
import { TrainStep } from "./steps/TrainStep";
import { ManageTickets } from "./views/ManageTickets";
import { MyTickets } from "./views/MyTickets";
import { Admin } from "./views/Admin";
const emptyPax = (): Passenger => ({
  fullName: "",
  type: "DT01",
  typeName: "Người lớn",
  idNumber: "",
  birthDate: "",
});
const emptyContact = (): Contact => ({
  fullName: "",
  phone: "",
  email: "",
  cccd: "",
  birthDate: "",
  gender: "",
});
const emptyPay = (): PaymentState => ({
  method: "qr",
  card: { number: "", name: "", exp: "", cvc: "" },
  bank: "",
  agree: false,
});
export default function App() {
  const [view, setView] = useState<View>("home"),
    [step, setStep] = useState(1);
  const [fromId, setFromId] = useState(""),
    [toId, setToId] = useState(""),
    [date, setDate] = useState(todayISO());
  const [trip, setTrip] = useState<Trip | null>(null),
    [seats, setSeats] = useState<Seat[]>([]),
    [passengers, setPassengers] = useState<Passenger[]>([]);
  const [contact, setContact] = useState<Contact>(emptyContact),
    [showErrors, setShowErrors] = useState(false);
  const [pay, setPay] = useState<PaymentState>(emptyPay),
    [code, setCode] = useState("");
  const [processing, setProcessing] = useState(false),
    [priceLoading, setPriceLoading] = useState(false),
    [flowError, setFlowError] = useState("");
  const [done, setDone] = useState(false),
    [manageCode, setManageCode] = useState<string | null>(null);
  const [hold, setHold] = useState<{ holdId: string; expiresAt: number } | null>(null);
  const [paidTotal, setPaidTotal] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.all([
      refreshStations(),
      api<{ firstDate: string | null; routes: { fromId: string; toId: string }[] }>("/config"),
    ])
      .then(([, config]) => {
        if (!active) return;
        if (config.routes[0]) {
          setFromId(config.routes[0].fromId);
          setToId(config.routes[0].toId);
        }
        if (config.firstDate) setDate(config.firstDate);
      })
      .catch((e) => {
        if (active) setFlowError(`Kết nối PostgreSQL: ${e.message}`);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view, step, done]);
  useEffect(() => {
    setPassengers((prev) => seats.map((_, i) => prev[i] || emptyPax()));
  }, [seats.map(seatKey).join("|")]);
  const seatIds = seats.map(seatKey).join("|"),
    types = passengers.map((p) => p.type).join("|");
  useEffect(() => {
    if (!trip || !seats.length) {
      setPriceLoading(false);
      return;
    }
    let active = true;
    setPriceLoading(true);
    setFlowError("");
    Promise.all(
      seats.map(async (s, i) => {
        const type = passengers[i]?.type || "DT01";
        const result = await api<{ quote: ApiQuote }>(
          `/price?${qs({ trainId: trip.trainId, carNo: s.carNo, seatNo: s.number, from: trip.from.id, to: trip.to.id, passengerType: type })}`,
        );
        return { key: seatKey(s), amount: result.quote.total };
      }),
    )
      .then((quotes) => {
        if (active)
          setSeats((prev) =>
            prev.map((s) => {
              const quote = quotes.find((q) => q.key === seatKey(s));
              return quote ? { ...s, price: quote.amount } : s;
            }),
          );
      })
      .catch((e) => {
        if (active) setFlowError(e.message);
      })
      .finally(() => {
        if (active) setPriceLoading(false);
      });
    return () => {
      active = false;
    };
  }, [trip?.key, trip?.from.id, trip?.to.id, seatIds, types]);
  const total = useMemo(() => orderTotal(seats, passengers), [seats, passengers]);
  const toggleSeat = (s: Seat) =>
    setSeats((prev) =>
      prev.some((x) => seatKey(x) === seatKey(s))
        ? prev.filter((x) => seatKey(x) !== seatKey(s))
        : [...prev, s],
    );
  const selectTrip = (t: Trip) => {
    setTrip(t);
    setSeats([]);
    setPassengers([]);
    setFlowError("");
    setStep(2);
  };
  const goPassengers = async () => {
    if (!trip || !seats.length || processing) return;
    setShowErrors(false);
    setFlowError("");
    setProcessing(true);
    try {
      const reservation = await api<{ holdId: string; expiresAt: number }>("/holds", {
        method: "POST",
        body: JSON.stringify({
          trainId: trip.trainId,
          from: trip.from.id,
          to: trip.to.id,
          seats: seats.map((s) => ({ carNo: s.carNo, seatNo: s.number })),
        }),
      });
      setHold(reservation);
      setStep(3);
    } catch (e) {
      setFlowError((e as Error).message);
    } finally {
      setProcessing(false);
    }
  };
  const goPayment = () => {
    const errors =
      passengers.some((p) => Object.keys(validatePassenger(p, trip?.date || date)).length) ||
      Object.keys(validateContact(contact)).length;
    if (errors) {
      setShowErrors(true);
      setFlowError("Vui lòng nhập đủ thông tin hợp lệ trước khi tiếp tục.");
      return;
    }
    setFlowError("");
    setStep(4);
  };
  const doSubmit = async () => {
    if (!hold || hold.expiresAt <= Date.now() || !paymentReady(pay) || !seats.length || processing)
      return;
    setProcessing(true);
    setFlowError("");
    try {
      const order = await api<{ orderId: string; total: number; status: string }>("/orders", {
        method: "POST",
        body: JSON.stringify({
          customer: { ...contact, phone: contact.phone.trim(), email: contact.email.trim() },
          holdId: hold.holdId,
          paymentMethod: pay.method,
          passengers: seats.map((s, i) => ({
            carNo: s.carNo,
            seatNo: s.number,
            name: passengers[i].fullName,
            document: passengers[i].idNumber,
            passengerType: passengers[i].type,
          })),
        }),
      });
      setCode(order.orderId);
      setPaidTotal(order.total);
      setPay(emptyPay());
      setHold(null);
      setDone(true);
    } catch (e) {
      setFlowError((e as Error).message);
    } finally {
      setProcessing(false);
    }
  };
  const releaseHold = useCallback(() => {
    if (hold) void api(`/holds/${hold.holdId}`, { method: "DELETE" }).catch(() => {});
    setHold(null);
  }, [hold]);
  const resetFlow = useCallback(() => {
    releaseHold();
    setStep(1);
    setTrip(null);
    setSeats([]);
    setPassengers([]);
    setContact(emptyContact());
    setPay(emptyPay());
    setCode("");
    setDone(false);
    setFlowError("");
  }, [releaseHold]);
  useEffect(() => {
    if (!hold || processing) return;
    const timeout = window.setTimeout(
      () => {
        resetFlow();
        setView("home");
        window.alert("Đã hết 10 phút giữ chỗ. Bạn vui lòng chọn lại chuyến.");
      },
      Math.max(0, hold.expiresAt - Date.now()),
    );
    return () => window.clearTimeout(timeout);
  }, [hold, processing, resetFlow]);
  const failPayment = () => {
    resetFlow();
    setView("home");
    window.alert("Thanh toán thất bại. Không có đơn đặt vé nào được ghi nhận.");
  };
  const navigate = (v: View) => {
    if (processing) return;
    if (done || (view === "book" && v !== "book")) resetFlow();
    if (v === "manage") setManageCode(null);
    setView(v);
  };
  const jump = (i: number) => {
    if (processing) return;
    if (i === 0) return navigate("home");
    if (i <= 2) releaseHold();
    setFlowError("");
    setStep(i);
  };
  const action =
    step === 2
      ? {
          label: seats.length ? `Tiếp tục với ${seats.length} chỗ` : "Chọn ít nhất 1 chỗ",
          disabled: !seats.length || priceLoading || processing,
          onClick: goPassengers,
        }
      : step === 3
        ? {
            label: priceLoading ? "Đang tính giá từ PostgreSQL..." : "Tiếp tục xác nhận",
            disabled: priceLoading,
            onClick: goPayment,
          }
        : step === 4
          ? {
              label: `Thanh toán · ${vnd(total)}`,
              disabled: !paymentReady(pay) || processing || priceLoading,
              onClick: doSubmit,
            }
          : null;
  const actionBtn = action && (
    <div className="space-y-2">
      <Button className="w-full" disabled={action.disabled} onClick={action.onClick}>
        {action.label}
        {!processing && <IconArrowRight width={18} />}
      </Button>
      {step === 4 && (
        <Button className="w-full" variant="ghost" disabled={processing} onClick={failPayment}>
          Thanh toán thất bại
        </Button>
      )}
    </div>
  );
  const inFlow = view === "book" && !done;
  return (
    <div className={`min-h-screen ${inFlow && actionBtn ? "pb-40 lg:pb-16" : "pb-16"}`}>
      <header className="no-print sticky top-0 z-40 bg-paper/85 backdrop-blur-md border-b border-line/70">
        <NavBar view={view} onNavigate={navigate} ticketCount={0} />
        {inFlow && (
          <div className="border-t border-line/70">
            <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-2.5">
              <Stepper step={step} onJump={jump} />
            </div>
          </div>
        )}
      </header>
      <main className="max-w-[1200px] mx-auto px-4 md:px-6 pt-6 md:pt-10">
        {flowError && (
          <div className="mb-5 rounded-2xl bg-signal/10 text-signal px-5 py-3.5 text-[14px] font-medium">
            {flowError}
          </div>
        )}
        {view === "home" && (
          <SearchStep
            fromId={fromId}
            toId={toId}
            date={date}
            setFrom={setFromId}
            setTo={setToId}
            setDate={setDate}
            onSearch={() => {
              setFlowError("");
              setStep(1);
              setView("book");
            }}
          />
        )}
        {view === "mine" && (
          <MyTickets
            onManage={(c) => {
              setManageCode(c);
              setView("manage");
            }}
            onBook={() => navigate("home")}
          />
        )}
        {view === "manage" && <ManageTickets orderId={manageCode} onOpen={setManageCode} />}
        {view === "admin" && <Admin />}
        {view === "book" &&
          (done && trip ? (
            <DoneStep
              code={code}
              trip={trip}
              seats={seats}
              passengers={passengers}
              contact={contact}
              total={paidTotal}
              onNew={resetFlow}
              onViewMine={() => navigate("mine")}
            />
          ) : (
            <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
              <div className="min-w-0">
                <button
                  onClick={() => jump(step - 1)}
                  className="no-print inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink mb-5"
                >
                  <IconArrowLeft width={16} /> Quay lại
                </button>
                {step === 1 && (
                  <TrainStep
                    fromId={fromId}
                    toId={toId}
                    date={date}
                    setFrom={setFromId}
                    setTo={setToId}
                    setDate={setDate}
                    selected={trip}
                    onSelect={selectTrip}
                  />
                )}
                {step === 2 && trip && (
                  <SeatStep trip={trip} selected={seats} onToggle={toggleSeat} />
                )}
                {step === 3 && trip && (
                  <PassengerStep
                    seats={seats}
                    passengers={passengers}
                    setPassenger={(i, p) =>
                      setPassengers((prev) => prev.map((x, j) => (i === j ? p : x)))
                    }
                    contact={contact}
                    setContact={setContact}
                    date={trip.date}
                    showErrors={showErrors}
                  />
                )}
                {step === 4 && <PaymentStep pay={pay} setPay={setPay} total={total} />}
              </div>
              <div className="lg:sticky lg:top-40">
                <Summary
                  trip={step >= 2 ? trip : null}
                  seats={seats}
                  passengers={passengers}
                  onRemoveSeat={step === 2 ? toggleSeat : undefined}
                  hold={hold && <HoldTimer until={hold.expiresAt} />}
                  action={actionBtn}
                />
              </div>
            </div>
          ))}
      </main>
      {inFlow && actionBtn && (
        <div className="no-print lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-line px-4 py-3 flex items-center gap-4">
          <div className="shrink-0">
            <div className="text-[11px] text-muted">Tổng dự kiến</div>
            <div className="font-bold tabular-nums">{vnd(total)}</div>
          </div>
          <div className="flex-1">{actionBtn}</div>
        </div>
      )}
      {processing && (
        <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm grid place-items-center">
          <div className="rounded-3xl bg-card px-10 py-8 text-center">
            <div className="font-semibold">{step === 2 ? "Đang giữ chỗ…" : "Đang thanh toán…"}</div>
          </div>
        </div>
      )}
    </div>
  );
}
