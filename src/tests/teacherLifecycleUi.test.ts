import { teachersService } from "../services/teachersService";
import type { Teacher } from "../types";

function assertEqual<T>(actual: T, expected: T, message?: string) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(
      message || `Assertion failed.\nExpected: ${expectedStr}\nActual:   ${actualStr}`
    );
  }
}

function assertTrue(condition: boolean, message?: string) {
  if (!condition) {
    throw new Error(message || "Assertion failed: expected true, got false");
  }
}

export async function runTeacherLifecycleUiTests() {
  console.log("=== Running Teacher Lifecycle UI Unit Tests ===");

  const sampleTeachers: Teacher[] = [
    {
      id: "t-1",
      full_name: "Dr. Rajesh Sharma",
      subject: "Physics",
      phone: "+91 98765 11111",
      assigned_batches: ["JEE Advanced 2026", "NEET Medical 2026"],
      is_active: true,
      status: "active",
      salary_config: { calculation_type: "monthly_fixed", base_amount: 65000, per_lecture_rate: 0 },
    },
    {
      id: "t-2",
      full_name: "Er. Manoj Deshmukh",
      subject: "Mathematics",
      phone: "+91 98200 77889",
      assigned_batches: ["JEE Advanced 2026"],
      is_active: true,
      status: "on_leave",
      status_reason: "Family medical leave",
      salary_config: { calculation_type: "per_lecture", base_amount: 0, per_lecture_rate: 1500 },
    },
    {
      id: "t-3",
      full_name: "Prof. Sunita Patil",
      subject: "Chemistry",
      phone: "+91 98200 44556",
      assigned_batches: [],
      is_active: false,
      status: "relieved",
      status_reason: "Resigned to pursue PhD abroad",
      relieving_date: "2026-11-01",
      salary_config: { calculation_type: "per_lecture", base_amount: 0, per_lecture_rate: 1500 },
    },
  ];

  // Helper logic mirroring Teachers.tsx
  const getTeacherEffectiveStatus = (t: Teacher): "active" | "on_leave" | "relieved" => {
    if (t.status === "on_leave") return "on_leave";
    if (t.status === "relieved") return "relieved";
    if (t.status === "active") return "active";
    return t.is_active ? "active" : "relieved";
  };

  // --------------------------------------------------------------------------
  // Test 1: Category Filtering and Status Counts
  // --------------------------------------------------------------------------
  {
    const activeCount = sampleTeachers.filter((t) => getTeacherEffectiveStatus(t) === "active").length;
    const onLeaveCount = sampleTeachers.filter((t) => getTeacherEffectiveStatus(t) === "on_leave").length;
    const relievedCount = sampleTeachers.filter((t) => getTeacherEffectiveStatus(t) === "relieved").length;

    assertEqual(activeCount, 1);
    assertEqual(onLeaveCount, 1);
    assertEqual(relievedCount, 1);
    assertEqual(sampleTeachers.length, 3);

    const activeList = sampleTeachers.filter((t) => getTeacherEffectiveStatus(t) === "active");
    assertEqual(activeList[0].full_name, "Dr. Rajesh Sharma");

    const onLeaveList = sampleTeachers.filter((t) => getTeacherEffectiveStatus(t) === "on_leave");
    assertEqual(onLeaveList[0].full_name, "Er. Manoj Deshmukh");

    const relievedList = sampleTeachers.filter((t) => getTeacherEffectiveStatus(t) === "relieved");
    assertEqual(relievedList[0].full_name, "Prof. Sunita Patil");

    console.log("✓ Teacher status filtering and counts partition correctly across lifecycle tabs");
  }

  // --------------------------------------------------------------------------
  // Test 2: TeacherDeleteModal - Soft Archive / Relieve Option
  // --------------------------------------------------------------------------
  {
    let updatedPayload: any = null;
    const mockClient = {
      from: (table: string) => ({
        update: (payload: any) => ({
          eq: async (col: string, val: any) => {
            if (table === "teachers" && col === "id" && val === "t-1") {
              updatedPayload = payload;
              return { data: null, error: null };
            }
            return { data: null, error: { message: "Not found" } };
          },
        }),
      }),
    };
    teachersService.setSupabaseClient(mockClient);

    const res = await teachersService.updateTeacherStatus(
      "t-1",
      "relieved",
      "Preserving payroll while relieving faculty",
      "2026-11-22"
    );

    assertEqual(res.success, true);
    assertEqual(updatedPayload.status, "relieved");
    assertEqual(updatedPayload.is_active, false);
    assertEqual(updatedPayload.relieving_date, "2026-11-22");
    assertEqual(updatedPayload.status_reason, "Preserving payroll while relieving faculty");

    console.log("✓ TeacherDeleteModal soft-archive path marks teacher as relieved and preserves financial auditability");
  }

  // --------------------------------------------------------------------------
  // Test 3: TeacherDeleteModal - Hard Cascade Delete Confirmation
  // --------------------------------------------------------------------------
  {
    let cascadeRpcCalled = false;
    let rpcParams: any = null;

    const mockClient = {
      rpc: async (fn: string, params: any) => {
        if (fn === "admin_delete_teacher") {
          cascadeRpcCalled = true;
          rpcParams = params;
          return {
            data: {
              success: true,
              deleted_id: params.p_teacher_id,
              message: "Faculty member and all related academic/payroll records permanently removed",
            },
            error: null,
          };
        }
        return { data: null, error: { message: "Unknown RPC" } };
      },
    };
    teachersService.setSupabaseClient(mockClient);

    const res = await teachersService.deleteTeacher("t-1", true);
    assertEqual(res.success, true);
    assertTrue(cascadeRpcCalled);
    assertEqual(rpcParams.p_teacher_id, "t-1");
    assertEqual(rpcParams.p_force_cascade, true);

    console.log("✓ TeacherDeleteModal hard-delete path executes cascade deletion RPC with safety flag");
  }

  // --------------------------------------------------------------------------
  // Test 4: TeacherStatusModal - Transition to On Leave with reason
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
    teachersService.setSupabaseClient(mockClient);

    const res = await teachersService.updateTeacherStatus(
      "t-1",
      "on_leave",
      "Medical recovery leave until end of term"
    );

    assertEqual(res.success, true);
    assertEqual(updatedPayload.status, "on_leave");
    assertEqual(updatedPayload.is_active, false);
    assertEqual(updatedPayload.status_reason, "Medical recovery leave until end of term");

    console.log("✓ TeacherStatusModal transitions faculty to On Leave with administrative reason");
  }

  console.log("=== All Teacher Lifecycle UI Unit Tests Passed Successfully ===");
}

// Auto-run if executed directly in Node
const proc = (globalThis as any).process;
if (typeof proc !== "undefined" && proc.argv && proc.argv[1]?.includes("teacherLifecycleUi.test")) {
  runTeacherLifecycleUiTests().catch((err) => {
    console.error("Test execution failed:", err);
    proc.exit(1);
  });
}
