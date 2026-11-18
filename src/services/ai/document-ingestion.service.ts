import { Types } from 'mongoose';
import { KnowledgeDocument, IKnowledgeDocument } from '../../models/KnowledgeDocument';
import { KnowledgeChunk, IKnowledgeChunk } from '../../models/KnowledgeChunk';
import { ContentCleaner } from './content-cleaner.service';
import { TreeChunker } from './tree-chunker.service';
import { VectorService, VectorRecordInput } from './vector.service';

export interface IngestDocumentParams {
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  };
  title: string;
  hotelAccountId?: Types.ObjectId | null;
  propertyId?: Types.ObjectId | null;
  uploadedBy: {
    userId: Types.ObjectId;
    userRole: string;
    userEmail: string;
  };
}

export class DocumentIngestionService {
  /**
   * Extracts raw text from either a text file or a searchable PDF.
   */
  public static async extractText(buffer: Buffer, mimetype: string, filename: string): Promise<string> {
    const isPdf = mimetype === 'application/pdf' || filename.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      try {
        const pdfParseModule = require('pdf-parse');

        if (typeof pdfParseModule === 'function') {
          // pdf-parse v1
          const data = await pdfParseModule(buffer);
          return data.text || '';
        } else if (pdfParseModule.PDFParse) {
          // pdf-parse v2+
          const parser = new pdfParseModule.PDFParse({ data: buffer });
          try {
            const result = await parser.getText();
            return result.text || '';
          } finally {
            await parser.destroy();
          }
        } else if (pdfParseModule.default && typeof pdfParseModule.default === 'function') {
          const data = await pdfParseModule.default(buffer);
          return data.text || '';
        }
        throw new Error('Unsupported pdf-parse module format');
      } catch (err: any) {
        console.error('PDF text extraction error:', err);
        throw new Error(`Failed to parse PDF: ${err.message || 'The PDF may be corrupted or password-protected.'}`);
      }
    }

