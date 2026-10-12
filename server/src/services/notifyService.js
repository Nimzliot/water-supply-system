import { supabaseAdmin } from "../lib/supabase.js";
import { sendEmail, sendEmailInBackground } from "../lib/mailer.js";
import { env } from "../config/env.js";

const site = (path) => `${env.clientOrigin}${path}`;
const money = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;

async function adminEmails() {
  const { data } = await supabaseAdmin.from("users").select("email").eq("role", "admin");
  return (data || []).map((user) => user.email).filter(Boolean);
}

// Looks the admins up and sends in the background; a failure here never reaches the caller.
function sendToAdmins(message) {
  adminEmails()
    .then((to) => sendEmailInBackground({ ...message, to }))
    .catch((error) => console.error("[mail] Could not look up admin addresses:", error.message));
}

function billMessage(bill, user) {
  return {
    to: user.email,
    subject: `Your water bill for ${bill.month}: ${money(bill.total_amount)}`,
    heading: `Water bill for ${bill.month}`,
    lines: [`Hello ${user.name}, your water bill is ready.`],
    facts: [
      ["Service number", user.service_number],
      ["Water used", `${bill.total_usage} L`],
      ["Tariff", `Rs. ${bill.tariff} per liter`],
      ["Amount", money(bill.total_amount)],
      ["Status", bill.paid_status ? "Paid" : "Payment pending"]
    ],
    action: { label: "View bill", url: site(`/user/bill-details/${bill.id}`) }
  };
}

export function notifyBillGenerated(bill, user) {
  sendEmailInBackground(billMessage(bill, user));
}

// Used by the "email this bill" button, so the admin sees whether it actually went out.
export function sendBillEmail(bill, user) {
  return sendEmail(billMessage(bill, user));
}

export function notifyBillPaid(bill, user) {
  sendEmailInBackground({
    to: user.email,
    subject: `Payment received for ${bill.month}`,
    heading: "Payment received",
    lines: [`Hello ${user.name}, your payment for ${bill.month} has been recorded. Thank you.`],
    facts: [
      ["Service number", user.service_number],
      ["Amount paid", money(bill.total_amount)]
    ],
    action: { label: "View bill", url: site(`/user/bill-details/${bill.id}`) }
  });
}

export function notifyWelcome(user) {
  sendEmailInBackground({
    to: user.email,
    subject: "Your water account is ready",
    heading: `Welcome, ${user.name}`,
    lines: ["Your household account has been created. Sign in with your service number or this email address to see your usage, bills, and supply status."],
    facts: [["Service number", user.service_number]],
    action: { label: "Sign in", url: site("/login") }
  });
}

export function notifyRequestDecision(request, user) {
  const approved = request.status === "approved";
  sendEmailInBackground({
    to: user.email,
    subject: `Extra water request ${request.status}`,
    heading: approved ? "Your extra water request was approved" : "Your extra water request was not approved",
    lines: [
      approved
        ? `Hello ${user.name}, your daily limit is raised by ${request.requested_extra_liters} L on the day you asked for.`
        : `Hello ${user.name}, the administrator did not approve this request. Your normal daily limit applies.`
    ],
    facts: [
      ["Extra water", `${request.requested_extra_liters} L`],
      ["Needed on", request.required_date || "Not given"],
      ["Reason", request.reason]
    ],
    action: { label: "View your requests", url: site("/user/request-extra-water") }
  });
}

export function notifyAdminsNewRequest(request, user) {
  sendToAdmins({
    subject: `Extra water request from ${user.name}`,
    heading: "New extra water request",
    lines: [`${user.name} (${user.service_number}) has asked for extra water.`],
    facts: [
      ["Extra water", `${request.requested_extra_liters} L`],
      ["Needed on", request.required_date || "Not given"],
      ["Reason", request.reason]
    ],
    action: { label: "Review request", url: site("/admin/lpcd-requests") }
  });
}

export function notifySupportReply(ticket, user) {
  sendEmailInBackground({
    to: user.email,
    subject: `Reply to your support request: ${ticket.subject}`,
    heading: "The administrator replied",
    lines: [`Hello ${user.name}, here is the reply to "${ticket.subject}":`, ticket.admin_reply],
    action: { label: "Open support", url: site("/user/support") }
  });
}

export function notifyAdminsNewTicket(ticket, user) {
  sendToAdmins({
    subject: `Support request from ${user.name}: ${ticket.subject}`,
    heading: "New support request",
    lines: [`${user.name} (${user.service_number}) wrote:`, ticket.message],
    action: { label: "Reply", url: site("/admin/support") }
  });
}

export function notifyAdminsLeak(alert) {
  sendToAdmins({
    subject: "Leak detected by the water controller",
    heading: "Leak detected",
    lines: ["The controller has detected a leak and closed the valves. Supply resumes automatically after a short lockout unless the leak continues."],
    facts: [
      ["Details", alert.affected_house],
      ["Severity", alert.severity],
      ["Detected", new Date(alert.detected_at).toLocaleString("en-IN", { timeZone: env.timeZone })]
    ],
    action: { label: "View leak alerts", url: site("/admin/leakage-alerts") }
  });
}
