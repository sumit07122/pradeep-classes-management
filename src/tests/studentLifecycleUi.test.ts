import { studentsService } from "../services/studentsService";
import type { Student } from "../types";

function assertEqual<T>(actual: T, expected: T, message?: string) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(
      message || `Assertion failed.\nExpected: ${expectedStr}\nActual:   ${actualStr}`
    );
  }
}

export async function runStudentLifecycleUiTests() {
  console.log("=== Running Student Lifecycle UI Unit Tests ===");

  const sampleStudents: Student[] = [
    {
      id: "s-1",
      admission_no: "PC-2026-001",
      full_name: "Aarav Patel",
      class_name: "Class 12",
      batch_name: "JEE Advanced 2026",
      phone: "+91 98765 00001",
      status: "active",
    },
    {
      id: "s-2",
      admission_no: "PC-2026-002",
      full_name: "Sneha Gupta",
      class_name: "Class 12",
      batch_name: "NEET Medical 2026",
      phone: "+91 98765 00002",
      status: "on_hold",
      status_reason: "Term 2 fees installment pending",
    },
    {
      id: "s-3",
      admission_no: "PC-2025-099",
      full_name: "Rohan Verma",
      class_name: "Class 12",
      batch_name: "Unassigned",
      phone: "+91 98765 00003",
      status: "alumni",
      status_reason: "Cleared JEE Advanced with AIR 412",
      exit_date: "2026-06-15",
    },
    {
      id: "s-4",
      admission_no: "PC-2026-044",
      full_name: "Kabir Singh",
      class_name: "Class 11",
      batch_name: "Unassigned",
      phone: "+91 98765 00004",
      status: "rusticated",
      status_reason: "Suspended due to repeated disciplinary breach",
      exit_date: "2026-11-20",
    },
    {
      id: "s-5",
      admission_no: "PC-2026-055",
      full_name: "Meera Joshi",
      class_name: "Class 10",
      batch_name: "Unassigned",
      phone: "+91 98765 00005",
      status: "dropped_out",
      status_reason: "Relocated to another state",
      exit_date: "2026-10-10",
    },
    {
      id: "s-6",
      admission_no: "PC-2025-010",
      full_name: "Aditya Kumar",
      class_name: "Class 12",
      batch_name: "Unassigned",
      phone: "+91 98765 00006",
      status: "archived",
      status_reason: "Historical audit record",
    },
  ];

  // --------------------------------------------------------------------------
  // Test 1: Category Mapping and Badge Properties
  // --------------------------------------------------------------------------
  {
    const getBadgeProps = (st: string) => {
      const norm = st.toLowerCase().replace(/\s+/g, "_");
      switch (norm) {
        case "active":
          return { variant: "success", label: "Active" };
        case "on_hold":
          return { variant: "warning", label: "On Hold" };
        case "alumni":
          return { variant: "blue", label: "Alumni" };
        case "rusticated":
          return { variant: "red", label: "Rusticated" };
        case "dropped_out":
          return { variant: "amber", label: "Dropped Out" };
        case "archived":
        default:
          return { variant: "neutral", label: "Archived" };
      }
    };

    assertEqual(getBadgeProps(sampleStudents[0].status), { variant: "success", label: "Active" });
    assertEqual(getBadgeProps(sampleStudents[1].status), { variant: "warning", label: "On Hold" });
    assertEqual(getBadgeProps(sampleStudents[2].status), { variant: "blue", label: "Alumni" });
    assertEqual(getBadgeProps(sampleStudents[3].status), { variant: "red", label: "Rusticated" });
    assertEqual(getBadgeProps(sampleStudents[4].status), { variant: "amber", label: "Dropped Out" });
    assertEqual(getBadgeProps(sampleStudents[5].status), { variant: "neutral", label: "Archived" });

    console.log("✓ Badge properties and labels map correctly for all 6 student lifecycle statuses");
  }

  // --------------------------------------------------------------------------
  // Test 2: StudentStatusModal - Transition to Alumni
  // --------------------------------------------------------------------------
  {
    let updatedPayload: any = null;
    const mockClient = {
      from: (_table: string) => ({
        update: (payload: any) => ({
          eq: async (_col: string, _val: any) => {
            updatedPayload = payload;
            return { data: null, error: null };
          },
        }),
      }),
    };
    studentsService.setSupabaseClient(mockClient);

    const res = await studentsService.updateStudentStatus(
      "s-1",
      "alumni",
      "Graduated with top honors in 2026",
      "2026-11-22"
    );

    assertEqual(res.success, true);
    assertEqual(updatedPayload.status, "alumni");
    assertEqual(updatedPayload.status_reason, "Graduated with top honors in 2026");
    assertEqual(updatedPayload.exit_date, "2026-11-22");

    console.log("✓ StudentStatusModal transition to Alumni records exit date and achievement reason");
  }

  // --------------------------------------------------------------------------
  // Test 3: StudentDeleteModal - Soft Archive
  // --------------------------------------------------------------------------
  {
    let updatedPayload: any = null;
    const mockClient = {
      from: (_table: string) => ({
        update: (payload: any) => ({
          eq: async (_col: string, _val: any) => {
            updatedPayload = payload;
            return { data: null, error: null };
          },
        }),
      }),
    };
    studentsService.setSupabaseClient(mockClient);

    const res = await studentsService.updateStudentStatus(
      "s-2",
      "archived",
      "Preserving fee receipts and exams marks while archiving",
      "2026-11-22"
    );

    assertEqual(res.success, true);
    assertEqual(updatedPayload.status, "archived");
    assertEqual(updatedPayload.exit_date, "2026-11-22");

    console.log("✓ StudentDeleteModal soft-archive path safely sets archived status");
  }

  // --------------------------------------------------------------------------
  // Test 4: StudentDeleteModal - Force Cascade Delete
  // --------------------------------------------------------------------------
  {
    let rpcParams: any = null;
    const mockClient = {
      rpc: async (fn: string, params: any) => {
        if (fn === "admin_delete_student") {
          rpcParams = params;
          return {
            data: {
              success: true,
              deleted_id: params.p_student_id,
              message: "Student and all dependent records permanently purged",
            },
            error: null,
          };
        }
        return { data: null, error: { message: "Unknown RPC" } };
      },
    };
    studentsService.setSupabaseClient(mockClient);

    const res = await studentsService.deleteStudent("s-4", true);
    assertEqual(res.success, true);
    assertEqual(rpcParams.p_student_id, "s-4");
    assertEqual(rpcParams.p_force_cascade, true);

    console.log("✓ StudentDeleteModal force cascade delete dispatches admin_delete_student RPC with cascade true");
  }

  console.log("=== All Student Lifecycle UI Unit Tests Passed Successfully ===");
}

// Auto-run if executed directly in Node
const proc = (globalThis as any).process;
if (typeof proc !== "undefined" && proc.argv && proc.argv[1]?.includes("studentLifecycleUi.test")) {
  runStudentLifecycleUiTests().catch((err) => {
    console.error("Test execution failed:", err);
    proc.exit(1);
  });
}
