import { Types } from 'mongoose';
import { KnowledgeChunk, IKnowledgeChunk } from '../../models/KnowledgeChunk';
import { VectorService, VectorQueryResult } from './vector.service';

export interface RetrievedCandidate {
  chunkId: string;
  documentId: string;
  title: string;
  text: string;
  tier: 'LARGE' | 'MEDIUM' | 'SMALL';
  score: number;
  origin: 'VECTOR' | 'LEXICAL' | 'HYBRID';
  hydratedParentText?: string;
  exactMatchFound: boolean;
}

export interface RetrievalResult {
  candidates: RetrievedCandidate[];
  exactMatchFound: boolean;
  topScore: number;
}

export class HybridRetriever {
  /**
   * Performs hybrid search combining Pinecone Dense Vector search and MongoDB Lexical text search.
   */
  public static async retrieve(params: {
    query: string;
    hotelAccountId?: string | Types.ObjectId | null;
    propertyId?: string | Types.ObjectId | null;
    topK?: number;
  }): Promise<RetrievalResult> {
    const { query, topK = 6 } = params;
    const hotelAccountId = params.hotelAccountId ? params.hotelAccountId.toString() : undefined;
    const propertyId = params.propertyId ? params.propertyId.toString() : undefined;

    // 1. Parallel execution: Vector search + Lexical search
    const [vectorResults, lexicalResults] = await Promise.all([
      this.fetchVectorCandidates(query, hotelAccountId, propertyId, topK * 2),
      this.fetchLexicalCandidates(query, hotelAccountId, propertyId, topK * 2),
    ]);

    // 2. Candidate Fusion with Reciprocal Rank Fusion (RRF)
    const fused = this.fuseCandidates(vectorResults, lexicalResults, query);

    // 3. Take top candidates
    const topCandidates = fused.slice(0, topK);

    // 4. Hydrate context from MongoDB for Small chunks (fetch parent Medium / Large text)
    const hydratedCandidates = await this.hydrateParentContext(topCandidates);

    const exactMatchFound = hydratedCandidates.some((c) => c.exactMatchFound);
    const topScore = hydratedCandidates.length > 0 ? hydratedCandidates[0].score : 0;

    return {
      candidates: hydratedCandidates,
      exactMatchFound,
      topScore,
    };
  }

  /**
   * Fetches vector candidates from Pinecone
   */
  private static async fetchVectorCandidates(
    query: string,
    hotelAccountId?: string,
    propertyId?: string,
    limit: number = 12
  ): Promise<VectorQueryResult[]> {
    try {
      return await VectorService.queryVectors({
        queryText: query,
        topK: limit,
        hotelAccountId,
        propertyId,
      });
    } catch (err) {
      console.warn('Vector search failed, falling back to lexical search:', err);
      return [];
    }
  }

