import type { Contact, Passenger } from "./data";
export type PaymentState = {
  method: "qr" | "atm" | "card";
  card: { number: string; name: string; exp: string; cvc: string };
  bank: string;
  agree: boolean;
};
export function validatePassenger(p: Passenger, _date: string) {
  const errors: Record<string, string> = {};
  if (p.fullName.trim().split(/\s+/).length < 2) errors.fullName = "Nhập họ và tên đầy đủ";
  if (!p.idNumber.trim()) errors.idNumber = "Nhập số giấy tờ hành khách";
  if (!p.type) errors.type = "Chọn đối tượng vé";
  return errors;
}
export function validateContact(c: Contact) {
  const errors: Record<string, string> = {};
  if (!/^\d{12}$/.test(c.cccd)) errors.cccd = "Nhập CCCD gồm 12 chữ số";
  if (c.fullName.trim().length < 3) errors.fullName = "Nhập họ tên người đặt";
  if (c.phone.trim() && !/^\d{9,15}$/.test(c.phone.trim()))
    errors.phone = "Nhập số điện thoại gồm 9 đến 15 chữ số";
  if (c.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email.trim()))
    errors.email = "Nhập email hợp lệ";
  return errors;
}
export function paymentReady(p: PaymentState) {
  if (!p.agree) return false;
  if (p.method === "atm") return !!p.bank;
  if (p.method === "card")
    return (
      /^\d{13,19}$/.test(p.card.number.replace(/\s/g, "")) &&
      !!p.card.name.trim() &&
      /^(0[1-9]|1[0-2])\/\d{2}$/.test(p.card.exp) &&
      /^\d{3,4}$/.test(p.card.cvc)
    );
  return true;
}
