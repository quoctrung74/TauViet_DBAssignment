import { useState } from "react";
import { api } from "../lib/api";
import { Button, Field, SectionTitle, inputCls } from "../components/ui";
import { vnd } from "../lib/format";
type Order = { orderId: string; date: string; status: string; total: number; items: number };
export function MyTickets({
  onManage,
  onBook,
}: {
  onManage: (id: string) => void;
  onBook: () => void;
}) {
  const [cccd, setCccd] = useState(""),
    [orders, setOrders] = useState<Order[]>([]),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false);
  const search = async () => {
    setError("");
    setLoaded(false);
    try {
      const r = await api<{ orders: Order[] }>(`/orders?customerCccd=${encodeURIComponent(cccd)}`);
      setOrders(r.orders);
      setLoaded(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="animate-rise max-w-4xl">
      <SectionTitle
        eyebrow="Đơn của tôi"
        title="Tra cứu đơn đặt vé trong PostgreSQL"
        desc="Dữ liệu từ DonDatVe và MucDatVe, không lưu localStorage."
      />
      <div className="rounded-3xl bg-card border border-line p-6 flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <Field label="CCCD khách hàng đã có trong DB">
            <input
              className={inputCls()}
              value={cccd}
              onChange={(e) => setCccd(e.target.value.replace(/\D/g, "").slice(0, 12))}
              placeholder="12 chữ số"
            />
          </Field>
        </div>
        <Button onClick={search}>Tra cứu từ PostgreSQL</Button>
      </div>
      {error && <p className="text-signal mt-4">{error}</p>}
      {loaded && orders.length === 0 && (
        <div className="mt-6 rounded-3xl border-2 border-dashed border-line p-10 text-center">
          <p className="text-muted">Khách hàng này chưa có đơn nào trong PostgreSQL.</p>
          <Button className="mt-5" onClick={onBook}>
            Tìm chuyến tàu
          </Button>
        </div>
      )}
      <div className="space-y-4 mt-6">
        {orders.map((o) => (
          <article
            key={o.orderId}
            className="rounded-3xl bg-card border border-line overflow-hidden"
          >
            <div className="flex flex-wrap justify-between items-center px-6 py-4 bg-paper/60 border-b border-line">
              <span className="font-mono font-bold text-signal">{o.orderId}</span>
              <span className="font-semibold">{vnd(o.total)}</span>
            </div>
            <div className="p-6 flex flex-wrap justify-between items-center gap-3">
              <div>
                <p>
                  {o.date} · {o.items} mục
                </p>
                <p className="text-[13px] text-muted mt-1">{o.status}</p>
              </div>
              <Button variant="ghost" onClick={() => onManage(o.orderId)}>
                Xem chi tiết
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
