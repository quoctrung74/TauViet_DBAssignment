import { useState } from "react";
import { api, qs } from "../lib/api";
import { Button, Field, SectionTitle, inputCls } from "../components/ui";
type Assignment = {
  cccd: string;
  trainId: string;
  roleId: string;
  roleName: string;
  employeeName: string;
};
type Schedule = {
  trainId: string;
  seq: number;
  station: string;
  arrival: string | null;
  departure: string | null;
};
export function Admin() {
  const [trainId, setTrainId] = useState("CT001"),
    [assignments, setAssignments] = useState<Assignment[]>([]),
    [schedule, setSchedule] = useState<Schedule[]>([]);
  const [cccd, setCccd] = useState(""),
    [newCccd, setNewCccd] = useState(""),
    [roleId, setRoleId] = useState("VT05"),
    [message, setMessage] = useState("");
  const [selectedSeq, setSelectedSeq] = useState(""),
    [arrival, setArrival] = useState(""),
    [departure, setDeparture] = useState("");
  const load = async () => {
    setMessage("");
    try {
      const [a, s] = await Promise.all([
        api<{ assignments: Assignment[] }>(`/assignments?${qs({ trainId })}`),
        api<{ schedule: Schedule[] }>(`/schedule?${qs({ trainId })}`),
      ]);
      setAssignments(a.assignments);
      setSchedule(s.schedule);
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const change = async (
    method: "POST" | "PUT" | "DELETE" | "PATCH",
    payload: unknown,
    endpoint = "/assignments",
  ) => {
    setMessage("");
    try {
      const result = await api<{ procedure?: string; trigger?: string }>(endpoint, {
        method,
        body: JSON.stringify(payload),
      });
      await load();
      setMessage(`Thành công qua PostgreSQL: ${result.procedure || result.trigger || ""}`);
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  return (
    <div className="animate-rise space-y-7">
      <SectionTitle
        eyebrow="Nhân viên · Phần 3 BTL"
        title="Quản lý phân công và lịch chạy tàu"
        desc="Màn hình bổ sung để demo procedure mục 2.1 và trigger mục 2.2."
      />
      <div className="rounded-3xl bg-card border border-line p-6 flex flex-wrap gap-3 items-end">
        <div className="flex-1">
          <Field label="Mã chuyến tàu">
            <input
              value={trainId}
              onChange={(e) => setTrainId(e.target.value)}
              className={inputCls()}
            />
          </Field>
        </div>
        <Button onClick={load}>Tải dữ liệu PostgreSQL</Button>
      </div>
      {message && <div className="rounded-2xl bg-moss px-4 py-3 text-[13px]">{message}</div>}
      <div className="rounded-3xl bg-card border border-line p-6">
        <h3 className="font-bold text-lg mb-4">Phân công nhân viên (3 PROCEDURE)</h3>
        <div className="space-y-2">
          {assignments.map((a) => (
            <div
              key={`${a.cccd}-${a.trainId}`}
              className="flex flex-wrap gap-3 justify-between items-center rounded-xl bg-paper p-3 text-[13px]"
            >
              <div>
                {a.employeeName} · {a.cccd} · {a.roleName}
              </div>
              <button
                onClick={() => {
                  setCccd(a.cccd);
                  setRoleId(a.roleId);
                }}
                className="text-signal"
              >
                Chọn để sửa/xóa
              </button>
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-3 gap-3 mt-5">
          <Field label="CCCD nhân viên hiện tại / thêm">
            <input className={inputCls()} value={cccd} onChange={(e) => setCccd(e.target.value)} />
          </Field>
          <Field label="CCCD thay thế (khi sửa)">
            <input
              className={inputCls()}
              value={newCccd}
              onChange={(e) => setNewCccd(e.target.value)}
            />
          </Field>
          <Field label="Mã vai trò (VD VT05)">
            <input
              className={inputCls()}
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <Button onClick={() => change("POST", { cccd, trainId, roleId })}>
            Thêm (sp_them_phan_cong)
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              change("PUT", { oldCccd: cccd, newCccd: newCccd || cccd, trainId, roleId })
            }
          >
            Sửa
          </Button>
          <Button variant="ghost" onClick={() => change("DELETE", { cccd, trainId })}>
            Xóa
          </Button>
        </div>
        <p className="text-[12px] text-muted mt-4">
          Procedure không cho thêm/sửa/xóa phân công chuyến đã khởi hành. Bộ dữ liệu mới có chuyến
          từ 10/12/2026 đến 31/01/2027 để kiểm thử phân công trên chuyến chưa khởi hành.
        </p>
      </div>
      <div className="rounded-3xl bg-card border border-line p-6">
        <h3 className="font-bold text-lg mb-4">Lịch ga (Trigger 1 kiểm tra liên tục thời gian)</h3>
        <div className="space-y-2 max-h-72 overflow-auto">
          {schedule.map((s) => (
            <button
              key={s.seq}
              onClick={() => {
                setSelectedSeq(String(s.seq));
                setArrival(s.arrival || "");
                setDeparture(s.departure || "");
              }}
              className="w-full text-left rounded-xl bg-paper p-3 text-[13px] hover:bg-moss"
            >
              <b>
                {s.seq}. {s.station}
              </b>{" "}
              · đến: {s.arrival || "—"} · đi: {s.departure || "—"}
            </button>
          ))}
        </div>
        <div className="grid md:grid-cols-3 gap-3 mt-5">
          <Field label="Thứ tự ga">
            <input
              className={inputCls()}
              value={selectedSeq}
              onChange={(e) => setSelectedSeq(e.target.value)}
            />
          </Field>
          <Field label="Đến dự kiến (YYYY-MM-DD HH:mm:ss)">
            <input
              className={inputCls()}
              value={arrival}
              onChange={(e) => setArrival(e.target.value)}
            />
          </Field>
          <Field label="Đi dự kiến">
            <input
              className={inputCls()}
              value={departure}
              onChange={(e) => setDeparture(e.target.value)}
            />
          </Field>
        </div>
        <Button
          className="mt-4"
          onClick={() =>
            change("PATCH", { trainId, seq: Number(selectedSeq), arrival, departure }, "/schedule")
          }
        >
          Cập nhật qua trigger
        </Button>
        <p className="text-[12px] text-muted mt-3">
          Thời gian vi phạm sẽ bị PostgreSQL RAISE EXCEPTION. Giao diện không tự kiểm tra thay
          trigger.
        </p>
      </div>
    </div>
  );
}
