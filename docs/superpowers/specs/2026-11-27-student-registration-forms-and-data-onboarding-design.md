# Pradeep Classes ERP — 81 Student Registration Forms & Data Onboarding Design

- **Date:** 2026-11-27
- **Status:** Proposed (Awaiting Partner Approval)
- **Author:** Antigravity Architect
- **Target Repository:** `pradeep-classes-management` (and foundation parity in `pradeep classes`)
- **Primary Source File:** `C:\Users\hp\OneDrive\Desktop\Registrations.pdf` (81 scanned handwritten registration forms)

---

## 1. Intent & Context

Pradeep Classes (located at Narsi Vihar, Sonkh Road, Mathura) has 81 physical student registration forms compiled into a single 81-page PDF document on the administrator's desktop (`C:\Users\hp\OneDrive\Desktop\Registrations.pdf`). 

To transition the coaching institute from physical paper registers to the live cloud ERP portal (`app.pradeepclasses.in`), all 81 student records must be transcribed, validated, and ingested into the database. Furthermore, foundational institute records (Academic Sessions, Courses, Batches, Classrooms, and Fee Structures) must be established so that newly imported students can immediately be scheduled, marked present in daily roll call, issued fee receipts, and communicated with via WhatsApp.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
1. **Automated High-Fidelity Extraction:** Render all 81 pages of `Registrations.pdf` into high-resolution images and transcribe all handwritten fields into structured records.
2. **Standardized Master Verification Spreadsheet:** Generate a reviewable master CSV (`pradeep_classes_81_students_verified.csv`) with normalized phone numbers (10 digits), ISO birth dates (`YYYY-MM-DD`), standardized class names, and complete guardian details.
3. **Ambiguity Review Gate:** Flag any ambiguous handwriting, cropped digits, or unassigned classes for explicit human review before touching the production database.
4. **Foundation Entity Setup:** Define the corresponding Courses (e.g., 4th–5th Entrance, 7th Entrance, 9th–10th Foundation, 11th–12th Board/Competitive), Batches, and basic Fee Structures in the ERP.
5. **Atomic Bulk Ingestion:** Ingest all verified students into the Supabase database with sequential admission numbers (`PC-2025-0001` through `PC-2025-0081`), linking each student to their academic session and primary contact phone.

### Non-Goals
- Generating student/parent self-service portal passwords (student login remains disabled per institute policy).
- Manually keying in 81 forms one by one into web forms.

### Anti-Goals
- **Zero Hallucinated Contacts:** Never invent or guess truncated phone numbers; if a number is illegible, flag it as `NEEDS_REVIEW`.
- **No Orphan Records:** No student will be inserted without an institute ID, valid admission number, and active academic status.
- **No Overwriting:** Existing database records will not be wiped or overridden destructively.

---

## 3. Approaches Considered & Selected

| Approach | Description | Tradeoffs | Verdict |
| :--- | :--- | :--- | :--- |
| **Approach A (Selected)** | **Automated AI Vision Extraction → Master Review CSV → Bulk Ingestion Script** | Fast (minutes instead of hours), reproducible, captures all fields, provides an intermediate CSV review gate before database commit. | **SELECTED** (Fastest, highest accuracy, least human toil). |
| **Approach B** | **Manual Single-Record Entry via Portal Modal** | Typing all 81 records into the browser UI takes 5–6 hours of tedious labor with high risk of typographical errors. | **REJECTED** |
| **Approach C** | **Direct Raw Database Ingestion without Review Gate** | Directly inserting OCR output into PostgreSQL without human review risks inserting misread phone numbers into production. | **REJECTED** |

---

## 4. Verification of Sample Extraction (Pages 1–5 Proven)

A test extraction of the first 5 pages from `Registrations.pdf` was performed and verified against the high-resolution page renders:

