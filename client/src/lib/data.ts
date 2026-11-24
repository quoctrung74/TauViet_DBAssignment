/** Domain types only. KHONG CO BAT KY DU LIEU/CHUYEN/CHO GIA LAP NAO. */
export type Station = { id: string; name: string; region: string; status?: string };
let stations: Station[] = [];
const listeners = new Set<() => void>();
export const getStationCatalogue = () => stations;
export const subscribeStations = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
export const setStationCatalogue = (s: Station[]) => {
  stations = s;
  listeners.forEach((fn) => fn());
};
export const stationById = (id: string) =>
  stations.find((s) => s.id === id) || { id, name: "Chọn ga", region: "" };
export type Trip = {
  key: string;
  trainId: string;
  trainCode: string;
  from: Station;
  to: Station;
  date: string;
  departAt: string;
  arriveAt: string;
  depMin: number;
  arrMin: number;
  fromSeq: number;
  toSeq: number;
  status: string;
};
export type CarType = "seat" | "k4" | "k6" | "other";
export const CAR_TYPES: Record<CarType, { name: string; short: string }> = {
  seat: { name: "Toa ghế", short: "Ghế" },
  k4: { name: "Toa giường 4", short: "Giường 4" },
  k6: { name: "Toa giường 6", short: "Giường 6" },
  other: { name: "Toa khác", short: "Chỗ" },
};
export type Seat = {
  carNo: number;
  carType: CarType;
  carTypeName: string;
  number: number;
  tier?: number;
  compartment?: number;
  price: number;
  taken: boolean;
};
export type Car = { no: number; type: CarType; name: string; seats: Seat[]; free: number };
export type PaxType = string;
export type Passenger = {
  fullName: string;
  type: string;
  typeName?: string;
  idNumber: string;
  birthDate: string;
};
export type Contact = {
  fullName: string;
  phone: string;
  email: string;
  cccd: string;
  birthDate: string;
  gender: string;
};
export const seatKey = (seat: Pick<Seat, "carNo" | "number">) => `${seat.carNo}-${seat.number}`;
/** Gia nay duoc lay tu fn_tinh_gia_ve_du_kien qua API, KHONG tu tinh tren frontend. */
export const ticketPrice = (seat: Seat, _pax?: Passenger) => seat.price;
export const seatLabel = (seat: Seat) =>
  `Toa ${seat.carNo} · ${seat.carType === "seat" ? "Ghế" : "Giường"} ${seat.number}`;
