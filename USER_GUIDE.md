# Pradeep Classes Management Platform — Staff & Student User Guide

**Institute:** Pradeep Classes, Kota Coaching Campus  
**Portal Access:** `https://app.pradeepclasses.in`  
**Application Type:** Progressive Web Application (PWA) with Offline-First Assets  

---

## 1. Quick Navigation by Role

- **Institute Owner / Managing Director:** [Section 2 — Executive & Administrative Workflows](#2-executive--administrative-workflows)
- **Academic Coordinator / Admin:** [Section 3 — Academic Operations & Admissions](#3-academic-operations--admissions)
- **Faculty Members / Teachers:** [Section 4 — Classroom Faculty Daily Routine](#4-classroom-faculty-daily-routine)
- **Enrolled Students:** [Section 5 — Student Academic Portal](#5-student-academic-portal)

---

## 2. Executive & Administrative Workflows (Owner & Admin)

### 2.1. Managing the Executive Dashboard
Upon login, the Overview screen presents real-time KPI metrics for Pradeep Classes:
- **Active Students:** Total actively enrolled students.
- **Faculty Members:** Currently active teachers.
- **Active Batches:** Classroom sections currently conducting sessions.
- **Fee Collections:** Real-time month-to-date fees collected vs. pending balances.
- **Today's Attendance Snapshot:** Real-time ratio of present, absent, and late students across all sections.
- **Attendance Defaulters:** Highlights candidates whose attendance has dropped below 75%.

### 2.2. Student Admissions & Batch Transfers
1. Click **Students** in the sidebar.
2. Click **Add Student** to open the registration form:
   - Enter student's full name, mobile number, and select the enrolled batch.
   - Enter guardian details (Parent Name, Mobile, Relationship) for emergency and billing records.
3. The system automatically assigns a sequential admission number formatted as `PC-YYYY-XXXX` (e.g., `PC-2026-0001`).
4. To transfer a student to another batch:
   - Select the student row and click **Transfer Batch**.
   - Select the target batch and enter a transfer justification.
   - If the target batch is at full capacity (`current_capacity = max_capacity`), the system blocks the transfer and displays an alert.
   - All transfers are logged to the immutable batch history audit table.

### 2.3. Fee Management, Collections & Reversals
1. Navigate to **Fee Records**.
2. **Issue Invoices:**
   - Click **Issue Invoice**.
   - Select the student, fee title (e.g., *Term 1 Tuition*), total amount, and due date.
   - A sequential invoice reference is created.
3. **Collect Payment:**
   - In the fee table, locate a pending or partial invoice and click **Collect**.
   - Enter the payment amount, mode (*UPI, Cash, NetBanking, Cheque, Card*), and optional transaction reference.
   - Upon confirmation, an atomic database lock records the transaction, prints an official `REC-YYYY-XXXX` receipt, and updates the balance due.
4. **Reversing an Erroneous Payment:**
   - Click the Rupee icon next to any invoice to view transaction history.
   - Click **Reverse** next to the specific payment installment.
   - Enter the mandatory reversal reason (e.g., *Duplicate bank swipe*).
   - The ledger appends an immutable reversal audit record and reopens the balance.

### 2.4. Institute Profile & WhatsApp Settings
1. Click **Settings** in the sidebar.
2. In the **Institute Profile** tab, configure the campus address, official contact numbers, pass percentage, and academic year.
3. In the **WhatsApp Cloud API Integration** tab, configure your Meta WABA ID, Phone Number ID, and System User Access Token.
4. Toggle **Test Mode** on to verify notification queue dispatches safely before going live.

---

## 3. Academic Operations & Admissions (Admin)

### 3.1. Batch Management
1. Click **Batches** in the sidebar.
2. Click **Create Batch** to add a new section.
3. Specify batch name (e.g., *NEET Medical Morning*), course name, academic year, and maximum seat capacity.
4. Monitor seat capacity bars to avoid overcrowding classrooms.

### 3.2. Timetable Scheduling
1. Click **Timetable** in the sidebar.
2. Select a batch to view its weekly schedule across Monday to Sunday.
3. Click **Add Class Slot** to assign:
   - Batch, Subject/Topic, Day of the Week, Start Time, End Time, Faculty, and Classroom.
4. **Automatic Conflict Protection:** If the chosen teacher or classroom is already booked for another batch at an overlapping time, the system rejects the entry with an on-screen collision warning.

### 3.3. Institute Broadcasts
1. Navigate to **Announcements**.
2. Click **New Announcement**.
3. Choose the target audience: *Everyone, Students Only, Faculty Only, or a Specific Batch*.
4. Choose the priority level (*Normal, High, Urgent*).
5. Published announcements instantly appear on student and teacher dashboards.

---

## 4. Classroom Faculty Daily Routine (Teacher)

### 4.1. Taking Daily Batch Attendance
1. Click **Attendance** in the sidebar.
2. Select your batch and today's date.
3. The student roll call list loads automatically.
4. Mark each student as **Present**, **Absent**, **Late**, or **Leave**.
5. Optionally add a note (e.g., *Late due to rain*).
6. Click **Submit Batch Attendance**:
   - The session is saved to the database.
   - WhatsApp messages are automatically enqueued to students.
   - You can edit attendance within **48 hours**; after 48 hours, changes require admin assistance.

### 4.2. Creating Exams & Entering Marks
1. Navigate to **Exams & Marks**.
2. Click **Create Exam**:
   - Specify exam title (e.g., *Physics Thermodynamics Unit Test*), subject, batch, exam date, total marks, and passing marks threshold.
3. Click **Enter Marks** on the exam card:
   - Enter the marks scored by each student (or tick Absent).
   - The system instantly displays the automated grade (*A+, A, B, C, D, or F*) and percentage.
   - Click **Save Marks & Compute Grades**.
4. Click the **Publish (Share)** icon when ready:
   - Results become visible on student scorecards.
   - Class ranks (*#1, #2, etc.*) are dense-calculated and shown on the scorecard.

### 4.3. Distributing Homework & Study Notes
1. Navigate to **Study Materials**.
2. **Uploading Notes:**
   - In the *Study Materials & Notes* tab, click **Upload Notes**.
   - Enter title, subject, category (*Chapter Notes, Formula Sheet, PYQ, Practice Paper*), and document URL.
3. **Assigning Homework:**
   - In the *Homework & Assignments* tab, click **Assign Homework**.
   - Enter title, batch, submission due date, max score, and detailed problem instructions.

---

## 5. Student Academic Portal (Student)

When a student logs in, they are directed straight to their personalized **Student Academic Portal** (`/portal`):

### 5.1. Attendance Tab
- Displays the student's overall attendance compliance percentage ring.
- If attendance falls below 75%, an alert badge warns that remedial action is required.
- Chronological session table lists every past lecture date, status, and teacher notes.

### 5.2. Exams & Report Cards Tab
- Lists all published examinations.
- Displays marks scored, maximum marks, percentage, letter grade (*A+, A, B, C, D, F*), and batch rank.

### 5.3. Fee Ledger & Receipts Tab
- Shows total billed tuition fees, settled amounts, and outstanding balances.
- For every payment made, click **Receipt** to open and print an official Pradeep Classes payment receipt.

### 5.4. Study Materials Tab
- Access and download PDFs, chapter notes, and formula sheets published by teachers for the student's batch.

### 5.5. Timetable Tab
- Shows the student's personalized weekly class schedule with start/end times, faculty names, and classroom numbers.
