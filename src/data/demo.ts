import type { Student, Teacher } from "../types";

export const demoStudents: Student[] = [
  { id: "1", admission_no: "PC-2026-001", full_name: "Aarav Sharma", class_name: "Class 12", batch_name: "JEE Morning", phone: "9876543210", status: "Active" },
  { id: "2", admission_no: "PC-2026-002", full_name: "Ananya Verma", class_name: "Class 11", batch_name: "NEET Evening", phone: "9876543211", status: "Active" },
  { id: "3", admission_no: "PC-2026-003", full_name: "Rohan Singh", class_name: "Class 10", batch_name: "Foundation A", phone: "9876543212", status: "Active" },
  { id: "4", admission_no: "PC-2026-004", full_name: "Ishita Gupta", class_name: "Class 12", batch_name: "JEE Morning", phone: "9876543213", status: "On hold" },
  { id: "5", admission_no: "PC-2026-005", full_name: "Kabir Yadav", class_name: "Class 11", batch_name: "NEET Evening", phone: "9876543214", status: "Active" }
];
export const demoTeachers: Teacher[] = [
  { id: "1", full_name: "Amit Kumar", subject: "Physics", phone: "9810010001", assigned_batches: ["JEE Morning", "Foundation A"] },
  { id: "2", full_name: "Neha Sharma", subject: "Chemistry", phone: "9810010002", assigned_batches: ["NEET Evening"] },
  { id: "3", full_name: "Rahul Mishra", subject: "Mathematics", phone: "9810010003", assigned_batches: ["JEE Morning"] }
];
export const batches = ["JEE Morning", "NEET Evening", "Foundation A", "Class 10 Evening"];
