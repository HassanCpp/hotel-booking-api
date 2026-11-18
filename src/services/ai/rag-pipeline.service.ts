import { PreflightService, ChatMessage } from './preflight.service';
import { HybridRetriever } from './hybrid-retriever.service';
import { EvidenceGateService } from './evidence-gate.service';
import { RagGeneratorService, RagResponse } from './rag-generator.service';

export interface AskHotelParams {
  query: string;
  hotelAccountId?: string;
  propertyId?: string;
  propertyName?: string;
  history?: ChatMessage[];
}

export interface AskHotelResult extends RagResponse {
  route: string;
  rewrittenQuery?: string;
  latencyMs: number;
}

export class RagPipelineService {
  /**
   * Main entrypoint for asking questions about a hotel / property.
   * Runs the complete 7-stage defensive RAG pipeline.
   */
  public static async ask(params: AskHotelParams): Promise<AskHotelResult> {
    const startTime = Date.now();
    const { query, hotelAccountId, propertyId, propertyName = 'Our Property', history = [] } = params;

    // 1. Stage 1: Preflight Classification & Query Rewriting
    const preflight = await PreflightService.analyze(query, history, propertyName);

    // Fast-path for small talk and out-of-scope queries
    if (preflight.route === 'SMALL_TALK' || preflight.route === 'OUT_OF_SCOPE') {
      return {
        answer: preflight.directAnswer || 'Hello! How may I assist you with your stay today?',
        citations: [],
        confidence: 'HIGH',
        route: preflight.route,
        rewrittenQuery: preflight.rewrittenQuery,
        latencyMs: Date.now() - startTime,
      };
    }

    const searchQuery = preflight.rewrittenQuery || query;

    // 2. Stage 2 & 3: Dual-Channel Hybrid Retrieval (Vector + Lexical)
    const retrieval = await HybridRetriever.retrieve({
      query: searchQuery,
      hotelAccountId,
      propertyId,
      topK: 6,
    });

    // 3. Stage 4 & 5: Evidence Gating & 2-Pass Retry
    const gate = await EvidenceGateService.gate({
      query: searchQuery,
      hotelAccountId,
      propertyId,
      initialCandidates: retrieval.candidates,
      exactMatchFound: retrieval.exactMatchFound,
      topScore: retrieval.topScore,
    });

    // If evidence is insufficient even after Pass 2 retry, return polite grounded fallback
    if (!gate.canAnswer) {
      return {
        answer: `I apologize, but we do not have specific verified policy details regarding that for ${propertyName}. Please inquire directly with our front desk team upon check-in, and they will be delighted to assist you.`,
        citations: [],
        confidence: 'FALLBACK',
        route: 'PROPERTY_INQUIRY',
        rewrittenQuery: searchQuery,
        passNumber: gate.passNumber,
        latencyMs: Date.now() - startTime,
      };
    }

    // 4. Stage 6 & 7: Context-Budgeted Generation & Citation Verification
    const generated = await RagGeneratorService.generateAnswer({
      query: searchQuery,
      propertyName,
      candidates: gate.candidates,
      history,
      passNumber: gate.passNumber,
    });

    return {
      ...generated,
      route: 'PROPERTY_INQUIRY',
      rewrittenQuery: searchQuery,
      latencyMs: Date.now() - startTime,
    };
  }
}
