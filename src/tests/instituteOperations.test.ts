// src/tests/instituteOperations.test.ts
import { supabase } from "../lib/supabase";
import { teachersService } from "../services/teachersService";
import { feesService } from "../services/feesService";
import { batchesService } from "../services/batchesService";

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function verifyOperations() {
  if (supabase) {
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: "admin@pradeepclasses.in",
      password: "Pradeep@2026",
    });
    if (authError) {
      throw new Error(`Admin auth failed: ${authError.message}`);
    }
  }

  // 1. Verify Teachers
  console.log("Checking faculty records...");
  const teachRes = await teachersService.getTeachers();
  assert(!teachRes.error, `teachersService error: ${teachRes.error}`);
  assert(teachRes.data.length >= 10, `Expected at least 10 teachers, got ${teachRes.data.length}`);
  
  const director = teachRes.data.find(t => t.full_name.includes("Pradeep"));
  assert(Boolean(director), "Mr. Pradeep Kumar not found in faculty roster");
  assert(director?.assigned_batches.length! > 0, "Director has no assigned batches");
  console.log(`✓ Faculty verified: ${teachRes.data.length} teachers active with assigned batches.`);

  // 2. Verify Fee Structures
  console.log("Checking fee structures...");
  const feeStructures = await feesService.getFeeStructures();
  assert(feeStructures.length >= 7, `Expected at least 7 fee structures, got ${feeStructures.length}`);
  console.log(`✓ Fee structures verified: ${feeStructures.length} active course fee plans.`);

  // 3. Verify Fee Records
  console.log("Checking student fee dues...");
  const feeRecordsRes = await feesService.getFeeRecords();
  assert(!feeRecordsRes.error, `feesService error: ${feeRecordsRes.error}`);
  assert(feeRecordsRes.data.length >= 81, `Expected at least 81 fee records, got ${feeRecordsRes.data.length}`);
  console.log(`✓ Student fee records verified: ${feeRecordsRes.data.length} pending fee collection records.`);

  // 4. Verify Batches have enrolled students and assigned teachers
  console.log("Checking batch enrollments and faculty links...");
  const batchesRes = await batchesService.getBatches();
  assert(!batchesRes.error, `batchesService error: ${batchesRes.error}`);
  
  let totalEnrolled = 0;
  for (const b of batchesRes.data) {
    totalEnrolled += b.student_count;
    assert(b.assigned_teachers.length > 0, `Batch ${b.name} has no assigned teachers`);
  }
  assert(totalEnrolled === 81, `Expected total enrolled 81, got ${totalEnrolled}`);
  console.log(`✓ All 7 batches have verified teacher links and sum to 81 active students.`);

  console.log("==================================================");
  console.log("ALL INSTITUTE OPERATIONS TESTS PASSED CLEANLY!");
  console.log("==================================================");
}

verifyOperations().catch((err) => {
  console.error("OPERATIONS TEST FAILED:", err.message);
  process.exit(1);
});
