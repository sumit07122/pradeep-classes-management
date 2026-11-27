import os
import json

def test_raw_extraction_output():
    json_path = os.path.join("scratch", "extracted_raw_forms.json")
    assert os.path.exists(json_path), f"Raw extraction JSON missing at {json_path}"
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert len(data) == 81, f"Expected 81 records, got {len(data)}"
    assert data[0].get("student_name"), "First record missing student name"
    print(f"Task 1 verification passed: {len(data)} raw records extracted.")

if __name__ == "__main__":
    test_raw_extraction_output()
