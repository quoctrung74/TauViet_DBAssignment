import { useEffect, useState } from "react";
import { Field, SectionTitle, inputCls } from "../components/ui";
import { api } from "../lib/api";
import { seatLabel, type Contact, type Passenger, type Seat } from "../lib/data";
import { vnd } from "../lib/format";
import { validateContact, validatePassenger } from "../lib/validate";
type PaxCategory = { id: string; name: string; rate: number };
export function PassengerStep({
  seats,
  passengers,
  setPassenger,
  contact,
  setContact,
  date,
  showErrors,
}: {
  seats: Seat[];
  passengers: Passenger[];
  setPassenger: (i: number, p: Passenger) => void;
  contact: Contact;
  setContact: (v: Contact) => void;
  date: string;
  showErrors: boolean;
}) {
  const [categories, setCategories] = useState<PaxCategory[]>([]),
    [loadError, setLoadError] = useState("");
  useEffect(() => {
    api<{ types: PaxCategory[] }>("/passenger-types")
      .then((r) => setCategories(r.types))
      .catch((e) => setLoadError(e.message));
  }, []);
  const cErr = showErrors ? validateContact(contact) : {};
  return (
    <div className="animate-rise">
      <SectionTitle
        eyebrow="Bước 4 · Hành khách"
        title="Thông tin hành khách"
        desc="Họ tên và giấy tờ phải trùng khớp với giấy tờ tùy thân xuất trình khi lên tàu."
      />
      {loadError && <p className="text-signal">{loadError}</p>}
      <div className="space-y-4">
        {seats.map((seat, i) => {
          const p = passengers[i];
          if (!p) return null;
          const e = showErrors ? validatePassenger(p, date) : {};
          const set = (patch: Partial<Passenger>) => setPassenger(i, { ...p, ...patch });
          return (
            <div
              key={`${seat.carNo}-${seat.number}`}
              className="rounded-3xl bg-card border border-line overflow-hidden"
            >
              <div className="flex justify-between items-center px-5 md:px-6 py-3.5 bg-paper/70 border-b border-line">
                <span className="font-semibold text-[14px]">
                  {i + 1}. {seatLabel(seat)}
                </span>
                <span className="font-semibold tabular-nums">{vnd(seat.price)}</span>
              </div>
              <div className="p-5 md:p-6 space-y-5">
                <div>
                  <div className="text-[13px] font-semibold text-ink-soft mb-2">Đối tượng</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {categories.map((cat) => (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => set({ type: cat.id, typeName: cat.name })}
                        className={`rounded-xl border px-3 py-2.5 text-left transition ${p.type === cat.id ? "border-ink bg-ink text-paper" : "border-line bg-white hover:border-ink/40"}`}
                      >
                        <div className="font-semibold text-[14px]">{cat.name}</div>
                        <div className="text-[11px]">Giảm {Math.round(cat.rate * 100)}%</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Họ và tên" error={e.fullName}>
                    <input
                      value={p.fullName}
                      onChange={(ev) => set({ fullName: ev.target.value })}
                      className={inputCls(!!e.fullName)}
                      placeholder="Họ tên trên giấy tờ"
                    />
                  </Field>
                  <Field label="Số giấy tờ" error={e.idNumber}>
                    <input
                      value={p.idNumber}
                      onChange={(ev) => set({ idNumber: ev.target.value })}
                      className={inputCls(!!e.idNumber)}
                      placeholder="CCCD / Hộ chiếu"
                    />
                  </Field>
                </div>
              </div>
            </div>
          );
        })}
        <div className="rounded-3xl bg-card border border-line p-5 md:p-6">
          <h3 className="font-bold text-lg mb-2">Người đặt vé</h3>
          <p className="text-[13px] text-muted mb-5">
            Khách mới vui lòng nhập ngày sinh và giới tính để tạo hồ sơ khi thanh toán.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="CCCD khách hàng" error={cErr.cccd}>
              <input
                value={contact.cccd}
                onChange={(e) =>
                  setContact({ ...contact, cccd: e.target.value.replace(/\D/g, "").slice(0, 12) })
                }
                className={inputCls(!!cErr.cccd)}
                placeholder="12 chữ số"
              />
            </Field>
            <Field label="Họ và tên" error={cErr.fullName}>
              <input
                value={contact.fullName}
                onChange={(e) => setContact({ ...contact, fullName: e.target.value })}
                className={inputCls(!!cErr.fullName)}
              />
            </Field>
            <Field label="Điện thoại" error={cErr.phone}>
              <input
                value={contact.phone}
                onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                className={inputCls(!!cErr.phone)}
              />
            </Field>
            <Field label="Email" error={cErr.email}>
              <input
                type="email"
                value={contact.email}
                onChange={(e) => setContact({ ...contact, email: e.target.value })}
                className={inputCls(!!cErr.email)}
              />
            </Field>
            <Field label="Ngày sinh">
              <input
                type="date"
                value={contact.birthDate}
                className={inputCls()}
                onChange={(e) => setContact({ ...contact, birthDate: e.target.value })}
              />
            </Field>
            <Field label="Giới tính">
              <select
                value={contact.gender}
                className={inputCls()}
                onChange={(e) => setContact({ ...contact, gender: e.target.value })}
              >
                <option value="">Chọn giới tính</option>
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
              </select>
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}
