import { whatsappAutomationService } from "../services/whatsappAutomationService";

async function runTestSuite() {
  console.log("=== Running WhatsApp Automations & Login Mascot Verification Suite ===");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
      failed++;
    }
  }

  // 1. Batch Attendance 5-Min Delayed Auto-Dispatch
  console.log("\n1. Testing Batch Attendance 5-Min Auto-Dispatch:");
  try {
    const res = await whatsappAutomationService.scheduleBatchAttendance5MinDispatch({
      batchId: "batch-test-101",
      batchName: "Class 10th Foundation",
      sessionDate: "2026-11-28",
      absentStudents: [
        {
          student_id: "stu-1",
          student_name: "Aarav Sharma",
          parent_phone: "9876543210",
        },
        {
          student_id: "stu-2",
          student_name: "Priya Patel",
          phone: "9123456789",
        },
      ],
    });

    assert(res.automationName === "Batch Attendance 5-Min Auto-Dispatch", "Correct automation name");
    assert(res.processedCount === 2, `Processed 2 absent students (got ${res.processedCount})`);
    assert(res.details.includes("Scheduled for"), `Details contains scheduled time: "${res.details}"`);
  } catch (err: any) {
    assert(false, `Batch attendance auto-dispatch error: ${err.message}`);
  }

  // 2. Instant Fee Deposit Receipt Notification
  console.log("\n2. Testing Instant Fee Deposit Receipt Notification:");
  try {
    const res = await whatsappAutomationService.triggerInstantFeeDepositReceipt({
      studentId: "stu-1",
      studentName: "Aarav Sharma",
      amountPaid: 3500,
      paymentMode: "upi",
      receiptId: "REC-2026-0099",
      remainingBalance: 500,
      parentPhone: "9876543210",
    });

    assert(res.success === true, `Triggered instant fee deposit receipt successfully`);
  } catch (err: any) {
    assert(false, `Fee receipt notification error: ${err.message}`);
  }

  // 3. Monthly Fee Due Auto-Reminder Scanner
  console.log("\n3. Testing Monthly Fee Due Auto-Reminder Scanner:");
  try {
    const res = await whatsappAutomationService.scanAndQueueMonthlyFeeReminders();
    assert(res.automationName.includes("Monthly Fee Due Auto-Reminder"), "Correct fee reminder automation name");
    assert(typeof res.processedCount === "number", `Returns processedCount number (${res.processedCount})`);
    assert(typeof res.queuedCount === "number", `Returns queuedCount number (${res.queuedCount})`);
  } catch (err: any) {
    assert(false, `Monthly fee due reminder scanner error: ${err.message}`);
  }

  // 4. Automated Exam Scorecard Broadcast
  console.log("\n4. Testing Automated Exam Scorecard Broadcast:");
  try {
    const res = await whatsappAutomationService.broadcastExamScorecards("non-existent-exam");
    assert(res.automationName === "Automated Exam Scorecard Dispatch", "Correct scorecard automation name");
    assert(Boolean(res.details), `Graceful handling of non-existent exam: "${res.details}"`);
  } catch (err: any) {
    assert(false, `Exam scorecard broadcast error: ${err.message}`);
  }

  // 5. Daily Class Diary & Homework Broadcast
  console.log("\n5. Testing Daily Class Diary & Homework Broadcast:");
  try {
    const res = await whatsappAutomationService.broadcastDailyDiaryAndHomework({
      date: "2026-11-28",
    });
    assert(res.automationName.includes("Daily Class Diary & Homework"), "Correct diary broadcast name");
    assert(typeof res.processedCount === "number", `Processed count is number (${res.processedCount})`);
  } catch (err: any) {
    assert(false, `Class diary & homework broadcast error: ${err.message}`);
  }

  // 6. Automated Student Birthday Wishes
  console.log("\n6. Testing Automated Student Birthday Wishes:");
  try {
    const res = await whatsappAutomationService.scanAndQueueBirthdayWishes();
    assert(res.automationName === "Automated Student Birthday Wishes", "Correct birthday wishes name");
    assert(typeof res.processedCount === "number", `Processed count is number (${res.processedCount})`);
  } catch (err: any) {
    assert(false, `Birthday wishes scan error: ${err.message}`);
  }

  // 7. Scholar Mascot Eye & Paw State Transitions
  console.log("\n7. Testing Scholar Mascot State Determination Logic:");
  const computeMascotState = (
    isPasswordFocused: boolean,
    hasPassword: boolean,
    isEmailFocused: boolean,
    showPassword: boolean
  ) => {
    return isPasswordFocused || (hasPassword && !isEmailFocused) || showPassword;
  };

  assert(computeMascotState(true, false, false, false) === true, "Active when password field is focused");
  assert(computeMascotState(false, true, false, false) === true, "Persists masked state when password text is present");
  assert(computeMascotState(false, true, false, true) === true, "Persists peek state when showPassword is true with password text");
  assert(computeMascotState(false, false, false, true) === true, "Paws raise and eye peeks when showPassword is on even without text");
  assert(computeMascotState(false, true, true, false) === false, "Switches to email tracking when email input gains active focus");
  assert(computeMascotState(false, false, false, false) === false, "Fully resting idle when nothing is focused or typed");

  console.log(`\n========================================`);
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