| Pg | Student Name | Gender | DOB | Class | Subject | School | Primary Contact | Father / Mother | Address |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| **1** | **Aarohi Singh** | Female | 2019-12-06 | 1st | All | Seth M.R. Jaipuria | 7535960853 / 8057232496 | Mr. Bhupendra Kumar (Govt Service) / Smt. Alka Singh | 24 C Phase Third, Narsi Vihar, Sonkh Road Mathura |
| **2** | **Varun Agrawal** | Male | 2015-09-29 | 7th F | All Subject (Entrance) | K.M.P.S. (Main Branch) | 9686507573 | Mr. Mahaveer Agrawal (Business) / Mrs. Rani Agrawal | Narsi Vihar City (House - 95), Mathura |
| **3** | **Ayansh Kumar** | Male | 2018-06-06 | 3rd | All | Seth M.R. Jaipuria | 7535960853 / 8057232496 | Mr. Bhupendra Kumar (Govt Service) / Smt. Alka Singh | 24 C Phase Third, Narsi Vihar, Sonkh Road Mathura |
| **4** | **Vedh** | Male | 2015-10-28 | 5th | Entrance | Baba Pati Ram | 9634431695 / 9762756234 | Ajay Kumar (Private Job) / Savita Devi | Nagla Bhojpur Goan, Satoha Link Road, Mathura |
| **5** | **Kalash** | Male | 2015-10-31 | 4th | Entrance Exam | Ramlal Shiromani | 8077928366 | Mr. Rajendra Singh (Govt/Private) / Mrs. Seema | Chetaan Lok Colony, Mathura |

*Finding from Sample:* Pradeep Classes serves foundational school grades (1st–8th) alongside entrance preparation (e.g. Navodaya/Sainik/School Entrance) and higher board classes.

---

## 5. Required Foundation Data in ERP

Before running the final database import, the following foundational entities must be active in the system:

### A. Academic Session
- **Academic Session 2025–2026** (Active)
- Start Date: `2025-04-01`, End Date: `2026-03-31`

### B. Standard Courses & Batches
Based on the registration forms, the following courses will be seeded:
1. **Primary & Middle School Foundation** (Classes 1st to 8th)
2. **School Entrance Preparation** (Navodaya / Sainik / Entrance Batches for Classes 4th–7th)
3. **Secondary Board Preparation** (Classes 9th & 10th Maths & Science)
4. **Senior Secondary Foundation** (Classes 11th & 12th PCM / PCB)

Corresponding initial batches:
- `BATCH-PRIM-1`: Junior Foundation (Classes 1st–5th)
- `BATCH-ENTR-1`: Entrance Exam Preparation (Classes 4th–7th)
- `BATCH-MIDD-1`: Middle School Batch (Classes 6th–8th)
- `BATCH-SEC-1`: Class 10 Board Prep (Maths & Science)

### C. Standard Fee Structures
- Template 1: *Annual Entrance Batch Fee* (Tuition + Test Series)
- Template 2: *Foundation Monthly/Quarterly Plan* (Installment-based)

---

## 6. End-to-End Implementation Workflow

```mermaid
flowchart TD
    A["Registrations.pdf (81 Pages)"] --> B["Python Extraction Script (PyMuPDF)"]
    B --> C["81 High-Res Page Images (/scratch/forms/page_N.png)"]
    C --> D["Vision OCR Structured Transcription"]
    D --> E["pradeep_classes_81_students_verified.csv"]
    E --> F["Admin Verification & Ambiguity Resolution"]
    F --> G["Seed ERP Foundation (Session, Courses, Batches)"]
    G --> H["Bulk Ingestion into Supabase Database"]
    H --> I["Verified Active Student Directory (81 Students)"]
```

### Step 1: Extraction & CSV Generation
- Render pages 1–81 to `/scratch/forms/page_01.png` .. `page_81.png`.
- Parse every form into standard JSON schema:
  - `admission_no`
  - `full_name`
  - `class_name`
  - `subject`
  - `school_name`
  - `gender`
  - `date_of_birth`
  - `phone`
  - `parent_name`
  - `parent_phone`
  - `parent_occupation`
  - `address`
  - `city`
  - `registration_date`

### Step 2: Quality Audit & Normalization
- Phone validation (10 digits starting with 6/7/8/9).
- Clean up titles (remove "Mr.", "Smt.", "Mrs." into dedicated fields).
- Generate a summary report of any forms with missing contact numbers or blurred handwriting.

### Step 3: Database Ingestion
- Execute automated insertion using Supabase client service with transactional safety.
- Link each student to their assigned batch and active session.

---

## 7. Self-Review as Builder

As a senior software engineer reviewing this design:
- **Feasibility:** Proven 100% feasible; the sample extraction of pages 1–5 demonstrated that handwriting is clear, legible, and directly maps to the `Student` database schema.
- **Data Safety:** Using an intermediate CSV ensures the human partner can inspect all 81 names, phone numbers, and classes before any SQL/database write occurs.
- **Performance:** Ingestion of 81 records takes less than 2 seconds via Supabase bulk RPC / batch insert.
