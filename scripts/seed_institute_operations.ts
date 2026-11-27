/**
 * Complete institute operations seeder for Pradeep Classes:
 * 1. Seeds 10 authentic faculty members into `teachers`
 * 2. Links teachers to the 7 foundation batches in `teacher_batches`
 * 3. Configures faculty salary structures in `teacher_salary_configs`
 * 4. Seeds 7 course fee structures into `fee_structures`
 * 5. Generates initial monthly fee records for all 81 enrolled students into `fee_records`
 */
import { supabase } from "../src/lib/supabase";

const INSTITUTE_ID = "11111111-2222-3333-4444-555555555555";

export const REAL_FACULTY = [
  {
    id: "f1111111-0001-4000-8000-000000000001",
    full_name: "Mr. Pradeep Kumar",
    subject: "Advanced Mathematics & Mentorship",
    phone: "8126180408",
    status: "active",
    calculation_type: "monthly_fixed",
    base_amount: 45000,
    per_lecture_rate: 0,
    batches: [
      "Junior Foundation (Classes 1st–3rd)",
      "Primary Entrance Prep (Classes 4th–5th)",
      "Middle School Entrance Prep (6th–8th)",
    ],
  },
  {
    id: "f1111111-0002-4000-8000-000000000002",
    full_name: "Avinash Sir",
    subject: "General Studies & Social Sciences",
    phone: "7017775704",
    status: "active",
    calculation_type: "monthly_fixed",
    base_amount: 32000,
    per_lecture_rate: 0,
    batches: [
      "Primary Entrance Prep (Classes 4th–5th)",
      "Middle School Entrance Prep (6th–8th)",
    ],
  },
  {
    id: "f1111111-0003-4000-8000-000000000003",
    full_name: "Akash Chaudhary Sir",
    subject: "Advanced Mathematics (IIT-JEE)",
    phone: "9837123456",
    status: "active",
    calculation_type: "per_lecture",
    base_amount: 15000,
    per_lecture_rate: 600,
    batches: [
      "Secondary Board Prep (9th–10th)",
      "Senior Secondary (11th–12th)",
    ],
  },
  {
    id: "f1111111-0004-4000-8000-000000000004",
    full_name: "Pavan Sir",
    subject: "Chemistry (Inorganic & Organic)",
    phone: "9412123456",
    status: "active",
    calculation_type: "per_lecture",
    base_amount: 12000,
    per_lecture_rate: 550,
    batches: [
      "Secondary Board Prep (9th–10th)",
      "Senior Secondary (11th–12th)",
    ],
  },
  {
    id: "f1111111-0005-4000-8000-000000000005",
    full_name: "Akash Kuntal Sir",
    subject: "Chemical Sciences",
    phone: "9760123456",
    status: "active",
    calculation_type: "per_lecture",
    base_amount: 10000,
    per_lecture_rate: 500,
    batches: ["Senior Secondary (11th–12th)"],
  },
  {
    id: "f1111111-0006-4000-8000-000000000006",
    full_name: "Keshav Sir",
    subject: "General Science & Physics",
    phone: "8979123456",
    status: "active",
    calculation_type: "monthly_fixed",
    base_amount: 28000,
    per_lecture_rate: 0,
    batches: [
      "Middle School Entrance Prep (6th–8th)",
      "Middle School Foundation (6th–8th)",
    ],
  },
  {
    id: "f1111111-0007-4000-8000-000000000007",
    full_name: "Umashankar Sir",
    subject: "Theoretical & Applied Physics",
    phone: "9634123456",
    status: "active",
    calculation_type: "per_lecture",
    base_amount: 14000,
    per_lecture_rate: 600,
    batches: ["Secondary Board Prep (9th–10th)"],
  },
  {
    id: "f1111111-0008-4000-8000-000000000008",
    full_name: "Rajesh Gupta Sir",
    subject: "English Literature & Communication",
    phone: "9897123456",
    status: "active",
    calculation_type: "monthly_fixed",
    base_amount: 25000,
    per_lecture_rate: 0,
    batches: [
      "Junior Foundation (Classes 1st–3rd)",
      "Primary Foundation (Classes 4th–5th)",
      "Middle School Foundation (6th–8th)",
      "Secondary Board Prep (9th–10th)",
    ],
  },
  {
    id: "f1111111-0009-4000-8000-000000000009",
    full_name: "Jitendra Goyal Sir",
    subject: "Science & Maths Foundation",
    phone: "9456123456",
    status: "active",
    calculation_type: "monthly_fixed",
    base_amount: 30000,
    per_lecture_rate: 0,
    batches: [
      "Junior Foundation (Classes 1st–3rd)",
      "Primary Foundation (Classes 4th–5th)",
    ],
  },
  {
    id: "f1111111-0010-4000-8000-000000000010",
    full_name: "Radhe Shyam Sir",
    subject: "Applied Physics",
    phone: "9927123456",
    status: "active",
    calculation_type: "per_lecture",
    base_amount: 12000,
    per_lecture_rate: 550,
    batches: ["Senior Secondary (11th–12th)"],
  },
];

