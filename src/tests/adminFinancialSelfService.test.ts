// src/tests/adminFinancialSelfService.test.ts
import { supabase } from "../lib/supabase";
import { settingsService } from "../services/settingsService";
import { feesService } from "../services/feesService";
import { ROLE_PERMISSIONS } from "../types/auth";

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runTests() {
  if (supabase) {
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: "admin@pradeepclasses.in",
      password: "Pradeep@2026",
    });
    if (authError) {
      throw new Error(`Admin authentication failed: ${authError.message}`);
    }
  }

  console.log("1. Verifying Role Permissions for Accountant & Admin...");
  assert(ROLE_PERMISSIONS.accountant.canManageFees === true, "Accountant must have canManageFees: true");
  assert(ROLE_PERMISSIONS.accountant.canViewReports === true, "Accountant must have canViewReports: true");
  assert(ROLE_PERMISSIONS.accountant.canManageInstitute === false, "Accountant must not manage institute-level settings");
  assert(ROLE_PERMISSIONS.owner.canManageFees === true, "Owner must have canManageFees: true");
  assert(ROLE_PERMISSIONS.admin.canManageFees === true, "Admin must have canManageFees: true");
  console.log("✓ Role permissions strictly verified.");

  console.log("2. Testing Institute Settings setup and editing...");
  const initialSettingsRes = await settingsService.getInstituteSettings();
  assert(Boolean(initialSettingsRes.data), "Failed to fetch institute settings");
  
  const updateRes = await settingsService.updateInstituteSettings({
    receipt_prefix: "PC-REC",
    invoice_prefix: "PC-INV",
    currency_symbol: "₹",
    terms_and_conditions: "Tuition fees once paid are non-refundable. Pradeep Classes Mathura.",
  });
  assert(!updateRes.error, `updateInstituteSettings error: ${updateRes.error}`);
  assert(updateRes.data?.receipt_prefix === "PC-REC", "Receipt prefix not saved");
  assert(updateRes.data?.invoice_prefix === "PC-INV", "Invoice prefix not saved");
  console.log("✓ Institute receipt numbering & financial policies updated successfully.");

  console.log("3. Testing Fee Structure Self-Service CRUD...");
  // Create
  const testPlanName = `Test Olympiad Prep ${Date.now()}`;
  const createRes = await feesService.createFeeStructure({
    course_name: testPlanName,
    academic_year: "2025-2026",
    total_fee: 3500,
    description: "Specialized Olympiad problem-solving batch",
  });
  assert(!createRes.error, `createFeeStructure error: ${createRes.error}`);
  assert(Boolean(createRes.data?.id), "Created fee structure missing ID");
  const createdId = createRes.data!.id;

  // Read
  const allStructures = await feesService.getFeeStructures();
  const found = allStructures.find((fs) => fs.id === createdId);
  assert(Boolean(found), "Created fee structure not found in list");
  assert(found?.total_fee === 3500, "Fee structure total_fee mismatch");

  // Update
  const updateFsRes = await feesService.updateFeeStructure(createdId, {
    total_fee: 3800,
    description: "Updated description with test series",
  });
  assert(!updateFsRes.error, `updateFeeStructure error: ${updateFsRes.error}`);
  assert(updateFsRes.data?.total_fee === 3800, "Updated fee not reflected");

  // Delete
  const deleteFsRes = await feesService.deleteFeeStructure(createdId);
  assert(deleteFsRes.success, `deleteFeeStructure failed: ${deleteFsRes.error}`);
  console.log("✓ Fee Structure CRUD operations verified.");

  console.log("4. Testing Batch Invoicing for Students...");
  if (supabase) {
    const { data: batches } = await supabase.from("batches").select("id, name").limit(1);
    if (batches && batches.length > 0) {
      const b = batches[0];
      const batchRes = await feesService.batchIssueInvoices({
        batch_id: b.id,
        title: "Test Batch Fee Billing Run",
        amount: 500,
        due_date: "2026-12-15",
        notes: "Automated test billing verification",
      });
      assert(batchRes.success, `batchIssueInvoices error: ${batchRes.error}`);
      assert(batchRes.count > 0, `Expected batch count > 0, got ${batchRes.count}`);
      console.log(`✓ Batch fee invoices generated for ${batchRes.count} students in ${b.name}.`);

      // Cleanup test batch records
      await supabase.from("fee_records").delete().eq("title", "Test Batch Fee Billing Run");
    }
  }

  console.log("==================================================");
  console.log("ALL FINANCIAL SELF-SERVICE & RIGHTS TESTS PASSED!");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("TEST FAILED:", err.message);
  process.exit(1);
});
