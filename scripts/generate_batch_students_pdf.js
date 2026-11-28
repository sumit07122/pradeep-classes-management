import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://gajibrwnccddnrbnhwmh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamlicnduY2NkZG5yYm5od21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUxNzQzMjUsImV4cCI6MjExMDc1MDMyNX0.bRIRMF6UZB6VbYaa9yZNO74-0RXMW_4vWnfLCotrrrw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log("Authenticating as admin to access student registry...");
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@pradeepclasses.in',
    password: 'Pradeep@2026',
  });
  if (authErr) {
    throw new Error(`Admin authentication failed: ${authErr.message}`);
  }
  console.log("✓ Authenticated as admin.");

  console.log("Fetching 81 enrolled students and batch allocations...");

  const { data: students, error } = await supabase
    .from('students')
    .select(`
      id,
      admission_no,
      full_name,
      class_name,
      batch_name,
      phone,
      parent_name,
      parent_phone,
      batches (
        name
      )
    `)
    .eq('institute_id', '11111111-2222-3333-4444-555555555555')
    .order('admission_no', { ascending: true });

  if (error || !students) {
    throw new Error(`Failed to fetch students: ${error?.message}`);
  }

  console.log(`Fetched ${students.length} students.`);

  // Group by Batch
  const batchMap = new Map();

  for (const s of students) {
    const bName = s.batches?.name || s.batch_name || 'General Foundation';
    if (!batchMap.has(bName)) {
      batchMap.set(bName, []);
    }
    batchMap.get(bName).push(s);
  }

  // Sort batches alphabetically
  const sortedBatchNames = Array.from(batchMap.keys()).sort();

  // Generate HTML
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Pradeep Classes — Student Login Credentials & Batch Roster</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 10mm 12mm 10mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background: #ffffff;
      font-size: 9.5pt;
      line-height: 1.35;
    }
    .header {
      border-bottom: 2px solid #102f50;
      padding-bottom: 8px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .brand-title {
      font-size: 18pt;
      font-weight: 800;
      color: #102f50;
      letter-spacing: -0.5px;
    }
    .brand-sub {
      font-size: 8.5pt;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .header-meta {
      text-align: right;
      font-size: 8pt;
      color: #475569;
    }
    .header-meta strong {
      color: #102f50;
    }
    .batch-section {
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    .batch-header {
      background: #f1f5f9;
      border-left: 4px solid #102f50;
      padding: 5px 8px;
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 0 4px 4px 0;
    }
    .batch-name {
      font-size: 10.5pt;
      font-weight: 700;
      color: #0f172a;
    }
    .batch-badge {
      background: #102f50;
      color: #ffffff;
      padding: 2px 7px;
      border-radius: 10px;
      font-size: 7.5pt;
      font-weight: 700;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
      font-size: 8pt;
    }
    th {
      background: #f8fafc;
      color: #334155;
      text-align: left;
      padding: 4px 6px;
      font-weight: 700;
      border-bottom: 1.5px solid #cbd5e1;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    td {
      padding: 4px 6px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: middle;
    }
    tr:nth-child(even) td {
      background: #fafafa;
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 700;
    }
    .reg-col {
      color: #102f50;
      font-size: 8pt;
    }
    .user-col {
      color: #047857;
      font-size: 8.5pt;
      background: #ecfdf5;
      padding: 2px 4px;
      border-radius: 3px;
      display: inline-block;
    }
    .pwd-col {
      color: #b45309;
      font-size: 7.5pt;
      background: #fffbeb;
      padding: 2px 4px;
      border-radius: 3px;
      display: inline-block;
    }
    .info-footer {
      margin-top: 15px;
      border: 1px dashed #94a3b8;
      border-radius: 6px;
      padding: 8px 12px;
      background: #f8fafc;
      font-size: 8pt;
      page-break-inside: avoid;
    }
    .info-footer h4 {
      color: #102f50;
      font-size: 9pt;
      margin-bottom: 4px;
    }
  </style>
</head>
<body>

  <div class="header">
    <div>
      <div class="brand-title">PRADEEP CLASSES</div>
      <div class="brand-sub">Official Student Login Credentials & Batch Allocation Directory</div>
    </div>
    <div class="header-meta">
      <div>Academic Session: <strong>2025–2026</strong></div>
      <div>Portal URL: <strong>https://app.pradeepclasses.in</strong></div>
      <div>Total Enrolled: <strong>${students.length} Students</strong></div>
      <div>Generated On: <strong>${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>
    </div>
  </div>
`;

  let grandIndex = 1;

  for (const bName of sortedBatchNames) {
    const bStudents = batchMap.get(bName);
    html += `
  <div class="batch-section">
    <div class="batch-header">
      <span class="batch-name">${bName}</span>
      <span class="batch-badge">${bStudents.length} Students</span>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width: 25px;">#</th>
          <th style="width: 85px;">Admission No</th>
          <th>Student Name</th>
          <th style="width: 60px;">Class</th>
          <th>Parent / Father Name</th>
          <th style="width: 90px;">Contact Phone</th>
          <th style="width: 100px;">Login Username</th>
          <th style="width: 100px;">Default Password</th>
        </tr>
      </thead>
      <tbody>
`;

    bStudents.forEach((s, idx) => {
      // Derive short registration code (e.g. PC001 or PC-2025-0001)
      const adm = s.admission_no || `PC-2025-${String(grandIndex).padStart(4, '0')}`;
      const shortCode = adm.startsWith('PC-2025-') ? `PC${parseInt(adm.split('-')[2], 10)}` : adm;
      const phone = s.phone || s.parent_phone || '—';
      const parent = s.parent_name || '—';
      const className = s.class_name || '—';

      html += `
        <tr>
          <td>${idx + 1}</td>
          <td class="mono reg-col">${adm}</td>
          <td><strong>${s.full_name}</strong></td>
          <td>${className}</td>
          <td>${parent}</td>
          <td>${phone}</td>
          <td><span class="mono user-col">${shortCode}</span></td>
          <td><span class="mono pwd-col">PRADEEPCLASSES</span></td>
        </tr>
`;
      grandIndex++;
    });

    html += `
      </tbody>
    </table>
  </div>
`;
  }

  html += `
  <div class="info-footer">
    <h4>Instructions for Students & Parents (Handover Guide):</h4>
    <p>1. <strong>Portal URL:</strong> Open <strong>https://app.pradeepclasses.in</strong> on any smartphone, tablet, or laptop browser.</p>
    <p>2. <strong>Login:</strong> Enter your <strong>Registration Number</strong> (e.g. <code>PC1</code>, <code>PC001</code>, or <code>PC-2025-0001</code>) and default password <strong>PRADEEPCLASSES</strong>.</p>
    <p>3. <strong>Passport Photo & Security:</strong> Once logged in, upload your student passport photo and securely update your password under <em>Settings & Profile</em>.</p>
    <p>4. <strong>Support:</strong> In case of any login issue, contact the Pradeep Classes Administration Desk at <strong>+91 8126180408</strong>.</p>
  </div>

</body>
</html>
`;

  // Write HTML to docs
  const htmlPath = path.resolve('docs', 'student_credentials_batch_roster.html');
  fs.writeFileSync(htmlPath, html, 'utf-8');
  console.log(`✓ HTML written to ${htmlPath}`);

  // Compile PDF via Chrome Headless
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const pdfOutPath = path.resolve('docs', 'student_credentials_batch_roster.pdf');
  const publicPdfPath = path.resolve('public', 'student_credentials_batch_roster.pdf');
  const brainPdfPath = 'C:\\Users\\hp\\.gemini\\antigravity\\brain\\b9088e07-38ea-4a26-81d8-f46a2a561a75\\student_credentials_batch_roster.pdf';

  console.log("Compiling PDF with Chrome Headless...");
  const cmd = `"${chromePath}" --headless --disable-gpu --print-to-pdf="${pdfOutPath}" --no-pdf-header-footer "${htmlPath}"`;
  execSync(cmd);
  console.log(`✓ PDF successfully generated at: ${pdfOutPath}`);

  // Copy to public for direct download from web app and to brain artifact directory
  fs.copyFileSync(pdfOutPath, publicPdfPath);
  try {
    fs.copyFileSync(pdfOutPath, brainPdfPath);
  } catch (e) {}

  console.log(`✓ Copied to ${publicPdfPath} and brain artifact folder.`);
}

main().catch(console.error);
