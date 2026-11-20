import React, { useState, useEffect } from "react";
import {
  Download,
  Users,
  IndianRupee,
  CalendarDays,
  Filter,
} from "lucide-react";
import { Button, Select, AlertNotice } from "../components/common";
import { studentsService } from "../services/studentsService";
import { batchesService } from "../services/batchesService";
import { feesService } from "../services/feesService";
import { academicsService } from "../services/academicsService";
import type { Batch } from "../types";

export const Reports: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("all");
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    batchesService.getBatches().then((res) => setBatches(res.data));
  }, []);

  const downloadCsv = (filename: string, csvContent: string) => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportStudents = async () => {
    setIsExporting("students");
    try {
      const res = await studentsService.getStudents();
      const filtered =
        selectedBatchId === "all"
          ? res.data
          : res.data.filter((s) => s.batch_id === selectedBatchId);

      const headers = [
        "Admission No",
        "Student Name",
        "Batch",
        "Student Phone",
        "Parent / Guardian Name",
        "Parent Phone",
        "Parent Relation",
        "Status",
        "Enrollment Date",
      ];

      const rows = filtered.map((s) => [
        `"${s.admission_no || "—"}"`,
        `"${s.full_name}"`,
        `"${s.batch_name || "Unassigned"}"`,
        `"${s.phone || "—"}"`,
        `"${s.parent_name || "—"}"`,
        `"${s.parent_phone || "—"}"`,
        `"${s.parent_relation || "—"}"`,
        `"${s.status}"`,
        `"${s.created_at || "—"}"`,
      ]);

      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      downloadCsv(
        `Pradeep_Classes_Students_${new Date().toISOString().split("T")[0]}.csv`,
        csv
      );
      setNotice(`Exported ${filtered.length} student records.`);
    } catch (err: any) {
      setNotice(err.message || "Failed to export students.");
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportFees = async () => {
    setIsExporting("fees");
    try {
      const res = await feesService.getFeeRecords();
      feesService.exportFeeLedgerCsv(res.data);
      setNotice(`Exported ${res.data.length} fee transaction records.`);
    } catch (err: any) {
      setNotice(err.message || "Failed to export fees.");
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportExams = async () => {
    setIsExporting("exams");
    try {
      const examsRes = await academicsService.getExams();
      const exams = examsRes.data;

      const headers = [
        "Exam Name",
        "Batch",
        "Subject",
        "Exam Date",
        "Total Marks",
        "Passing Marks",
        "Is Published",
      ];

      const rows = exams.map((e) => [
        `"${e.title}"`,
        `"${e.batch_name || "—"}"`,
        `"${e.subject}"`,
        `"${e.exam_date}"`,
        e.total_marks,
        e.passing_marks,
        e.is_published ? "YES" : "NO",
      ]);

      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      downloadCsv(
        `Pradeep_Classes_Exams_${new Date().toISOString().split("T")[0]}.csv`,
        csv
      );
      setNotice(`Exported ${exams.length} examination records.`);
    } catch (err: any) {
      setNotice(err.message || "Failed to export exams.");
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <div className="eyebrow">DATA EXPORT & AUDIT REPORTS</div>
        <h1 className="text-2xl font-extrabold text-[#102f50]">Institute Reports & Data Export</h1>
        <p className="text-sm text-slate-500">
          Export complete student records, fee reconciliation ledgers, and academic marks in standardized CSV formats.
        </p>
      </div>

      {notice && (
        <AlertNotice
          type="info"
          message={notice}
          onDismiss={() => setNotice(null)}
        />
      )}

      {/* Batch Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <Filter size={16} className="text-slate-400" />
        <span className="text-xs font-bold text-slate-700">Filter Export Scope:</span>
        <div className="w-64">
          <Select
            options={[
              { value: "all", label: "All Batches & Departments" },
              ...batches.map((b) => ({ value: b.id, label: b.name })),
            ]}
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
          />
        </div>
      </div>

      {/* Export Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Student Records */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow transition flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#16466f] flex items-center justify-center mb-4">
              <Users size={24} />
            </div>
            <h3 className="font-bold text-slate-900 text-lg">Student Directory</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Complete student master roster including unique admission numbers, emergency parent contact details, and enrollment statuses.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <Button
              variant="primary"
              className="w-full"
              isLoading={isExporting === "students"}
              icon={<Download size={15} />}
              onClick={handleExportStudents}
            >
              Export Student Roster (CSV)
            </Button>
          </div>
        </div>

        {/* Financial Fee Records */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow transition flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
              <IndianRupee size={24} />
            </div>
            <h3 className="font-bold text-slate-900 text-lg">Fee & Payment Ledger</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Full accounting audit ledger with transaction references, sequential receipt numbers, installment breakdown, and overdue balances.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <Button
              variant="outline"
              className="w-full border-emerald-600 text-emerald-800 hover:bg-emerald-50"
              isLoading={isExporting === "fees"}
              icon={<Download size={15} />}
              onClick={handleExportFees}
            >
              Export Fee Ledger (CSV)
            </Button>
          </div>
        </div>

        {/* Academic Exam Results */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow transition flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center mb-4">
              <CalendarDays size={24} />
            </div>
            <h3 className="font-bold text-slate-900 text-lg">Exams & Performance</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Summary of all unit tests, terminal examinations, passing marks requirements, and published marks sheets.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <Button
              variant="outline"
              className="w-full border-violet-600 text-violet-800 hover:bg-violet-50"
              isLoading={isExporting === "exams"}
              icon={<Download size={15} />}
              onClick={handleExportExams}
            >
              Export Exam Catalog (CSV)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
