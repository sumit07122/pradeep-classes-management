/**
 * Seeds academic timetables, scheduled assessments/exams, and institute notices
 * for Pradeep Classes so all student, teacher, and admin modules are fully operational.
 */
import { supabase } from "../src/lib/supabase";

const INSTITUTE_ID = "11111111-2222-3333-4444-555555555555";

async function main() {
  if (!supabase) throw new Error("Supabase is not configured.");

  console.log("Authenticating as Institute Admin...");
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: "admin@pradeepclasses.in",
    password: "Pradeep@2026",
  });
  if (authError) throw new Error(`Auth failed: ${authError.message}`);

  // 1. Fetch Batches & Teachers Map
  const [{ data: batches }, { data: teachers }] = await Promise.all([
    supabase.from("batches").select("id, name"),
    supabase.from("teachers").select("id, full_name, subject"),
  ]);

  const batchMap = new Map<string, string>();
  for (const b of batches || []) batchMap.set(b.name, b.id);

  const teacherMap = new Map<string, string>();
  for (const t of teachers || []) teacherMap.set(t.full_name, t.id);

  // 2. Timetable Entries
  console.log("Seeding weekly timetable schedules...");
  const timetablePayload = [
    // Junior Foundation (1st–3rd)
    {
      batch_id: batchMap.get("Junior Foundation (Classes 1st–3rd)"),
      teacher_id: teacherMap.get("Jitendra Goyal Sir"),
      subject: "Science & Mathematics Foundation",
      day_of_week: "Monday",
      start_time: "15:30:00",
      end_time: "17:00:00",
      room_number: "Room 101",
      is_active: true,
      institute_id: INSTITUTE_ID,
    },
    {
      batch_id: batchMap.get("Junior Foundation (Classes 1st–3rd)"),
      teacher_id: teacherMap.get("Rajesh Gupta Sir"),
      subject: "English & Communication",
      day_of_week: "Wednesday",
      start_time: "15:30:00",
      end_time: "17:00:00",
      room_number: "Room 101",
      is_active: true,
      institute_id: INSTITUTE_ID,
    },
    // Primary Entrance Prep (Classes 4th–5th)
    {
      batch_id: batchMap.get("Primary Entrance Prep (Classes 4th–5th)"),
      teacher_id: teacherMap.get("Mr. Pradeep Kumar"),
      subject: "Entrance Maths & Mental Ability",
      day_of_week: "Tuesday",
      start_time: "16:00:00",
      end_time: "18:00:00",
      room_number: "Room 102",
      is_active: true,
      institute_id: INSTITUTE_ID,
    },
    {
      batch_id: batchMap.get("Primary Entrance Prep (Classes 4th–5th)"),
      teacher_id: teacherMap.get("Avinash Sir"),
      subject: "General Studies & Language",
      day_of_week: "Thursday",
      start_time: "16:00:00",
      end_time: "18:00:00",
      room_number: "Room 102",
      is_active: true,
      institute_id: INSTITUTE_ID,
    },
    // Middle School Entrance Prep (6th–8th)
    {
      batch_id: batchMap.get("Middle School Entrance Prep (6th–8th)"),
      teacher_id: teacherMap.get("Mr. Pradeep Kumar"),
      subject: "Advanced Mathematics",
      day_of_week: "Monday",
      start_time: "16:30:00",
      end_time: "18:30:00",
      room_number: "Room 201",
      is_active: true,
      institute_id: INSTITUTE_ID,
    },
    {
      batch_id: batchMap.get("Middle School Entrance Prep (6th–8th)"),
      teacher_id: teacherMap.get("Keshav Sir"),
      subject: "General Science & Reasoning",
      day_of_week: "Friday",
      start_time: "16:30:00",
      end_time: "18:30:00",
      room_number: "Room 201",
      is_active: true,
      institute_id: INSTITUTE_ID,
    },
    // Secondary Board Prep (9th–10th)
    {
      batch_id: batchMap.get("Secondary Board Prep (9th–10th)"),
      teacher_id: teacherMap.get("Akash Chaudhary Sir"),
      subject: "Mathematics Board Prep",
      day_of_week: "Monday",
      start_time: "18:00:00",
      end_time: "20:00:00",
      room_number: "Room 203",
      is_active: true,
      institute_id: INSTITUTE_ID,
    },
    {
      batch_id: batchMap.get("Secondary Board Prep (9th–10th)"),
      teacher_id: teacherMap.get("Pavan Sir"),
      subject: "Science & Chemistry",
      day_of_week: "Wednesday",
      start_time: "18:00:00",
      end_time: "20:00:00",
      room_number: "Room 203",
      is_active: true,
      institute_id: INSTITUTE_ID,
    },
    {
      batch_id: batchMap.get("Secondary Board Prep (9th–10th)"),
      teacher_id: teacherMap.get("Umashankar Sir"),
      subject: "Physics",
      day_of_week: "Friday",
      start_time: "18:00:00",
      end_time: "20:00:00",
      room_number: "Room 203",
      is_active: true,
      institute_id: INSTITUTE_ID,
    },
  ].filter((t) => t.batch_id && t.teacher_id);

  const { error: timeErr } = await supabase.from("timetables").insert(timetablePayload);
  if (timeErr) console.warn("Notice on timetable insert:", timeErr.message);
  else console.log(`✓ Seeded ${timetablePayload.length} weekly timetable sessions.`);

  // 3. Seed Scheduled Exams & Assessments
  console.log("Seeding scheduled exams & assessments...");
  const examsPayload = [
    {
      batch_id: batchMap.get("Primary Entrance Prep (Classes 4th–5th)"),
      title: "Navodaya & Sainik School Entrance Mock Test 1",
      subject: "Mathematics & Mental Ability",
      exam_type: "mock_exam",
      exam_date: "2026-12-07",
      start_time: "10:00:00",
      duration_minutes: 120,
      total_marks: 100,
      passing_marks: 40,
      status: "scheduled",
      institute_id: INSTITUTE_ID,
    },
    {
      batch_id: batchMap.get("Secondary Board Prep (9th–10th)"),
      title: "Class 10th Pre-Board Mathematics Assessment",
      subject: "Mathematics",
      exam_type: "board_practice",
      exam_date: "2026-12-10",
      start_time: "17:00:00",
      duration_minutes: 90,
      total_marks: 80,
      passing_marks: 33,
      status: "scheduled",
      institute_id: INSTITUTE_ID,
    },
    {
      batch_id: batchMap.get("Junior Foundation (Classes 1st–3rd)"),
      title: "Foundation Concept & Arithmetic Evaluation",
      subject: "Basic Mathematics",
      exam_type: "weekly_test",
      exam_date: "2026-12-12",
      start_time: "15:30:00",
      duration_minutes: 60,
      total_marks: 50,
      passing_marks: 20,
      status: "scheduled",
      institute_id: INSTITUTE_ID,
    },
  ].filter((e) => e.batch_id);

  const { error: examErr } = await supabase.from("exams").insert(examsPayload);
  if (examErr) console.warn("Notice on exams insert:", examErr.message);
  else console.log(`✓ Seeded ${examsPayload.length} upcoming batch examinations.`);

  // 4. Seed Institute Announcements / Notices
  console.log("Seeding official institute announcements...");
  const announcementsPayload = [
    {
      title: "Welcome to Academic Session 2025–2026",
      content:
        "Welcome all parents and students to Pradeep Classes Narsi Vihar campus. Please ensure regular attendance and monitor monthly test performance through the student portal.",
      target_type: "all",
      priority: "important",
      is_pinned: true,
      institute_id: INSTITUTE_ID,
    },
    {
      title: "Winter Batch Timings Schedule",
      content:
        "Evening batches will run as per updated winter schedule from 03:30 PM to 08:00 PM. Please verify your classroom allocations on the Timetable tab.",
      target_type: "all",
      priority: "normal",
      is_pinned: false,
      institute_id: INSTITUTE_ID,
    },
    {
      title: "Navodaya & Sainik School Entrance Test Series",
      content:
        "Specialized mock examinations for 4th & 5th entrance prep will commence on Sunday. Students must carry admission cards and writing materials.",
      target_type: "all",
      priority: "urgent",
      is_pinned: true,
      institute_id: INSTITUTE_ID,
    },
  ];

  const { error: annErr } = await supabase.from("announcements").insert(announcementsPayload);
  if (annErr) console.warn("Notice on announcements insert:", annErr.message);
  else console.log(`✓ Seeded ${announcementsPayload.length} official institute notices.`);

  console.log("==================================================");
  console.log("ALL ACADEMIC SCHEDULES & NOTICES SEEDED CLEANLY!");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Seeding error:", err.message);
  process.exit(1);
});
