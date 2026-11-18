import { OpenAI } from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { env } from '../../config/env';

export interface VectorMetadata {
  hotelAccountId?: string;
  propertyId?: string;
  documentId: string;
  chunkId: string;
  tier: 'LARGE' | 'MEDIUM' | 'SMALL';
  parentId?: string;
  grandParentId?: string;
  title: string;
  textSnippet: string;
  [key: string]: any;
}

export interface VectorRecordInput {
  id: string;
  text: string;
  metadata: VectorMetadata;
}

export interface VectorQueryResult {
  id: string;
  score: number;
  metadata?: VectorMetadata;
}

export interface IndexHealthStats {
  connected: boolean;
  indexName: string;
  dimension: number;
  metric: string;
  totalRecordCount: number;
  status: string;
  hasDocumentSchema: boolean;
  error?: string;
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (retries > 0) {
      await new Promise((res) => setTimeout(res, delayMs));
      return withRetry(fn, retries - 1, delayMs * 2);
    }
    throw err;
  }
}

export class VectorService {
  private static openaiClient: OpenAI | null = null;
  private static pineconeClient: Pinecone | null = null;
  private static cachedDimension: number | null = null;
  private static cachedHasSchema: boolean | null = null;

  private static getOpenAI(): OpenAI {
    if (!this.openaiClient) {
      if (!env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not configured in backend environment');
      }
      this.openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    }
    return this.openaiClient;
  }

  private static getPinecone(): Pinecone {
    if (!this.pineconeClient) {
      if (!env.PINECONE_API_KEY) {
        throw new Error('PINECONE_API_KEY is not configured in backend environment');
      }
      this.pineconeClient = new Pinecone({ apiKey: env.PINECONE_API_KEY });
    }
    return this.pineconeClient;
  }

  /**
   * Checks whether the target Pinecone index uses an integrated Document Schema
   */
  public static async hasDocumentSchema(): Promise<boolean> {
    if (this.cachedHasSchema !== null) return this.cachedHasSchema;

    try {
      const pc = this.getPinecone();
      const desc = await withRetry(() => pc.describeIndex(env.PINECONE_INDEX_NAME));
      this.cachedHasSchema = Boolean(desc.schema && desc.schema.fields);
      return this.cachedHasSchema;
    } catch {
      this.cachedHasSchema = false;
      return false;
    }
  }

  /**
   * Retrieves or discovers the Pinecone index dimension.
   */
  public static async getIndexDimension(): Promise<number> {
    if (this.cachedDimension) return this.cachedDimension;

    try {
      const pc = this.getPinecone();
      const indexList = await pc.listIndexes();
      const target = indexList.indexes?.find((idx) => idx.name === env.PINECONE_INDEX_NAME);
      if (target && target.dimension) {
        this.cachedDimension = target.dimension;
        return target.dimension;
      }
    } catch (err) {
      console.warn('Could not auto-detect Pinecone index dimension, using configured default:', err);
    }

    this.cachedDimension = env.PINECONE_DIMENSION || 1024;
    return this.cachedDimension;
  }

