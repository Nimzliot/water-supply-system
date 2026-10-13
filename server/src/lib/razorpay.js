import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

const API = "https://api.razorpay.com/v1";

// Razorpay will not take a payment smaller than this.
export const MIN_PAYMENT_RUPEES = 1;

if (!env.razorpayKeyId || !env.razorpayKeySecret) {
  console.warn("[payments] Razorpay is not configured (set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET). Online payment is switched off.");
}

export function paymentsStatus() {
  const configured = Boolean(env.razorpayKeyId && env.razorpayKeySecret);
  return { enabled: configured, test_mode: configured && env.razorpayKeyId.startsWith("rzp_test_"), minimum: MIN_PAYMENT_RUPEES };
}

async function call(method, path, body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString("base64")}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.description || `Razorpay answered ${response.status}`);
  }
  return data;
}

// Starts a payment. Razorpay counts money in paise, so the amount is rupees times 100.
export function createOrder({ amountRupees, receipt, notes }) {
  return call("POST", "/orders", {
    amount: Math.round(Number(amountRupees) * 100),
    currency: "INR",
    receipt,
    notes
  });
}

export function fetchOrder(orderId) {
  return call("GET", `/orders/${encodeURIComponent(orderId)}`);
}

// Razorpay signs "order_id|payment_id" with the key secret. A matching signature proves the
// payment details came from Razorpay and were not made up in the browser.
export function isValidSignature({ orderId, paymentId, signature }) {
  const expected = createHmac("sha256", env.razorpayKeySecret).update(`${orderId}|${paymentId}`).digest("hex");
  const given = Buffer.from(String(signature || ""));
  const wanted = Buffer.from(expected);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}
