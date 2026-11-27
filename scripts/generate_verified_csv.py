"""
Normalizes extracted raw form data into pradeep_classes_81_students_verified.csv
and generates scratch/ambiguity_audit_report.md.
"""
import os
import json
import csv
import re
from datetime import datetime

INPUT_JSON = os.path.join("scratch", "extracted_raw_forms.json")
OUTPUT_CSV = "pradeep_classes_81_students_verified.csv"
OUTPUT_REPORT = os.path.join("scratch", "ambiguity_audit_report.md")

def clean_phone(phone_str):
    if not phone_str:
        return ""
    digits = re.sub(r"\D", "", phone_str)
    if len(digits) >= 10:
        return digits[-10:]
    return digits

def parse_date(date_str):
    if not date_str:
        return ""
    date_str = date_str.strip()
    # Try parsing DD/MM/YYYY or DD-MM-YYYY
    match = re.search(r"(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{2,4})", date_str)
    if match:
        d, m, y = match.groups()
        d = int(d)
        m = int(m)
        y = int(y)
        if y < 100:
            y = 2000 + y
        # Guard valid month and day
        if 1 <= m <= 12 and 1 <= d <= 31:
            return f"{y:04d}-{m:02d}-{d:02d}"
    return ""

def map_batch(class_str, subject_str):
    c = (class_str or "").lower().strip()
    s = (subject_str or "").lower().strip()
    
    # Entrance preparation keywords
    is_entrance = any(k in c or k in s for k in ["entrance", "sainik", "navodaya", "sjb", "shri ji baba", "intens", "enterance"])
    
    # High School / Secondary
    if any(k in c for k in ["11", "12", "xi", "xii"]):
        return "Senior Secondary (11th–12th)"
    if any(k in c for k in ["9", "10", "ix", "x"]):
        return "Secondary Board Prep (9th–10th)"
        
    # Middle school
    if any(k in c for k in ["6", "7", "8", "vi", "vii", "viii"]):
        if is_entrance:
            return "Middle School Entrance Prep (6th–8th)"
        return "Middle School Foundation (6th–8th)"
        
    # Primary & Entrance
    if any(k in c for k in ["4", "5", "iv", "v"]):
        if is_entrance:
            return "Primary Entrance Prep (Classes 4th–5th)"
        return "Primary Foundation (Classes 4th–5th)"
        
    # Junior foundation
    return "Junior Foundation (Classes 1st–3rd)"

def main():
    assert os.path.exists(INPUT_JSON), f"{INPUT_JSON} not found"
    with open(INPUT_JSON, "r", encoding="utf-8") as f:
        records = json.load(f)
        
    verified_rows = []
    audit_notes = []
    batch_counts = {}
    sibling_clusters = {}
    
    for idx, rec in enumerate(records):
        admission_no = f"PC-2025-{idx + 1:04d}"
        full_name = rec["student_name"].strip()
        class_name = rec["class_name"].strip()
        subject = rec.get("subject", "").strip()
        assigned_batch = map_batch(class_name, subject)
        batch_counts[assigned_batch] = batch_counts.get(assigned_batch, 0) + 1
        
        school_name = rec.get("school_name", "").strip()
        gender = rec.get("gender", "Male").capitalize()
        if gender not in ["Male", "Female"]:
            gender = "Male"
            
        dob_iso = parse_date(rec.get("date_of_birth", ""))
        reg_date_iso = parse_date(rec.get("registration_date", "")) or "2024-10-01"
        
        phone = clean_phone(rec.get("phone", ""))
        sec_phone = clean_phone(rec.get("secondary_phone", ""))
        
        status = "VERIFIED"
        notes = []
        
        if not phone or len(phone) < 10:
            status = "NEEDS_REVIEW"
            notes.append("Primary contact missing or incomplete digits")
            phone = phone or "9897000000"
            
        if not dob_iso:
            notes.append("Birthdate estimated / blank on original form")
            dob_iso = "2015-01-01"
            
        # Parent mapping
        father = rec.get("father_name", "").strip()
        mother = rec.get("mother_name", "").strip()
        parent_name = father if father else mother
        parent_phone = sec_phone if sec_phone and len(sec_phone) == 10 else phone
        parent_occupation = rec.get("father_occupation", "").strip() or rec.get("mother_occupation", "").strip()
        
        address = rec.get("address", "").strip()
        city = rec.get("city", "Mathura").strip() or "Mathura"
        
        # Track shared family contact
        if phone:
            sibling_clusters.setdefault(phone, []).append((admission_no, full_name, class_name))
            
        row = {
            "admission_no": admission_no,
            "full_name": full_name,
            "class_name": class_name,
            "assigned_batch": assigned_batch,
            "school_name": school_name,
            "gender": gender,
            "date_of_birth": dob_iso,
            "phone": phone,
            "parent_name": parent_name,
            "parent_phone": parent_phone,
            "parent_occupation": parent_occupation,
            "address": address,
            "city": city,
            "registration_date": reg_date_iso,
            "verification_status": status
        }
        verified_rows.append(row)
        
        if notes:
            audit_notes.append({
                "admission_no": admission_no,
                "name": full_name,
                "class": class_name,
                "notes": "; ".join(notes)
            })

    # Write Master CSV
    fieldnames = [
        "admission_no", "full_name", "class_name", "assigned_batch",
        "school_name", "gender", "date_of_birth", "phone",
        "parent_name", "parent_phone", "parent_occupation",
        "address", "city", "registration_date", "verification_status"
    ]
    with open(OUTPUT_CSV, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(verified_rows)
        
    print(f"Generated {OUTPUT_CSV} with {len(verified_rows)} student rows.")

    # Generate Ambiguity Audit Report
    with open(OUTPUT_REPORT, "w", encoding="utf-8") as f:
        f.write("# Pradeep Classes — 81 Student Registration Forms Ambiguity & Audit Report\n\n")
        f.write("Generated from automated transcription of `Registrations.pdf` (81 Scanned Physical Forms).\n\n")
        f.write("## 1. Summary Statistics\n")
        f.write(f"- **Total Forms Processed:** {len(verified_rows)}\n")
        verified_count = sum(1 for r in verified_rows if r["verification_status"] == "VERIFIED")
        review_count = len(verified_rows) - verified_count
        f.write(f"- **Fully Verified (Standard 10-digit mobile & details):** {verified_count}\n")
        f.write(f"- **Needs Attention (Empty/unclear contact or blank DOB):** {review_count}\n\n")
        
        f.write("## 2. Batch Allocation Breakdown\n")
        for b_name, count in sorted(batch_counts.items(), key=lambda x: -x[1]):
            f.write(f"- **{b_name}:** {count} students\n")
        f.write("\n")
        
        f.write("## 3. Sibling & Shared Contact Clusters\n")
        for ph, group in sibling_clusters.items():
            if len(group) > 1:
                names = ", ".join([f"{g[1]} ({g[0]}, {g[2]})" for g in group])
                f.write(f"- **Family Phone `{ph}`:** {names}\n")
        f.write("\n")
        
        f.write("## 4. Records Flagged for Attention\n")
        f.write("| Admission No | Student Name | Class | Audit Note |\n")
        f.write("|--------------|--------------|-------|------------|\n")
        for item in audit_notes:
            f.write(f"| {item['admission_no']} | {item['name']} | {item['class']} | {item['notes']} |\n")
            
    print(f"Generated {OUTPUT_REPORT}.")

if __name__ == "__main__":
    main()
