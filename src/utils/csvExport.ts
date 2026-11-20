import type { Student } from "../types";

export function exportStudentsToCSV(students: Student[], filename?: string): void {
  if (!students || students.length === 0) {
    alert("No student records available to export.");
    return;
  }

  const headers = [
    "Admission No",
    "Full Name",
    "Class",
    "Batch Name",
    "Mobile Phone",
    "Email",
    "Gender",
    "Date of Birth",
    "Parent / Guardian Name",
    "Parent Relationship",
    "Parent Phone",
    "Parent Email",
    "Emergency Contact",
    "Address",
    "City",
    "Status",
    "Joined On",
  ];

  const escapeCSV = (val?: string | null): string => {
    if (val === undefined || val === null) return '""';
    const clean = String(val).replace(/"/g, '""');
    return `"${clean}"`;
  };

  const rows = students.map((s) => [
    escapeCSV(s.admission_no),
    escapeCSV(s.full_name),
    escapeCSV(s.class_name),
    escapeCSV(s.batch_name),
    escapeCSV(s.phone),
    escapeCSV(s.email),
    escapeCSV(s.gender),
    escapeCSV(s.date_of_birth),
    escapeCSV(s.parent_name),
    escapeCSV(s.parent_relation),
    escapeCSV(s.parent_phone),
    escapeCSV(s.parent_email),
    escapeCSV(s.emergency_contact),
    escapeCSV(s.address),
    escapeCSV(s.city),
    escapeCSV(s.status),
    escapeCSV(s.joined_on),
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const today = new Date().toISOString().split("T")[0];
  link.setAttribute("href", url);
  link.setAttribute("download", filename || `pradeep-classes-students-${today}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
