import { IconBank, IconCard, IconQr } from "../components/icons";
import { Field, SectionTitle, inputCls } from "../components/ui";
import { vnd } from "../lib/format";
import type { PaymentState } from "../lib/validate";

const methods = [
  { id: "qr", title: "QR / Ví điện tử", details: "VNPay, MoMo, ZaloPay", Icon: IconQr },
  { id: "atm", title: "Thẻ ATM nội địa", details: "Internet Banking", Icon: IconBank },
  { id: "card", title: "Thẻ quốc tế", details: "Visa, Mastercard, JCB", Icon: IconCard },
] as const;
const banks = [
  "Vietcombank",
  "VietinBank",
  "BIDV",
  "Agribank",
  "Techcombank",
  "MB Bank",
  "ACB",
  "TPBank",
];

export function PaymentStep({
  pay,
  setPay,
  total,
}: {
  pay: PaymentState;
  setPay: (p: PaymentState) => void;
  total: number;
}) {
  const setCard = (field: keyof PaymentState["card"], value: string) =>
    setPay({ ...pay, card: { ...pay.card, [field]: value } });
  return (
    <div className="animate-rise">
      <SectionTitle
        eyebrow="Bước 5 · Thanh toán"
        title="Chọn phương thức thanh toán"
        desc="Chọn phương thức để mô phỏng thanh toán và phát hành vé."
      />
      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        {methods.map(({ id, title, details, Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={pay.method === id}
            onClick={() => setPay({ ...pay, method: id })}
            className={`text-left rounded-2xl border-2 p-4 ${pay.method === id ? "border-ink bg-card" : "border-line"}`}
          >
            <Icon width={22} className={pay.method === id ? "text-signal mb-3" : "mb-3"} />
            <div className="font-bold">{title}</div>
            <div className="text-sm text-muted">{details}</div>
          </button>
        ))}
      </div>
      <div className="rounded-3xl bg-card border border-line p-5 md:p-7">
        {pay.method === "qr" && (
          <div className="flex items-center gap-5">
            <div className="bg-moss rounded-2xl p-5">
              <IconQr width={52} height={52} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Thanh toán QR mô phỏng</h3>
              <p className="text-sm text-muted">Xác nhận kết quả bằng các nút bên dưới.</p>
              <p className="mt-2 font-bold">{vnd(total)}</p>
            </div>
          </div>
        )}
        {pay.method === "atm" && (
          <>
            <h3 className="text-lg font-bold mb-4">Chọn ngân hàng</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {banks.map((bank) => (
                <button
                  key={bank}
                  type="button"
                  aria-pressed={pay.bank === bank}
                  className={`rounded-xl border p-3 text-sm font-semibold ${pay.bank === bank ? "bg-moss border-ink" : "border-line"}`}
                  onClick={() => setPay({ ...pay, bank })}
                >
                  {bank}
                </button>
              ))}
            </div>
          </>
        )}
        {pay.method === "card" && (
          <div className="grid grid-cols-2 gap-4">
            <p className="col-span-2 text-sm text-muted">Chỉ nhập dữ liệu thẻ thử nghiệm.</p>
            <div className="col-span-2">
              <Field label="Số thẻ">
                <input
                  className={inputCls()}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="4111 1111 1111 1111"
                  value={pay.card.number}
                  onChange={(e) =>
                    setCard("number", e.target.value.replace(/[^\d ]/g, "").slice(0, 23))
                  }
                />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Tên chủ thẻ">
                <input
                  className={inputCls()}
                  autoComplete="off"
                  value={pay.card.name}
                  onChange={(e) => setCard("name", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Hết hạn">
              <input
                className={inputCls()}
                placeholder="MM/YY"
                maxLength={5}
                autoComplete="off"
                value={pay.card.exp}
                onChange={(e) => setCard("exp", e.target.value)}
              />
            </Field>
            <Field label="CVC">
              <input
                className={inputCls()}
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pay.card.cvc}
                onChange={(e) => setCard("cvc", e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
            </Field>
          </div>
        )}
      </div>
      <label className="flex gap-3 items-start rounded-2xl bg-moss p-4 mt-5 cursor-pointer">
        <input
          type="checkbox"
          checked={pay.agree}
          onChange={(e) => setPay({ ...pay, agree: e.target.checked })}
          className="mt-1 size-5 accent-[var(--color-signal)]"
        />
        <span>
          Tôi đã kiểm tra thông tin hành khách và đồng ý với quy định vận chuyển, đổi và trả vé.
        </span>
      </label>
    </div>
  );
}