  /**
   * Generates embeddings using text-embedding-3-small in batches.
   */
  public static async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const openai = this.getOpenAI();
    const dimension = await this.getIndexDimension();
    const batchSize = 40;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const sanitizedBatch = batch.map((t) => t.replace(/\n+/g, ' ').trim() || 'empty');

      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: sanitizedBatch,
        dimensions: dimension,
      });

      for (const item of response.data) {
        allEmbeddings.push(item.embedding);
      }
    }

    return allEmbeddings;
  }

  /**
   * Upserts vector records into Pinecone.
   * Seamlessly routes to Document API (if index has document schema) or Vector API (standard).
   */
  public static async upsertVectors(records: VectorRecordInput[]): Promise<number> {
    if (records.length === 0) return 0;

    const pc = this.getPinecone();
    const index = pc.index(env.PINECONE_INDEX_NAME);
    const isDocSchema = await this.hasDocumentSchema();

    if (isDocSchema) {
      // Index uses Pinecone Integrated Document Schema (e.g. chunk_text & title fields)
      const documents = records.map((r) => ({
        _id: r.id,
        chunk_text: `${r.metadata.title}: ${r.text}`,
        title: r.metadata.title,
        hotelAccountId: r.metadata.hotelAccountId || '',
        propertyId: r.metadata.propertyId || '',
        documentId: r.metadata.documentId,
        chunkId: r.metadata.chunkId,
        tier: r.metadata.tier,
        parentId: r.metadata.parentId || '',
        grandParentId: r.metadata.grandParentId || '',
      }));

      const batchSize = 100;
      let upsertedCount = 0;

      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        await withRetry(() => index.upsertDocuments({ documents: batch as any }));
        upsertedCount += batch.length;
      }

      return upsertedCount;
    }

    // Standard raw vector index: generate OpenAI embeddings and upsert
    const texts = records.map((r) => r.text);
    const embeddings = await this.generateEmbeddings(texts);

    const pineconeRecords = records.map((r, i) => ({
      id: r.id,
      values: embeddings[i],
      metadata: {
        ...r.metadata,
        textSnippet: r.text.slice(0, 1000),
      },
    }));

    const batchSize = 100;
    let upsertedCount = 0;

    for (let i = 0; i < pineconeRecords.length; i += batchSize) {
      const batch = pineconeRecords.slice(i, i + batchSize);
      await index.upsert({ records: batch as any });
      upsertedCount += batch.length;
    }

    return upsertedCount;
  }

  /**
   * Query vectors with tenant and property scoping.
   * Supports both Document Schema search and raw Vector search.
   */
  public static async queryVectors(params: {
    queryText: string;
    topK?: number;
    hotelAccountId?: string;
    propertyId?: string;
  }): Promise<VectorQueryResult[]> {
    const { queryText, topK = 10, hotelAccountId, propertyId } = params;

    const pc = this.getPinecone();
    const index = pc.index(env.PINECONE_INDEX_NAME);
    const isDocSchema = await this.hasDocumentSchema();

    // Build multi-tenant filter
    const filter: Record<string, any> = {};
    if (hotelAccountId) {
      filter.hotelAccountId = hotelAccountId;
    }
    if (propertyId) {
      filter['$or'] = [
        { propertyId: propertyId },
        { propertyId: '' },
      ];
    }

    if (isDocSchema) {
      // Use Pinecone Document Search
      const searchRes = await index.searchDocuments({
        scoreBy: [
          {
            type: 'embed',
            field: 'chunk_text',
            query: queryText.trim(),
          },
        ],
        topK,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
      });

      return (searchRes.matches || []).map((m: any) => ({
        id: m._id,
        score: m._score || 0,
        metadata: {
          documentId: m.documentId || '',
          chunkId: m.chunkId || m._id,
          title: m.title || '',
          tier: m.tier || 'SMALL',
          textSnippet: m.chunk_text || '',
          ...m,
        },
      }));
    }

    // Standard raw vector search using OpenAI embeddings
    const openai = this.getOpenAI();
    const dimension = await this.getIndexDimension();
    const embResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: queryText.replace(/\n+/g, ' ').trim(),
      dimensions: dimension,
    });
    const queryVector = embResponse.data[0].embedding;

    const queryResponse = await index.query({
      vector: queryVector,
      topK,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      includeMetadata: true,
    });

    return (queryResponse.matches || []).map((m) => ({
      id: m.id,
      score: m.score || 0,
      metadata: m.metadata as unknown as VectorMetadata,
    }));
  }

  /**
   * Deletes vectors by either explicit ID list or documentId.
   */
  public static async deleteDocumentVectors(documentId: string, vectorIds?: string[]): Promise<void> {
    try {
      const pc = this.getPinecone();
      const index = pc.index(env.PINECONE_INDEX_NAME);
      const isDocSchema = await this.hasDocumentSchema();

      if (vectorIds && vectorIds.length > 0) {
        if (isDocSchema) {
          await withRetry(() => index.deleteDocuments({ ids: vectorIds }));
        } else {
          await withRetry(() => index.deleteMany(vectorIds));
        }
        return;
      }

      // If vectorIds not provided, attempt filter deletion
      if (isDocSchema) {
        await withRetry(() =>
          index.deleteDocuments({
            filter: { documentId: { $eq: documentId } },
          })
        );
      } else {
        await withRetry(() =>
          index.deleteMany({
            filter: { documentId: { $eq: documentId } },
          })
        );
      }
    } catch (err) {
      console.warn(`Notice: Could not delete Pinecone vectors for doc ${documentId}:`, err);
    }
  }

  /**
   * Health and metrics check for Pinecone index.
   */
  public static async getIndexHealth(): Promise<IndexHealthStats> {
    try {
      const pc = this.getPinecone();
      const indexList = await pc.listIndexes();
      const target = indexList.indexes?.find((idx) => idx.name === env.PINECONE_INDEX_NAME);
      const hasSchema = await this.hasDocumentSchema();

      if (!target) {
        return {
          connected: false,
          indexName: env.PINECONE_INDEX_NAME,
          dimension: 0,
          metric: 'unknown',
          totalRecordCount: 0,
          status: 'INDEX_NOT_FOUND',
          hasDocumentSchema: hasSchema,
          error: `Index ${env.PINECONE_INDEX_NAME} was not found on your Pinecone account`,
        };
      }

      let recordCount = 0;
      try {
        const index = pc.index(env.PINECONE_INDEX_NAME);
        const stats = await index.describeIndexStats();
        recordCount = stats.totalRecordCount || 0;
      } catch {
        // Some document schema indexes use different stats APIs
      }

      return {
        connected: true,
        indexName: env.PINECONE_INDEX_NAME,
        dimension: target.dimension ?? 1024,
        metric: target.metric || 'cosine',
        totalRecordCount: recordCount,
        status: target.status?.state || 'Ready',
        hasDocumentSchema: hasSchema,
      };
    } catch (err: any) {
      return {
        connected: false,
        indexName: env.PINECONE_INDEX_NAME,
        dimension: 0,
        metric: 'unknown',
        totalRecordCount: 0,
        status: 'CONNECTION_ERROR',
        hasDocumentSchema: false,
        error: err.message || String(err),
      };
    }
  }
}
