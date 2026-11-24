import { useEffect, useState } from "react";
import { api, qs } from "../lib/api";
import { Button, Field, SectionTitle, inputCls } from "../components/ui";

type Trip = {
  trainId: string;
  trainCode: string;
  status: string;
  departure: string;
  arrival: string;
  fromName: string | null;
  toName: string | null;
  future: boolean;
};
type Employee = { cccd: string; employeeName: string; roles: { id: string; name: string }[] };
type Assignment = { cccd: string; employeeName: string; roleId: string; roleName: string };
type Schedule = { seq: number; station: string; arrival: string | null; departure: string | null };
type Catalog = { trips: Trip[]; employees: Employee[] };
type Notice = { error?: boolean; text: string };

const panel = "rounded-3xl bg-card border border-line p-5 md:p-7";
const displayTime = (value: string | null) => value?.replace("T", " ").slice(0, 19) || "—";
const inputTime = (value: string | null) => value?.replace(" ", "T").slice(0, 19) || "";

function Feedback({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  return (
    <p
      role={notice.error ? "alert" : "status"}
      className={`rounded-xl px-4 py-3 text-sm ${notice.error ? "bg-signal/10 text-signal" : "bg-moss"}`}
    >
      {notice.text}
    </p>
  );
}

export function Admin() {
  const [tab, setTab] = useState<"assignments" | "schedule">("assignments");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [revision, setRevision] = useState(0);
  const [trainId, setTrainId] = useState("");
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api<Catalog>("/admin/catalog")
      .then((data) => {
        if (!active) return;
        setCatalog(data);
        setTrainId((current) =>
          data.trips.some((t) => t.trainId === current) ? current : data.trips[0]?.trainId || "",
        );
        setCatalogError("");
      })
      .catch((e: Error) => {
        if (active) setCatalogError(e.message);
      });
    return () => {
      active = false;
    };
  }, [revision]);

  const trip = catalog?.trips.find((t) => t.trainId === trainId);
  const needle = filter.trim().toLocaleLowerCase("vi");
  const trips = catalog?.trips.filter(
    (t) =>
      t.trainId === trainId ||
      [t.trainId, t.trainCode, t.departure, t.fromName, t.toName]
        .join(" ")
        .toLocaleLowerCase("vi")
        .includes(needle),
  );
  return (
    <div className="animate-rise space-y-5">
      <SectionTitle eyebrow="Quản trị" title="Điều hành chuyến tàu" />
      <nav aria-label="Nghiệp vụ quản trị" className="flex flex-wrap gap-2">
        {(["assignments", "schedule"] as const).map((value) => (
          <Button
            key={value}
            disabled={busy}
            variant={tab === value ? "dark" : "ghost"}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {value === "assignments" ? "Phân công phục vụ" : "Điều chỉnh lịch ga"}
          </Button>
        ))}
      </nav>
      {catalogError && <Feedback notice={{ error: true, text: catalogError }} />}
      {!catalog && !catalogError && (
        <p role="status" className="text-muted">
          Đang tải danh mục…
        </p>
      )}
      <section className={`${panel} space-y-4`}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Lọc theo mã, ngày (YYYY-MM-DD) hoặc tên ga">
            <input
              className={inputCls()}
              value={filter}
              disabled={busy || !catalog}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="CT004, 2026-12-14 hoặc Hà Nội"
            />
          </Field>
          <Field label="Chuyến tàu">
            <select
              className={inputCls()}
              value={trainId}
              disabled={busy || !trips?.length}
              onChange={(e) => setTrainId(e.target.value)}
            >
              {!trips?.length && <option value="">Chưa có chuyến</option>}
              {trips?.map((t) => (
                <option key={t.trainId} value={t.trainId}>
                  {t.trainId} · {t.trainCode} · {t.departure.slice(0, 10)} · {t.fromName} →{" "}
                  {t.toName}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {trip && (
          <p className="text-sm text-muted">
            {trip.status} · {trip.future ? "Chưa khởi hành" : "Đã đến giờ khởi hành"} ·{" "}
            {displayTime(trip.departure)} → {displayTime(trip.arrival)}
          </p>
        )}
        <Button variant="ghost" disabled={busy} onClick={() => setRevision((n) => n + 1)}>
          Tải lại
        </Button>
      </section>
      {trip &&
        catalog &&
        (tab === "assignments" ? (
          <Assignments
            key={trip.trainId}
            trip={trip}
            employees={catalog.employees}
            revision={revision}
            busy={busy}
            setBusy={setBusy}
          />
        ) : (
          <ScheduleEditor
            key={trip.trainId}
            trip={trip}
            revision={revision}
            busy={busy}
            setBusy={setBusy}
            onSaved={() => setRevision((n) => n + 1)}
          />
        ))}
    </div>
  );
}

type EditorProps = {
  trip: Trip;
  revision: number;
  busy: boolean;
  setBusy: (value: boolean) => void;
};

function useTripRows<T>(trip: Trip, revision: number, path: string, key: string) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const { trainId } = trip;
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<Record<string, T[]>>(`${path}?${qs({ trainId })}`)
      .then((data) => {
        if (active) setRows(data[key]);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [trainId, revision, reload, path, key]);
  return { rows, loading, error, refresh: () => setReload((n) => n + 1) };
}

function Assignments({
  trip,
  employees,
  revision,
  busy,
  setBusy,
}: EditorProps & { employees: Employee[] }) {
  const { rows, loading, error, refresh } = useTripRows<Assignment>(
    trip,
    revision,
    "/assignments",
    "assignments",
  );
  const [original, setOriginal] = useState<Assignment | null>(null);
  const [cccd, setCccd] = useState("");
  const [roleId, setRoleId] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const roles = employees.find((e) => e.cccd === cccd)?.roles || [];
  const editable = trip.future && trip.status === "Sẵn sàng";
  const reset = () => {
    setOriginal(null);
    setCccd("");
    setRoleId("");
  };
  const save = async (method: "POST" | "PUT" | "DELETE", target?: Assignment) => {
    if (
      method === "DELETE" &&
      (!target || !window.confirm(`Xóa phân công của ${target.employeeName} trên ${trip.trainId}?`))
    )
      return;
    const payload =
      method === "DELETE"
        ? { cccd: target?.cccd }
        : method === "PUT"
          ? { oldCccd: original?.cccd, newCccd: cccd, roleId }
          : { cccd, roleId };
    setNotice(null);
    setBusy(true);
    try {
      await api("/assignments", {
        method,
        body: JSON.stringify({ ...payload, trainId: trip.trainId }),
      });
      reset();
      refresh();
      setNotice({
        text:
          method === "POST"
            ? "Đã thêm phân công."
            : method === "PUT"
              ? "Đã cập nhật phân công."
              : "Đã xóa phân công.",
      });
    } catch (e) {
      setNotice({ error: true, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={`${panel} space-y-4`}>
      <h2 className="text-xl font-bold">Phân công phục vụ · {trip.trainId}</h2>
      {!editable && (
        <p className="text-sm text-muted">
          Có thể thêm hoặc sửa khi chuyến sẵn sàng và chưa khởi hành.
        </p>
      )}
      {loading && (
        <p role="status" className="text-muted">
          Đang tải phân công…
        </p>
      )}
      {error && <Feedback notice={{ error: true, text: error }} />}
      {!loading && !error && !rows.length && (
        <p className="text-muted">Chuyến chưa có phân công.</p>
      )}
      {!error && (
        <ul className="space-y-2">
          {rows.map((a) => (
            <li
              key={a.cccd}
              className="flex flex-wrap justify-between items-center gap-3 rounded-xl bg-paper p-3"
            >
              <div>
                <b>{a.employeeName}</b>
                <p className="text-sm text-muted">
                  {a.roleName} · {a.cccd}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  disabled={busy || loading || !editable}
                  onClick={() => {
                    setOriginal(a);
                    setCccd(a.cccd);
                    setRoleId(a.roleId);
                    setNotice(null);
                  }}
                >
                  Sửa
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy || loading || !trip.future}
                  onClick={() => void save("DELETE", a)}
                >
                  Xóa
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Feedback notice={notice} />
      {editable && (
        <form
          className="border-t border-line pt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save(original ? "PUT" : "POST");
          }}
        >
          <h3 className="font-semibold">
            {original ? `Sửa phân công của ${original.employeeName}` : "Thêm phân công"}
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nhân viên">
              <select
                className={inputCls()}
                required
                disabled={busy}
                value={cccd}
                onChange={(e) => {
                  setCccd(e.target.value);
                  setRoleId("");
                }}
              >
                <option value="">Chọn nhân viên</option>
                {employees.map((employee) => (
                  <option key={employee.cccd} value={employee.cccd}>
                    {employee.employeeName} · {employee.cccd}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Vai trò phục vụ">
              <select
                className={inputCls()}
                required
                disabled={busy || !roles.length}
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
              >
                <option value="">Chọn vai trò</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || loading || !!error || !cccd || !roleId}>
              {original ? "Lưu thay đổi" : "Thêm phân công"}
            </Button>
            {original && (
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  reset();
                  setNotice(null);
                }}
              >
                Hủy sửa
              </Button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

function ScheduleEditor({
  trip,
  revision,
  busy,
  setBusy,
  onSaved,
}: EditorProps & { onSaved: () => void }) {
  const { rows, loading, error } = useTripRows<Schedule>(trip, revision, "/schedule", "schedule");
  const [selected, setSelected] = useState<Schedule | null>(null);
  const [arrival, setArrival] = useState("");
  const [departure, setDeparture] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const index = rows.findIndex((s) => s.seq === selected?.seq);
  const first = index === 0;
  const last = index === rows.length - 1;
  const previous = rows[index - 1];
  const next = rows[index + 1];
  const save = async () => {
    if (!selected || index < 0) return;
    setNotice(null);
    setBusy(true);
    try {
      await api("/schedule", {
        method: "PATCH",
        body: JSON.stringify({
          trainId: trip.trainId,
          seq: selected.seq,
          arrival: first ? null : arrival,
          departure: last ? null : departure,
          previous: { arrival: selected.arrival, departure: selected.departure },
        }),
      });
      setSelected(null);
      onSaved();
      setNotice({ text: "Đã cập nhật lịch ga." });
    } catch (e) {
      setNotice({ error: true, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={`${panel} space-y-4`}>
      <h2 className="text-xl font-bold">Điều chỉnh lịch ga · {trip.trainId}</h2>
      {loading && (
        <p role="status" className="text-muted">
          Đang tải lịch ga…
        </p>
      )}
      {error && <Feedback notice={{ error: true, text: error }} />}
      {!loading && !error && !rows.length && <p className="text-muted">Chuyến chưa có lịch ga.</p>}
      {!!rows.length && !error && (
        <div className="overflow-auto max-h-[28rem]">
          <table className="w-full min-w-[560px] text-sm text-left">
            <thead className="sticky top-0 bg-paper">
              <tr>
                {["Ga", "Đến dự kiến", "Đi dự kiến", "Thao tác"].map((title) => (
                  <th key={title} scope="col" className="p-3">
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((s) => (
                <tr key={s.seq} className={selected?.seq === s.seq ? "bg-moss" : ""}>
                  <th scope="row" className="p-3">
                    {s.seq}. {s.station}
                  </th>
                  <td className="p-3 whitespace-nowrap">{displayTime(s.arrival)}</td>
                  <td className="p-3 whitespace-nowrap">{displayTime(s.departure)}</td>
                  <td className="p-3">
                    <Button
                      variant="ghost"
                      disabled={busy || loading}
                      onClick={() => {
                        setSelected(s);
                        setArrival(inputTime(s.arrival));
                        setDeparture(inputTime(s.departure));
                        setNotice(null);
                      }}
                    >
                      Sửa giờ
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Feedback notice={notice} />
      {selected && index >= 0 && (
        <form
          className="border-t border-line pt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <h3 className="font-semibold">
            {selected.seq}. {selected.station}
          </h3>
          <div className="text-sm text-muted">
            {previous && (
              <p>
                Ga trước · {previous.station} rời lúc {displayTime(previous.departure)}
              </p>
            )}
            {next && (
              <p>
                Ga sau · {next.station} đến lúc {displayTime(next.arrival)}
              </p>
            )}
            {(first || last) && (
              <p>Lưu giờ tại ga đầu hoặc ga cuối sẽ cập nhật khung giờ của cả chuyến.</p>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Đến dự kiến (giờ Việt Nam)">
              {first ? (
                <p className="text-sm text-muted">Ga đầu không có giờ đến.</p>
              ) : (
                <input
                  className={inputCls()}
                  type="datetime-local"
                  step={1}
                  required
                  disabled={busy}
                  value={arrival}
                  onChange={(e) => setArrival(e.target.value)}
                />
              )}
            </Field>
            <Field label="Đi dự kiến (giờ Việt Nam)">
              {last ? (
                <p className="text-sm text-muted">Ga cuối không có giờ đi.</p>
              ) : (
                <input
                  className={inputCls()}
                  type="datetime-local"
                  step={1}
                  required
                  disabled={busy}
                  value={departure}
                  onChange={(e) => setDeparture(e.target.value)}
                />
              )}
            </Field>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || loading || !!error}>
              Lưu lịch ga
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setSelected(null);
                setNotice(null);
              }}
            >
              Hủy sửa
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