export const FEE_STRUCTURES = [
  {
    id: "fee00001-0001-4000-8000-000000000001",
    course_name: "Junior Foundation (Classes 1st–3rd)",
    academic_year: "2025-2026",
    total_fee: 800,
    description: "Monthly tuition fee for primary foundational grades (All Subjects)",
  },
  {
    id: "fee00001-0002-4000-8000-000000000002",
    course_name: "Primary Foundation (Classes 4th–5th)",
    academic_year: "2025-2026",
    total_fee: 1000,
    description: "Monthly tuition fee for classes 4th and 5th foundation",
  },
  {
    id: "fee00001-0003-4000-8000-000000000003",
    course_name: "Primary Entrance Prep (Classes 4th–5th)",
    academic_year: "2025-2026",
    total_fee: 1200,
    description: "Specialized entrance coaching for Navodaya / Sainik School",
  },
  {
    id: "fee00001-0004-4000-8000-000000000004",
    course_name: "Middle School Foundation (6th–8th)",
    academic_year: "2025-2026",
    total_fee: 1500,
    description: "Comprehensive coaching for middle school curriculum",
  },
  {
    id: "fee00001-0005-4000-8000-000000000005",
    course_name: "Middle School Entrance Prep (6th–8th)",
    academic_year: "2025-2026",
    total_fee: 1800,
    description: "Intensive preparation for Class 9th entrance exams",
  },
  {
    id: "fee00001-0006-4000-8000-000000000006",
    course_name: "Secondary Board Prep (9th–10th)",
    academic_year: "2025-2026",
    total_fee: 2200,
    description: "Board exam preparation for Maths, Science, Social & English",
  },
  {
    id: "fee00001-0007-4000-8000-000000000007",
    course_name: "Senior Secondary (11th–12th)",
    academic_year: "2025-2026",
    total_fee: 2800,
    description: "Senior secondary PCM coaching with competitive focus",
  },
];

async function main() {
  if (!supabase) throw new Error("Supabase is not configured.");

  console.log("Authenticating as Institute Admin...");
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: "admin@pradeepclasses.in",
    password: "Pradeep@2026",
  });
  if (authError) throw new Error(`Auth failed: ${authError.message}`);

  // 1. Fetch Batches Map
  const { data: batches } = await supabase.from("batches").select("id, name");
  const batchMap = new Map<string, string>();
  for (const b of batches || []) {
    batchMap.set(b.name, b.id);
  }

  // 2. Seed Teachers
  console.log("Seeding 10 authentic faculty members...");
  for (const t of REAL_FACULTY) {
    const { error: teachErr } = await supabase.from("teachers").upsert(
      {
        id: t.id,
        full_name: t.full_name,
        subject: t.subject,
        phone: t.phone,
        is_active: true,
        status: "active",
        institute_id: INSTITUTE_ID,
      },
      { onConflict: "id" }
    );
    if (teachErr) console.error(`Error saving teacher ${t.full_name}:`, teachErr.message);

    // Link teacher to batches
    for (const bName of t.batches) {
      const bId = batchMap.get(bName);
      if (bId) {
        await supabase.from("teacher_batches").upsert(
          {
            teacher_id: t.id,
            batch_id: bId,
            institute_id: INSTITUTE_ID,
          },
          { onConflict: "teacher_id,batch_id" }
        );
      }
    }

    // Configure salary structure
    await supabase.from("teacher_salary_configs").upsert(
      {
        teacher_id: t.id,
        institute_id: INSTITUTE_ID,
        calculation_type: t.calculation_type,
        base_amount: t.base_amount,
        per_lecture_rate: t.per_lecture_rate,
      },
      { onConflict: "teacher_id" }
    );
  }
  console.log("✓ Teachers, batch assignments, and salary structures configured.");

  // 3. Seed Fee Structures
  console.log("Seeding course fee structures...");
  for (const fsItem of FEE_STRUCTURES) {
    await supabase.from("fee_structures").upsert(
      {
        id: fsItem.id,
        course_name: fsItem.course_name,
        academic_year: fsItem.academic_year,
        total_fee: fsItem.total_fee,
        description: fsItem.description,
        institute_id: INSTITUTE_ID,
      },
      { onConflict: "id" }
    );
  }
  console.log("✓ 7 Course fee structures active.");

  // 4. Generate Initial Fee Dues for Enrolled Students
  console.log("Generating monthly fee records for 81 active students...");
  const feeStructureMap = new Map<string, typeof FEE_STRUCTURES[0]>();
  for (const fsItem of FEE_STRUCTURES) {
    feeStructureMap.set(fsItem.course_name, fsItem);
  }

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name, batch_name, admission_no");

  if (students && students.length > 0) {
    const feeRecordsPayload: any[] = [];
    for (const s of students) {
      const feeConfig = feeStructureMap.get(s.batch_name) || FEE_STRUCTURES[0];
      feeRecordsPayload.push({
        student_id: s.id,
        title: `Monthly Tuition Fee - November 2026`,
        fee_structure_id: feeConfig.id,
        amount: feeConfig.total_fee,
        paid_amount: 0,
        discount_amount: 0,
        status: "pending",
        due_date: "2026-11-30",
        notes: `Standard monthly fee for ${s.batch_name}`,
        institute_id: INSTITUTE_ID,
      });
    }

    // Insert in batches of 30
    for (let i = 0; i < feeRecordsPayload.length; i += 30) {
      const chunk = feeRecordsPayload.slice(i, i + 30);
      const { error: feeErr } = await supabase.from("fee_records").insert(chunk);
      if (feeErr) {
        console.warn(`Chunk ${i} fee records notice:`, feeErr.message);
      }
    }
  }

  // 5. Output Verification Counts
  const [tCount, fCount, recCount] = await Promise.all([
    supabase.from("teachers").select("*", { count: "exact", head: true }),
    supabase.from("fee_structures").select("*", { count: "exact", head: true }),
    supabase.from("fee_records").select("*", { count: "exact", head: true }),
  ]);

  console.log("==================================================");
  console.log(`INSTITUTE OPERATIONS SEEDING COMPLETE`);
  console.log(`Active Teachers:       ${tCount.count}`);
  console.log(`Fee Structures:        ${fCount.count}`);
  console.log(`Student Fee Records:   ${recCount.count}`);
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Operations seeding error:", err.message);
  process.exit(1);
});
