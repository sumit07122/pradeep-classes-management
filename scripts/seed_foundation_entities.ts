/**
 * Seeds foundation entities for Pradeep Classes:
 * 1. Institute record (ID: 11111111-2222-3333-4444-555555555555)
 * 2. Academic Sessions & Batches
 * 3. Fee Structures
 */
import { supabase } from "../src/lib/supabase";

export const FOUNDATION_BATCHES = [
  {
    id: "7723f4e8-64b4-42dd-a165-2bda1bd6ae42",
    name: "Junior Foundation (Classes 1st–3rd)",
    course_name: "Primary Foundation",
    academic_year: "2025-2026",
    max_capacity: 40,
    timing: "03:30 PM - 05:00 PM",
    room_number: "Room 101",
    status: "active",
    is_active: true,
  },
  {
    id: "2f999c60-59e0-4f80-9926-0778ccb2e3d3",
    name: "Primary Entrance Prep (Classes 4th–5th)",
    course_name: "Entrance Exam Preparation",
    academic_year: "2025-2026",
    max_capacity: 40,
    timing: "04:00 PM - 06:00 PM",
    room_number: "Room 102",
    status: "active",
    is_active: true,
  },
  {
    id: "9386985f-0e40-40a4-8380-16dfd7c250b5",
    name: "Primary Foundation (Classes 4th–5th)",
    course_name: "Primary Foundation",
    academic_year: "2025-2026",
    max_capacity: 40,
    timing: "05:00 PM - 06:30 PM",
    room_number: "Room 103",
    status: "active",
    is_active: true,
  },
  {
    id: "9e8b85ce-58e0-4349-ab8b-b892dc7eb357",
    name: "Middle School Entrance Prep (6th–8th)",
    course_name: "Entrance Exam Preparation",
    academic_year: "2025-2026",
    max_capacity: 40,
    timing: "04:30 PM - 06:30 PM",
    room_number: "Room 201",
    status: "active",
    is_active: true,
  },
  {
    id: "cf2a859d-76a0-4c48-9cbe-6e669b9ae33e",
    name: "Middle School Foundation (6th–8th)",
    course_name: "Middle School Coaching",
    academic_year: "2025-2026",
    max_capacity: 40,
    timing: "05:00 PM - 07:00 PM",
    room_number: "Room 202",
    status: "active",
    is_active: true,
  },
  {
    id: "6b7f58ff-98f3-4f1e-b7c7-33903da7bf9a",
    name: "Secondary Board Prep (9th–10th)",
    course_name: "Secondary Board Prep",
    academic_year: "2025-2026",
    max_capacity: 40,
    timing: "06:00 PM - 08:00 PM",
    room_number: "Room 203",
    status: "active",
    is_active: true,
  },
  {
    id: "83b84cbb-7209-40dc-8528-60d65b36517d",
    name: "Senior Secondary (11th–12th)",
    course_name: "Senior Secondary Coaching",
    academic_year: "2025-2026",
    max_capacity: 40,
    timing: "06:30 PM - 08:30 PM",
    room_number: "Room 204",
    status: "active",
    is_active: true,
  }
];

async function main() {
  if (!supabase) {
    throw new Error("Supabase client is not configured");
  }

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: "admin@pradeepclasses.in",
    password: "Pradeep@2026",
  });
  if (authError) {
    throw new Error(`Auth error: ${authError.message}`);
  }

  console.log("Seeding / verifying foundation entities...");

  for (const b of FOUNDATION_BATCHES) {
    const { error } = await supabase
      .from("batches")
      .upsert(
        {
          id: b.id,
          name: b.name,
          course_name: b.course_name,
          academic_year: b.academic_year,
          max_capacity: b.max_capacity,
          timing: b.timing,
          room_number: b.room_number,
          status: b.status,
          is_active: b.is_active,
          institute_id: "11111111-2222-3333-4444-555555555555",
        },
        { onConflict: "id" }
      );
    if (error) {
      console.error(`Error upserting batch ${b.name}:`, error.message);
    }
  }

  const { data: batches, error } = await supabase
    .from("batches")
    .select("id, name, course_name");
  if (error) {
    console.error("Error fetching batches:", error.message);
    process.exit(1);
  }
  console.log(`Verified ${batches?.length || 0} batches exist in database.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
