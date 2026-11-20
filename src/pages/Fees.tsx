import React, { useState } from "react";
import { IndianRupee, Clock, Download, Plus } from "lucide-react";
import { Button, Badge, StatCard, AlertNotice } from "../components/common";
import { useAuth } from "../hooks/useAuth";

export const Fees: React.FC = () => {
  const { isDemoMode } = useAuth();
  const [notice, setNotice] = useState<string | null>(null);

  const sampleFeeRecords = [
    { id: "1", student: "Aarav Sharma", admissionNo: "PC-2026-001", batch: "JEE Morning", amount: 12500, status: "paid", receipt: "REC-2026-042", date: "15 Nov 2026" },
    { id: "2", student: "Ananya Verma", admissionNo: "PC-2026-002", batch: "NEET Evening", amount: 15000, status: "paid", receipt: "REC-2026-043", date: "16 Nov 2026" },
    { id: "3", student: "Rohan Singh", admissionNo: "PC-2026-003", batch: "Foundation A", amount: 8000, status: "pending", receipt: "-", date: "Due 25 Nov 2026" },
    { id: "4", student: "Ishita Gupta", admissionNo: "PC-2026-004", batch: "JEE Morning", amount: 12500, status: "pending", receipt: "-", date: "Due 28 Nov 2026" },
    { id: "5", student: "Kabir Yadav", admissionNo: "PC-2026-005", batch: "NEET Evening", amount: 15000, status: "paid", receipt: "REC-2026-044", date: "18 Nov 2026" },
  ];

  return (
    <div className="space-y-5">
      {notice && (
        <AlertNotice type="info" message={notice} onDismiss={() => setNotice(null)} />
      )}

      <div className="welcome-row">
        <div>
          <div className="eyebrow">FEE MANAGEMENT</div>
          <h1>Fee Collection & Invoicing</h1>
          <p>Track student tuition receipts, outstanding dues, and monthly reconciliations.</p>
        </div>
        <Button
          variant="primary"
          onClick={() =>
            setNotice(
              isDemoMode
                ? "Fee collection workflow will connect to live Supabase ledger in Milestone 2."
                : "Payment collected."
            )
          }
          icon={<Plus size={16} />}
        >
          Collect fee
        </Button>
      </div>

      <section className="stats-grid">
        <StatCard
          title="Total Collected"
          value="₹48,500"
          delta="+14.2%"
          note="this billing cycle"
          icon={IndianRupee}
          tone="green"
          isDemo={isDemoMode}
        />
        <StatCard
          title="Pending Dues"
          value="₹16,500"
          delta="12 students"
          note="unpaid balances"
          icon={Clock}
          tone="amber"
          isDemo={isDemoMode}
        />
        <StatCard
          title="Total Target"
          value="₹65,000"
          delta="74.6%"
          note="realized so far"
          icon={IndianRupee}
          tone="blue"
          isDemo={isDemoMode}
        />
      </section>

      <section className="panel directory-panel">
        <div className="panel-heading">
          <div>
            <h3>Recent Transactions & Invoices</h3>
            <p>Student fee payment history and generated receipts</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={14} />}
            onClick={() => alert("Report generation scheduled for milestone 2.")}
          >
            Export Ledger
          </Button>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>STUDENT</th>
                <th>ADMISSION NO.</th>
                <th>BATCH</th>
                <th>AMOUNT</th>
                <th>PAYMENT STATUS</th>
                <th>RECEIPT ID</th>
                <th>DATE</th>
              </tr>
            </thead>
            <tbody>
              {sampleFeeRecords.map((r) => (
                <tr key={r.id}>
                  <td>
                    <b>{r.student}</b>
                  </td>
                  <td className="muted-cell">{r.admissionNo}</td>
                  <td>{r.batch}</td>
                  <td className="font-bold text-slate-800 font-['Manrope']">
                    ₹{r.amount.toLocaleString("en-IN")}
                  </td>
                  <td>
                    <Badge
                      variant={r.status === "paid" ? "success" : "warning"}
                      size="sm"
                      showDot
                    >
                      {r.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="font-mono text-[11px] text-slate-500">{r.receipt}</td>
                  <td className="text-slate-500">{r.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span>Showing 5 fee records</span>
          {isDemoMode && (
            <Badge variant="demo" size="sm">
              DEMO SAMPLE DATA
            </Badge>
          )}
        </div>
      </section>
    </div>
  );
};
