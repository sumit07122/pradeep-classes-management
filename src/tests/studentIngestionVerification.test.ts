// src/tests/studentIngestionVerification.test.ts
import { supabase } from "../lib/supabase";
import { studentsService } from "../services/studentsService";

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function verifyIngestedStudents() {
  if (supabase) {
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: "admin@pradeepclasses.in",
      password: "Pradeep@2026",
    });
    if (authError) {
      throw new Error(`Admin authentication failed: ${authError.message}`);
    }
  }

  const res = await studentsService.getStudents();
  if (res.error) {
    throw new Error(`studentsService error: ${res.error}`);
  }
  
  assert(res.data.length >= 81, `Expected at least 81 students, found ${res.data.length}`);
  const first = res.data.find(s => s.admission_no === "PC-2025-0001");
  assert(Boolean(first), "PC-2025-0001 not found");
  assert(first?.full_name === "Aarohi Singh", `Unexpected name for PC-2025-0001: ${first?.full_name}`);
  assert(Boolean(first?.batch_id), "PC-2025-0001 missing batch_id");
  
  const last = res.data.find(s => s.admission_no === "PC-2025-0081");
  assert(Boolean(last), "PC-2025-0081 not found");

  console.log(`Ingestion verification passed: ${res.data.length} students live and verified in portal.`);
}

verifyIngestedStudents().catch((err) => {
  console.error("TEST FAILED:", err.message);
  process.exit(1);
});
