import React from 'react';
import { IndianRupee, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { StatCard } from '../common';
import type { FeeSummary } from '../../types/fees';

interface FeeStatsSummaryProps {
  summary: FeeSummary;
}

export const FeeStatsSummary: React.FC<FeeStatsSummaryProps> = ({ summary }) => {
  return (
    <section className="stats-grid">
      <StatCard
        title="Total Collected"
        value={`₹${summary.total_collected.toLocaleString('en-IN')}`}
        delta={`${summary.collection_percentage}% realized`}
        note="verified receipts"
        icon={CheckCircle2}
        tone="green"
      />
      <StatCard
        title="Pending Dues"
        value={`₹${summary.total_pending.toLocaleString('en-IN')}`}
        delta={`${summary.pending_students_count} students`}
        note="unpaid balances"
        icon={Clock}
        tone="amber"
      />
      <StatCard
        title="Total Target"
        value={`₹${summary.total_billed.toLocaleString('en-IN')}`}
        delta="100% Billing"
        note="total fee invoiced"
        icon={IndianRupee}
        tone="blue"
      />
      <StatCard
        title="Overdue Dues"
        value={summary.overdue_invoices_count}
        delta={summary.overdue_invoices_count > 0 ? "Requires Followup" : "All on schedule"}
        note="past due date"
        icon={AlertTriangle}
        tone={summary.overdue_invoices_count > 0 ? "amber" : "green"}
      />
    </section>
  );
};
