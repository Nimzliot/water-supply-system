import api from "./api";

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
let checkoutLoading = null;

// Razorpay's payment window is loaded from their servers the first time it is needed.
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (!checkoutLoading) {
    checkoutLoading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = CHECKOUT_SCRIPT;
      script.onload = resolve;
      script.onerror = () => {
        checkoutLoading = null;
        reject(new Error("The payment window could not be loaded. Check your internet connection."));
      };
      document.body.appendChild(script);
    });
  }
  return checkoutLoading;
}

// Pays one bill: the server opens an order for the bill's amount, Razorpay's window takes
// the payment, and the server checks the result before the bill is marked paid.
// Resolves with the paid bill, or with null when the household closes the window.
export async function payBill(bill) {
  const [{ data: order }] = await Promise.all([api.post(`/user/bills/${bill.id}/pay`), loadCheckout()]);

  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay({
      key: order.key_id,
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
      name: "Water Distribution",
      description: order.description,
      prefill: order.prefill,
      theme: { color: "#e23744" },
      modal: { ondismiss: () => resolve(null) },
      handler: async (response) => {
        try {
          const { data } = await api.post(`/user/bills/${bill.id}/pay/confirm`, response);
          resolve(data.bill);
        } catch (error) {
          reject(error);
        }
      }
    });

    checkout.on("payment.failed", (event) => reject(new Error(event.error?.description || "The payment did not go through.")));
    checkout.open();
  });
}