    // Default to UTF-8 text file
    return buffer.toString('utf-8');
  }

  /**
   * Full end-to-end ingestion pipeline:
   * Extraction -> Cleaning -> 3-Tier Chunking -> Mongo DB Storage -> Pinecone Vector Indexing
   */
  public static async ingest(params: IngestDocumentParams): Promise<IKnowledgeDocument> {
    const { file, title, hotelAccountId, propertyId, uploadedBy } = params;

    const fileType = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')
      ? 'pdf'
      : 'txt';

    // 1. Create document record in PROCESSING status
    const doc = new KnowledgeDocument({
      hotelAccountId: hotelAccountId || null,
      propertyId: propertyId || null,
      title: title.trim(),
      filename: file.originalname,
      fileType,
      fileSize: file.size,
      status: 'PROCESSING',
      uploadedBy,
    });
    await doc.save();

    try {
      // 2. Extract text from buffer
      const rawText = await this.extractText(file.buffer, file.mimetype, file.originalname);

      // 3. Clean extracted text
      const cleaned = ContentCleaner.clean(rawText, title);
      if (!cleaned.cleanText || cleaned.cleanText.length < 20) {
        throw new Error(
          'Document contains insufficient or unreadable text. If uploading a PDF, please ensure it is searchable and not an empty or scanned document.'
        );
      }

      // 4. Generate 3-Tier Hierarchical Chunks
      const chunkResult = TreeChunker.chunkDocument(cleaned.cleanText, title);

      // Maps to associate temporary chunk IDs with saved MongoDB ObjectIds
      const largeIdMap = new Map<string, Types.ObjectId>();
      const mediumIdMap = new Map<string, Types.ObjectId>();

      // 5. Save Tier 1 (Large Chunks) in MongoDB
      for (const lChunk of chunkResult.largeChunks) {
        const mongoLarge = new KnowledgeChunk({
          documentId: doc._id,
          hotelAccountId: doc.hotelAccountId,
          propertyId: doc.propertyId,
          tier: 'LARGE',
          chunkIndex: lChunk.chunkIndex,
          title: lChunk.title,
          text: lChunk.text,
          tokenCount: lChunk.tokenCount,
        });
        await mongoLarge.save();
        largeIdMap.set(lChunk.tempId, mongoLarge._id);
      }

      // 6. Save Tier 2 (Medium Chunks) in MongoDB with parentId -> Large
      for (const mChunk of chunkResult.mediumChunks) {
        const parentMongoId = mChunk.parentTempId ? largeIdMap.get(mChunk.parentTempId) : null;
        const mongoMedium = new KnowledgeChunk({
          documentId: doc._id,
          hotelAccountId: doc.hotelAccountId,
          propertyId: doc.propertyId,
          tier: 'MEDIUM',
          chunkIndex: mChunk.chunkIndex,
          parentId: parentMongoId || null,
          title: mChunk.title,
          text: mChunk.text,
          tokenCount: mChunk.tokenCount,
        });
        await mongoMedium.save();
        mediumIdMap.set(mChunk.tempId, mongoMedium._id);
      }

      // 7. Save Tier 3 (Small Chunks) in MongoDB with parentId -> Medium and grandParentId -> Large
      const savedSmallChunks: IKnowledgeChunk[] = [];
      for (const sChunk of chunkResult.smallChunks) {
        const parentMongoId = sChunk.parentTempId ? mediumIdMap.get(sChunk.parentTempId) : null;
        const grandParentMongoId = sChunk.grandParentTempId ? largeIdMap.get(sChunk.grandParentTempId) : null;

        const mongoSmall = new KnowledgeChunk({
          documentId: doc._id,
          hotelAccountId: doc.hotelAccountId,
          propertyId: doc.propertyId,
          tier: 'SMALL',
          chunkIndex: sChunk.chunkIndex,
          parentId: parentMongoId || null,
          grandParentId: grandParentMongoId || null,
          title: sChunk.title,
          text: sChunk.text,
          tokenCount: sChunk.tokenCount,
        });
        await mongoSmall.save();
        savedSmallChunks.push(mongoSmall);
      }

      // 8. Vectorize Small Chunks & Upsert to Pinecone
      const vectorInputs: VectorRecordInput[] = savedSmallChunks.map((sm) => {
        const pineconeId = `doc_${doc._id.toString()}_sm_${sm.chunkIndex}`;
        return {
          id: pineconeId,
          text: `${sm.title}: ${sm.text}`,
          metadata: {
            hotelAccountId: doc.hotelAccountId ? doc.hotelAccountId.toString() : '',
            propertyId: doc.propertyId ? doc.propertyId.toString() : '',
            documentId: doc._id.toString(),
            chunkId: sm._id.toString(),
            tier: 'SMALL',
            parentId: sm.parentId ? sm.parentId.toString() : '',
            grandParentId: sm.grandParentId ? sm.grandParentId.toString() : '',
            title: sm.title,
            textSnippet: sm.text.slice(0, 1000),
          },
        };
      });

      const upsertedVectors = await VectorService.upsertVectors(vectorInputs);

      // 9. Update MongoDB small chunks with their pineconeVectorId
      await Promise.all(
        savedSmallChunks.map((sm, idx) =>
          KnowledgeChunk.updateOne(
            { _id: sm._id },
            { $set: { pineconeVectorId: vectorInputs[idx].id } }
          )
        )
      );

      // 10. Update KnowledgeDocument to INDEXED
      doc.status = 'INDEXED';
      doc.errorMessage = undefined;
      doc.stats = {
        totalTokens: chunkResult.totalTokens,
        largeChunkCount: chunkResult.largeChunks.length,
        mediumChunkCount: chunkResult.mediumChunks.length,
        smallChunkCount: chunkResult.smallChunks.length,
        vectorCount: upsertedVectors,
      };
      await doc.save();

      return doc;
    } catch (err: any) {
      console.error(`Document ingestion failed for doc ${doc._id}:`, err);
      doc.status = 'FAILED';
      doc.errorMessage = err.message || 'Unknown error occurred during document ingestion';
      await doc.save();

      // Clean up any partially created chunks and vectors
      await KnowledgeChunk.deleteMany({ documentId: doc._id });
      try {
        await VectorService.deleteDocumentVectors(doc._id.toString());
      } catch {
        // Ignore vector deletion error during cleanup
      }

      throw err;
    }
  }

  /**
   * Deletes a knowledge document, its chunks from MongoDB, and its vectors from Pinecone.
   */
  public static async deleteDocument(documentId: string): Promise<void> {
    const doc = await KnowledgeDocument.findById(documentId);
    if (!doc) {
      throw new Error('Document not found');
    }

    // 1. Find vector IDs to delete
    const chunks = await KnowledgeChunk.find({ documentId: doc._id }).select('pineconeVectorId').lean();
    const vectorIds = chunks.map((c) => c.pineconeVectorId).filter(Boolean) as string[];

    // 2. Delete vectors from Pinecone
    try {
      await VectorService.deleteDocumentVectors(doc._id.toString(), vectorIds);
    } catch (err) {
      console.warn(`Warning: Could not delete Pinecone vectors for doc ${doc._id}:`, err);
    }

    // 3. Delete chunks from MongoDB
    await KnowledgeChunk.deleteMany({ documentId: doc._id });

    // 4. Delete document from MongoDB
    await KnowledgeDocument.findByIdAndDelete(doc._id);
  }
}
