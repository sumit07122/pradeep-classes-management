# scripts/test_sample_extraction.py
import os, json

def test_raw_extraction_output():
    json_path = r"scratch/extracted_raw_forms.json"
    assert os.path.exists(json_path), "Raw extraction JSON missing"
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert len(data) == 81, f"Expected 81 records, got {len(data)}"
    assert data[0]["student_name"], "First record missing student name"
    print("Task 1 verification passed: 81 raw records extracted.")

if __name__ == "__main__":
    test_raw_extraction_output()
