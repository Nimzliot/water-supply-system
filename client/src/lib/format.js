export function formatMoney(value) {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
}

export function formatLiters(value) {
  const number = Number(value || 0);
  return `${number.toFixed(number >= 100 ? 0 : 1)} L`;
}

export function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : "--";
}

export function formatTime(value) {
  return value ? new Date(value).toLocaleTimeString() : "--";
}

export function errorMessage(error, fallback) {
  return error?.response?.data?.message || fallback;
}

// "2026-10" for the current month, for <input type="month">.
export function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// "2026-10-12" for today, for <input type="date">.
export function todayValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
