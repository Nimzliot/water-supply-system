import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import PageHeader from "../../components/PageHeader";
import { socket } from "../../lib/socket";

export default function BillsPage() {
  const [bills, setBills] = useState([]);

  const downloadBill = (bill) => {
    const content = [
      "Smart Automated Rural Water Distribution System",
      "Household Water Bill",
      "",
      `Bill Month: ${bill.month}`,
      `Bill ID: ${bill.id}`,
      `Total Usage: ${bill.total_usage} L`,
      `Tariff: Rs. ${bill.tariff} per L`,
      `Total Amount: Rs. ${bill.total_amount}`,
      `Payment Status: ${bill.paid_status ? "Paid" : "Pending"}`
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `water-bill-${bill.month.toLowerCase().replace(/\s+/g, "-")}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const load = () => api.get("/user/bills").then(({ data }) => setBills(data.bills));

    load();
    socket.on("billing:update", load);
    window.addEventListener("focus", load);
    const interval = window.setInterval(load, 30000);

    return () => {
      socket.off("billing:update", load);
      window.removeEventListener("focus", load);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bills"
        title="Bills, PDF downloads, and payment history"
        description="Household billing center for monthly statements."
      />
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {bills.map((bill) => (
          <div key={bill.id} className="panel p-5">
            <p className="text-lg font-semibold text-white">{bill.month}</p>
            <p className="mt-4 text-3xl font-bold text-aqua">Rs. {bill.total_amount}</p>
            <p className="mt-2 text-sm text-slate-300">Usage: {bill.total_usage} L</p>
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => downloadBill(bill)} className="btn-secondary flex-1">Download Bill</button>
              <Link to={`/user/bill-details/${bill.id}`} className="btn-primary flex-1">Details</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
