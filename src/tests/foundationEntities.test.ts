// src/tests/foundationEntities.test.ts
import { supabase } from "../lib/supabase";
import { batchesService } from "../services/batchesService";

async function verifyFoundation() {
  if (supabase) {
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: "admin@pradeepclasses.in",
      password: "Pradeep@2026",
    });
    if (authError) {
      throw new Error(`Admin authentication failed: ${authError.message}`);
    }
  }

  const batchesRes = await batchesService.getBatches();
  if (batchesRes.error) {
    throw new Error(`batchesService error: ${batchesRes.error}`);
  }
  const batches = batchesRes.data || [];
  console.assert(batches.length >= 4, `Expected at least 4 foundational batches, got ${batches.length}`);
  
  const requiredBatches = [
    "Junior Foundation (Classes 1st–3rd)",
    "Primary Entrance Prep (Classes 4th–5th)",
    "Middle School Entrance Prep (6th–8th)",
    "Secondary Board Prep (9th–10th)",
  ];

  const batchNames = batches.map(b => b.name);
  for (const req of requiredBatches) {
    if (!batchNames.includes(req)) {
      throw new Error(`Missing required foundation batch: ${req}`);
    }
  }

  console.log(`Foundation verification passed: ${batches.length} active batches ready.`);
}

verifyFoundation().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
