import prisma from "../lib/prisma";
import { OpenAIService } from "./ai/openai";
import { StorageService } from "./storage";
const { PDFParse } = require("pdf-parse");
import * as mammoth from "mammoth";
import * as XLSX from "xlsx";

export class KnowledgeBaseService {
  private aiService: OpenAIService;
  private storageService: StorageService;

  constructor() {
    this.aiService = new OpenAIService();
    this.storageService = new StorageService();
  }

  async processDocument(documentId: string, fileKey: string, mimeType: string) {
    try {
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: { tenantId: true },
      });

      const tenantId = document?.tenantId;

      // 1. Update status
      await prisma.document.update({
        where: { id: documentId },
        data: { status: "INDEXING" },
      });

      // Clear existing chunks to allow reprocessing
      await (prisma as any).documentChunk.deleteMany({
        where: { documentId },
      });

      // 2. Extract text
      let text = "";
      if (mimeType === "application/pdf") {
        try {
          const fileContent = await this.storageService.getFileBuffer(fileKey);

          const parser = new PDFParse({ data: fileContent, verbosity: 0 });
          await parser.load();
          const pdfData = await parser.getText();

          // pdf-parse v2.4.5 returns text directly as a string
          const extractedText =
            typeof pdfData === "string" ? pdfData : pdfData?.text || "";

          if (!extractedText || extractedText.trim() === "") {
            console.warn(
              `[KB Process] PDF extraction returned empty text for ${fileKey}`
            );
            text =
              "PDF content could not be extracted. The file may be image-based or encrypted.";
          } else {
            text = extractedText;
          }
        } catch (pdfError) {
          console.error(
            `[KB Process] PDF parsing error for ${fileKey}:`,
            pdfError
          );
          text =
            "Error extracting PDF content. The file may be corrupted or in an unsupported format.";
        }
      } else if (
        mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        const fileContent = await this.storageService.getFileBuffer(fileKey);
        const result = await mammoth.extractRawText({ buffer: fileContent });
        text = result.value;
      } else if (
        mimeType === "text/csv" ||
        mimeType === "application/vnd.ms-excel" ||
        mimeType ===
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      ) {
        const fileContent = await this.storageService.getFileBuffer(fileKey);
        const workbook = XLSX.read(fileContent, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        text = XLSX.utils.sheet_to_csv(sheet);
      } else if (mimeType === "text/plain" || mimeType === "application/json") {
        text = await this.storageService.getFileContent(fileKey);
      } else {
        text = "Unsupported file type for text extraction.";
      }

      // 3. Chunk text (increased size for better context)
      const chunks = this.chunkText(text, 1500, 300);

      // 4. Generate embeddings and save
      for (const chunk of chunks) {
        // Skip empty chunks
        if (!chunk.trim()) continue;

        const embedding = await this.aiService.getEmbeddings(chunk);

        await (prisma as any).documentChunk.create({
          data: {
            documentId,
            tenantId,
            content: chunk,
            embeddingJson: embedding,
          },
        });
      }

      // 5. Mark as ready
      await prisma.document.update({
        where: { id: documentId },
        data: { status: "READY" },
      });
    } catch (error) {
      console.error("Error processing document:", error);
      await prisma.document.update({
        where: { id: documentId },
        data: { status: "ERROR" },
      });
    }
  }

  private chunkText(
    text: string,
    chunkSize: number,
    overlap: number
  ): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start += chunkSize - overlap;
    }
    return chunks;
  }

  async search(
    query: string,
    tenantId: string,
    limit: number = 10,
    documentIds?: string[]
  ): Promise<string[]> {
    try {
      const queryEmbedding = await this.aiService.getEmbeddings(query);

      // Build the filter for chunks
      const filter: any = {
        OR: [{ tenantId }, { document: { tenantId } }],
      };

      // If documentIds provided, only search within those documents
      if (documentIds && documentIds.length > 0) {
        filter.documentId = { in: documentIds };
      }

      // Fetch chunks for this tenant (or specific documents)
      const allChunks = await (prisma as any).documentChunk.findMany({
        where: filter,
      });

      const scoredChunks = allChunks.map((chunk: any) => {
        const embedding = chunk.embeddingJson as number[];
        if (!embedding || !Array.isArray(embedding))
          return { content: chunk.content, score: -1 };

        return {
          content: chunk.content,
          score: this.cosineSimilarity(queryEmbedding, embedding),
        };
      });

      scoredChunks.sort((a: any, b: any) => b.score - a.score);

      // Filter by minimum similarity threshold (lowered to 0.2 for better recall)
      const relevantChunks = scoredChunks.filter((c: any) => c.score >= 0.2);

      return relevantChunks.slice(0, limit).map((c: any) => c.content);
    } catch (error) {
      console.error("Search error:", error);
      return [];
    }
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
  }
}
