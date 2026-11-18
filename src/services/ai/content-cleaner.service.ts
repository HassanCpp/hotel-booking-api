/**
 * ContentCleaner Service
 * Preprocesses raw text and PDF extractions to eliminate noise, repeated headers/footers,
 * page numbers, and formatting artifacts before chunking.
 */

export interface CleanedContent {
  cleanText: string;
  extractedTitle?: string;
  lineCount: number;
  characterCount: number;
}

export class ContentCleaner {
  /**
   * Cleans and normalizes extracted text.
   */
  public static clean(rawText: string, fallbackTitle?: string): CleanedContent {
    if (!rawText || typeof rawText !== 'string') {
      return {
        cleanText: '',
        extractedTitle: fallbackTitle,
        lineCount: 0,
        characterCount: 0,
      };
    }

    let text = rawText;

    // 1. Normalize line endings (CRLF -> LF)
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 2. Strip standard PDF page number patterns
    // e.g. "Page 1 of 10", "Page 4", "- 5 -", "--- Page 2 ---"
    text = text.replace(/^\s*(?:Page\s+\d+(?:\s+of\s+\d+)?|\d+\s*\/\s*\d+|[-–—]\s*\d+\s*[-–—])\s*$/gim, '');

    // 3. Strip common recurring header/footer artifacts
    // e.g. "Confidential", "All rights reserved", "Printed on: ..."
    text = text.replace(/©\s*\d{4}[^\n]*/gi, '');
    text = text.replace(/all rights reserved\.?/gi, '');
    text = text.replace(/printed on:\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/gi, '');

    // 4. Normalize multiple whitespaces and consecutive newlines
    // Replace horizontal whitespace runs with single space
    text = text.replace(/[ \t]+/g, ' ');
    // Replace 3+ consecutive newlines with 2 newlines (paragraph boundary)
    text = text.replace(/\n{3,}/g, '\n\n');

    // 5. Trim leading/trailing whitespace
    text = text.trim();

    // 6. Attempt to extract a document title from the first non-empty line if suitable
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    let extractedTitle = fallbackTitle;

    if (lines.length > 0) {
      const firstLine = lines[0];
      // If the first line is short and looks like a title (< 100 chars, no sentence ending)
      if (firstLine.length >= 3 && firstLine.length <= 100 && !firstLine.endsWith('.')) {
        extractedTitle = firstLine;
      }
    }

    return {
      cleanText: text,
      extractedTitle,
      lineCount: lines.length,
      characterCount: text.length,
    };
  }
}
