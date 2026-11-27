# scripts/test_csv_integrity.py
import csv, os

def test_csv_structure():
    csv_path = "pradeep_classes_81_students_verified.csv"
    assert os.path.exists(csv_path), "Master CSV file missing"
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = list(csv.DictReader(f))
    assert len(reader) == 81, f"Expected 81 rows, got {len(reader)}"
    for row in reader:
        assert row["admission_no"].startswith("PC-2025-"), f"Invalid admission no: {row['admission_no']}"
        assert row["full_name"], "Student full name is empty"
        assert row["phone"], "Primary phone is empty"
    print("CSV integrity test passed: 81 verified student rows ready for ingestion.")

if __name__ == "__main__":
    test_csv_structure()
