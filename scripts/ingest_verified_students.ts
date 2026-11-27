/**
 * Bulk ingestion pipeline for Pradeep Classes:
 * Ingests 81 verified student registrations from CSV into Supabase `students` table.
 */
import fs from "fs";
import path from "path";
import { supabase } from "../src/lib/supabase";

const INSTITUTE_ID = "11111111-2222-3333-4444-555555555555";

function parseCsv(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  function splitLine(line: string): string[] {
    const fields: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === "," && !inQuotes) {
        fields.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
    fields.push(cur);
    return fields.map((f) => f.trim());
  }

  const headers = splitLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });
    rows.push(row);
  }

  return rows;
}

async function main() {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  // 1. Authenticate as Institute Admin/Owner
  console.log("Authenticating as Institute Admin...");
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: "admin@pradeepclasses.in",
    password: "Pradeep@2026",
  });
  if (authError) {
    throw new Error(`Authentication failed: ${authError.message}`);
  }

  // 2. Fetch Batches Map
  console.log("Fetching batches for assignment...");
  const { data: batches, error: batchError } = await supabase
    .from("batches")
    .select("id, name");
  if (batchError || !batches) {
    throw new Error(`Failed to load batches: ${batchError?.message}`);
  }

  const batchMap = new Map<string, string>();
  for (const b of batches) {
    batchMap.set(b.name, b.id);
  }
  console.log(`Loaded ${batches.length} batches:`, Array.from(batchMap.keys()));

  // 3. Read and Parse Verified CSV
  const csvPath = path.resolve(process.cwd(), "pradeep_classes_81_students_verified.csv");
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Verified CSV missing at ${csvPath}`);
  }

  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const records = parseCsv(csvContent);

  console.log(`Parsed ${records.length} student records from CSV.`);

  // 4. Map records for insertion
  const studentPayloads = records.map((r: any) => {
    const batchId = batchMap.get(r.assigned_batch);
    if (!batchId) {
      console.warn(`Warning: Batch "${r.assigned_batch}" not found for student ${r.full_name}`);
    }

    return {
      admission_no: r.admission_no,
      full_name: r.full_name,
      class_name: r.class_name,
      batch_name: r.assigned_batch,
      batch_id: batchId || null,
      phone: r.phone || null,
      parent_name: r.parent_name || null,
      parent_phone: r.parent_phone || null,
      parent_relation: "Parent",
      status: "active",
      joined_on: r.registration_date || "2024-10-01",
      institute_id: INSTITUTE_ID,
      date_of_birth: r.date_of_birth || null,
      gender: r.gender ? r.gender.toLowerCase() : "male",
      address: r.address || null,
      city: r.city || "Mathura",
      notes: `School: ${r.school_name || "N/A"} | Parent Occ: ${r.parent_occupation || "N/A"}`,
    };
  });

  // 5. Upsert students into Supabase
  console.log(`Ingesting ${studentPayloads.length} students into Supabase...`);
  
  // Upsert in batches of 25 for safe transmission
  const chunkSize = 25;
  for (let i = 0; i < studentPayloads.length; i += chunkSize) {
    const chunk = studentPayloads.slice(i, i + chunkSize);
    const { error: insertError } = await supabase
      .from("students")
      .upsert(chunk, { onConflict: "admission_no" });

    if (insertError) {
      throw new Error(`Bulk upsert failed on chunk ${i}: ${insertError.message}`);
    }
    console.log(`✓ Inserted records ${i + 1} to ${Math.min(i + chunkSize, studentPayloads.length)}`);
  }

  // 6. Verify total in database
  const { count, error: countErr } = await supabase
    .from("students")
    .select("*", { count: "exact", head: true });
  
  if (countErr) {
    throw new Error(`Error verifying student count: ${countErr.message}`);
  }

  console.log(`========================================`);
  console.log(`SUCCESS: Total students in database: ${count}`);
  console.log(`All 81 student registration forms ingested!`);
  console.log(`========================================`);
}

main().catch((err) => {
  console.error("Ingestion failed:", err.message);
  process.exit(1);
});
