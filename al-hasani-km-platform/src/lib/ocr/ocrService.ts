import "server-only";
import { env } from "../env";

/**
 * OCR abstraction. Extracts text per page from an uploaded PDF/image so it can
 * be full-text indexed (Elasticsearch) and chunked for embeddings (Qdrant).
 *
 * Providers:
 *  - "tesseract": local CLI (ara+eng) via child_process, suited for self-hosted.
 *  - "azure":     Azure Document Intelligence (Read model) for higher accuracy.
 *
 * The pipeline (queued via RabbitMQ in production) is:
 *   upload → OCR per page → persist ocrText on DocumentVersion
 *          → index in Elasticsearch → chunk → embed → upsert to Qdrant.
 */
export interface OcrPage {
  page: number;
  text: string;
}

export interface OcrResult {
  pages: OcrPage[];
  fullText: string;
  pageCount: number;
}

export async function runOcr(filePath: string, mimeType: string): Promise<OcrResult> {
  if (env.ocrProvider === "azure") return azureOcr(filePath);
  return tesseractOcr(filePath, mimeType);
}

async function tesseractOcr(filePath: string, _mime: string): Promise<OcrResult> {
  // Implementation note (self-hosted):
  //   1. pdftoppm to rasterize pages → page-N.png
  //   2. tesseract page-N.png stdout -l ara+eng --psm 3
  //   3. collect per-page text
  // Stubbed here to keep the build dependency-free; wire to child_process on deploy.
  throw new Error(
    "OCR (tesseract) not wired in this environment. Install tesseract-ocr (ara+eng) + poppler and implement the child_process pipeline on the server."
  );
}

async function azureOcr(_filePath: string): Promise<OcrResult> {
  // POST the document to AZURE_DI_ENDPOINT (prebuilt-read), poll the operation,
  // then map analyzeResult.pages[].lines into OcrPage[].
  throw new Error("OCR (azure) requires AZURE_DI_ENDPOINT and AZURE_DI_KEY.");
}

// Simple page-aware chunker used by the indexing pipeline.
export function chunkPages(pages: OcrPage[], maxChars = 900): { page: number; ordinal: number; content: string }[] {
  const chunks: { page: number; ordinal: number; content: string }[] = [];
  let ordinal = 0;
  for (const p of pages) {
    for (let i = 0; i < p.text.length; i += maxChars) {
      chunks.push({ page: p.page, ordinal: ordinal++, content: p.text.slice(i, i + maxChars) });
    }
  }
  return chunks;
}