  /**
   * Fetches lexical candidates from MongoDB text index
   */
  private static async fetchLexicalCandidates(
    query: string,
    hotelAccountId?: string,
    propertyId?: string,
    limit: number = 12
  ): Promise<IKnowledgeChunk[]> {
    try {
      const filter: Record<string, any> = {
        $text: { $search: query },
      };

      if (hotelAccountId) {
        filter.hotelAccountId = new Types.ObjectId(hotelAccountId);
      }

      if (propertyId) {
        filter.$or = [
          { propertyId: new Types.ObjectId(propertyId) },
          { propertyId: null },
          { propertyId: { $exists: false } },
        ];
      }

      return await KnowledgeChunk.find(filter, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .limit(limit)
        .lean();
    } catch (err) {
      console.warn('Lexical search failed:', err);
      return [];
    }
  }

  /**
   * Fuses vector and lexical candidates using Reciprocal Rank Fusion with match bonuses
   */
  private static fuseCandidates(
    vectorMatches: VectorQueryResult[],
    lexicalChunks: any[],
    rawQuery: string
  ): RetrievedCandidate[] {
    const kRRF = 50;
    const candidatesMap = new Map<string, RetrievedCandidate>();

    // Clean tokens for exact match bonuses
    const queryLower = rawQuery.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 3);

    // Extract distinctive entity tokens: alphanumeric codes, prices, percentages, dates, and times
    // Matches e.g. "SEC-REF-902", "SUMMER2026", "FLEX-24H", "$150", "3,500", "15,000", "50%", "12:00", "6:30"
    const rawTokens = rawQuery.match(/[\w$€£]+(?:[-_.:\/][\w$€£]+)+|\b[A-Za-z]+\d+\b|\b\d+[A-Za-z]+\b|\b\d+(?:,\d{3})*(?:\.\d+)?%?\b/g) || [];
    const distinctiveTokens = Array.from(new Set(rawTokens.map((t) => t.toLowerCase())));

    // 1. Process Vector Channel (Weight: 1.0)
    vectorMatches.forEach((vm, rank) => {
      const chunkId = vm.metadata?.chunkId || vm.id;
      const rrfScore = 1.0 / (kRRF + rank + 1);

      candidatesMap.set(chunkId, {
        chunkId,
        documentId: vm.metadata?.documentId || '',
        title: vm.metadata?.title || 'Hotel Policy',
        text: vm.metadata?.textSnippet || '',
        tier: vm.metadata?.tier || 'SMALL',
        score: rrfScore,
        origin: 'VECTOR',
        exactMatchFound: false,
      });
    });

    // 2. Process Lexical Channel (Weight: 1.10)
    lexicalChunks.forEach((lc, rank) => {
      const chunkId = lc._id.toString();
      const lexicalScore = (1.1 / (kRRF + rank + 1));

      if (candidatesMap.has(chunkId)) {
        const existing = candidatesMap.get(chunkId)!;
        existing.score += lexicalScore;
        existing.origin = 'HYBRID';
      } else {
        candidatesMap.set(chunkId, {
          chunkId,
          documentId: lc.documentId?.toString() || '',
          title: lc.title || 'Hotel Policy',
          text: lc.text || '',
          tier: lc.tier || 'SMALL',
          score: lexicalScore,
          origin: 'LEXICAL',
          exactMatchFound: false,
        });
      }
    });

    // 3. Compute Exact Match Bonuses
    for (const cand of candidatesMap.values()) {
      const textLower = cand.text.toLowerCase();
      const titleLower = cand.title.toLowerCase();

      // Check for exact phrase
      if (rawQuery.length > 5 && textLower.includes(queryLower)) {
        cand.score += 0.20;
        cand.exactMatchFound = true;
      }

      // Check for distinctive entity codes, numbers, prices, or times
      const matchedEntityTokens = distinctiveTokens.filter((token) =>
        textLower.includes(token) || titleLower.includes(token)
      );
      if (matchedEntityTokens.length > 0) {
        cand.score += 0.25;
        cand.exactMatchFound = true;
      }

      // Check for key topical terms in title (exclude generic stop-words and filler)
      const genericTerms = new Set(['hotel', 'resort', 'stay', 'guide', 'manual', 'compendium', 'collection', 'what', 'which', 'tell', 'about', 'policy', 'policies']);
      const topicalTerms = queryTerms.filter((term) => !genericTerms.has(term));
      const titleMatches = topicalTerms.filter((term) => titleLower.includes(term));
      if (titleMatches.length > 0) {
        cand.score += 0.15;
        cand.exactMatchFound = true;
      }
    }

    // Sort descending by final fused score
    return Array.from(candidatesMap.values()).sort((a, b) => b.score - a.score);
  }

  /**
   * Hydrates parent context for Small chunks by fetching their Medium or Large parent from MongoDB
   */
  private static async hydrateParentContext(candidates: RetrievedCandidate[]): Promise<RetrievedCandidate[]> {
    if (candidates.length === 0) return [];

    const validMongoIds: Types.ObjectId[] = [];
    const vectorIds: string[] = [];

    for (const c of candidates) {
      if (Types.ObjectId.isValid(c.chunkId)) {
        validMongoIds.push(new Types.ObjectId(c.chunkId));
      } else {
        vectorIds.push(c.chunkId);
      }
    }

    const queryConditions: any[] = [];
    if (validMongoIds.length > 0) {
      queryConditions.push({ _id: { $in: validMongoIds } });
    }
    if (vectorIds.length > 0) {
      queryConditions.push({ pineconeVectorId: { $in: vectorIds } });
    }

    if (queryConditions.length === 0) return candidates;

    const fullChunks = await KnowledgeChunk.find({ $or: queryConditions })
      .populate('parentId')
      .populate('grandParentId')
      .lean();

    const chunkMap = new Map<string, any>();
    fullChunks.forEach((fc) => {
      chunkMap.set(fc._id.toString(), fc);
      if (fc.pineconeVectorId) {
        chunkMap.set(fc.pineconeVectorId, fc);
      }
    });

    return candidates.map((c) => {
      const dbChunk = chunkMap.get(c.chunkId);
      if (!dbChunk) return c;

      // Ensure full text from DB is used rather than shortened snippet
      c.text = dbChunk.text || c.text;
      c.title = dbChunk.title || c.title;
      c.documentId = dbChunk.documentId ? dbChunk.documentId.toString() : c.documentId;

      // If this is a small chunk and has a parent medium or large chunk, attach hydrated parent text
      if (dbChunk.parentId && typeof dbChunk.parentId === 'object') {
        const parent = dbChunk.parentId as any;
        c.hydratedParentText = parent.text || '';
      } else if (dbChunk.grandParentId && typeof dbChunk.grandParentId === 'object') {
        const grandParent = dbChunk.grandParentId as any;
        c.hydratedParentText = grandParent.text || '';
      }

      return c;
    });
  }
}
