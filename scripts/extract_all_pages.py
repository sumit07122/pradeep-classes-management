"""
Extract all 81 pages from Registrations.pdf into high-resolution images.
"""
import os
import pymupdf

PDF_PATH = r"C:\Users\hp\OneDrive\Desktop\Registrations.pdf"
OUTPUT_DIR = os.path.join("scratch", "forms")

def extract_pages():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    doc = pymupdf.open(PDF_PATH)
    total_pages = len(doc)
    print(f"Loaded {PDF_PATH} with {total_pages} pages.")
    
    for i in range(total_pages):
        page = doc[i]
        # 150 DPI gives great readability and fast processing
        pix = page.get_pixmap(dpi=150)
        out_path = os.path.join(OUTPUT_DIR, f"page_{i+1:02d}.png")
        pix.save(out_path)
        if (i + 1) % 10 == 0 or (i + 1) == total_pages:
            print(f"Rendered {i+1}/{total_pages} pages -> {out_path}")

    print("All pages rendered successfully.")

if __name__ == "__main__":
    extract_pages()
