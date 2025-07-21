#!/usr/bin/env python3
"""
PDF Reader for Multi-Agent Observability System Documentation
Extracts text content from PDF files using multiple methods for best results
"""

import sys
import os
from pathlib import Path

try:
    import PyPDF2
    import pdfplumber
    from pdfminer.high_level import extract_text as pdfminer_extract
except ImportError as e:
    print(f"Error: Required libraries not installed. Run: pip install PyPDF2 pdfplumber")
    sys.exit(1)


def extract_with_pypdf2(pdf_path):
    """Extract text using PyPDF2 - fast but may miss some formatting"""
    try:
        text = ""
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            for page_num, page in enumerate(reader.pages):
                page_text = page.extract_text()
                text += f"\n--- Page {page_num + 1} ---\n{page_text}\n"
        return text
    except Exception as e:
        print(f"PyPDF2 extraction failed: {e}")
        return None


def extract_with_pdfplumber(pdf_path):
    """Extract text using pdfplumber - better formatting preservation"""
    try:
        text = ""
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages):
                page_text = page.extract_text() or ""
                text += f"\n--- Page {page_num + 1} ---\n{page_text}\n"
        return text
    except Exception as e:
        print(f"pdfplumber extraction failed: {e}")
        return None


def extract_with_pdfminer(pdf_path):
    """Extract text using pdfminer - comprehensive extraction"""
    try:
        return pdfminer_extract(pdf_path)
    except Exception as e:
        print(f"pdfminer extraction failed: {e}")
        return None


def extract_pdf_text(pdf_path, method='auto'):
    """
    Extract text from PDF using specified method or auto-selection
    
    Args:
        pdf_path: Path to PDF file
        method: 'auto', 'pypdf2', 'pdfplumber', or 'pdfminer'
    
    Returns:
        Extracted text content
    """
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        print(f"Error: PDF file not found: {pdf_path}")
        return None
    
    print(f"Extracting text from: {pdf_path}")
    
    methods = {
        'pypdf2': extract_with_pypdf2,
        'pdfplumber': extract_with_pdfplumber,
        'pdfminer': extract_with_pdfminer
    }
    
    if method != 'auto' and method in methods:
        return methods[method](pdf_path)
    
    # Auto method: try all methods and return best result
    results = {}
    for name, func in methods.items():
        print(f"Trying {name}...")
        result = func(pdf_path)
        if result:
            results[name] = result
            print(f"✓ {name}: extracted {len(result)} characters")
        else:
            print(f"✗ {name}: failed")
    
    if not results:
        print("All extraction methods failed!")
        return None
    
    # Return the longest result (usually most complete)
    best_method = max(results.keys(), key=lambda k: len(results[k]))
    print(f"Using result from: {best_method}")
    return results[best_method]


def save_extracted_text(text, output_path):
    """Save extracted text to file"""
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f"Text saved to: {output_path}")
        return True
    except Exception as e:
        print(f"Failed to save text: {e}")
        return False


def main():
    """Main function for command-line usage"""
    if len(sys.argv) < 2:
        print("Usage: python pdf_reader.py <pdf_file> [output_file] [method]")
        print("Methods: auto, pypdf2, pdfplumber, pdfminer")
        sys.exit(1)
    
    pdf_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    method = sys.argv[3] if len(sys.argv) > 3 else 'auto'
    
    # Extract text
    text = extract_pdf_text(pdf_file, method)
    
    if text:
        print(f"\nExtracted {len(text)} characters")
        
        # Save to file if specified
        if output_file:
            save_extracted_text(text, output_file)
        else:
            # Print first 1000 characters as preview
            print("\n=== TEXT PREVIEW (first 1000 chars) ===")
            print(text[:1000])
            if len(text) > 1000:
                print(f"\n... ({len(text) - 1000} more characters)")
        
        return text
    else:
        print("Failed to extract any text from the PDF")
        return None


if __name__ == "__main__":
    main()