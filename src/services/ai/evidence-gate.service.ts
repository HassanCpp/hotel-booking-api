import { RetrievedCandidate, HybridRetriever } from './hybrid-retriever.service';

export interface GateDecision {
  canAnswer: boolean;
  passNumber: 1 | 2;
  topScore: number;
  reason?: string;
  candidates: RetrievedCandidate[];
}

export class EvidenceGateService {
  /**
   * Evaluates retrieved candidates against multi-signal evidence grounding criteria.
   * If Pass 1 fails, automatically triggers Pass 2 with expanded search bounds.
   */
  public static async gate(params: {
    query: string;
    hotelAccountId?: string;
    propertyId?: string;
    initialCandidates: RetrievedCandidate[];
    exactMatchFound: boolean;
    topScore: number;
  }): Promise<GateDecision> {
    const { query, hotelAccountId, propertyId, initialCandidates, exactMatchFound, topScore } = params;

    // Check Pass 1 criteria
    const pass1Decision = this.checkPassCriteria(initialCandidates, exactMatchFound, topScore, 1);
    if (pass1Decision.canAnswer) {
      return pass1Decision;
    }

    // Trigger Pass 2 Retry (Expanded topK, relaxed constraints)
    try {
      const pass2Result = await HybridRetriever.retrieve({
        query,
        hotelAccountId,
        propertyId,
        topK: 12,
      });

      const pass2Decision = this.checkPassCriteria(
        pass2Result.candidates,
        pass2Result.exactMatchFound,
        pass2Result.topScore,
        2
      );

      return pass2Decision;
    } catch (err) {
      console.warn('Pass 2 retrieval error, defaulting to Pass 1 rejection:', err);
      return pass1Decision;
    }
  }

  /**
   * Multi-signal grounding check:
   * 1. Exact Match Signal (literal phrase, title, or entity hit) -> Immediate PASS
   * 2. Hybrid Hit Signal (candidate appeared in BOTH Vector and Lexical channels) -> Immediate PASS
   * 3. Fusion Score Signal (score >= 0.030) -> PASS
   */
  private static checkPassCriteria(
    candidates: RetrievedCandidate[],
    exactMatchFound: boolean,
    topScore: number,
    passNumber: 1 | 2
  ): GateDecision {
    if (candidates.length === 0) {
      return {
        canAnswer: false,
        passNumber,
        topScore: 0,
        reason: 'NO_EVIDENCE_FOUND',
        candidates: [],
      };
    }

    // Signal 1: Exact Match Found
    if (exactMatchFound) {
      return {
        canAnswer: true,
        passNumber,
        topScore,
        candidates,
      };
    }

    // Signal 2: Hybrid Channel Hit (matched in both Pinecone vector and Mongo lexical)
    const hasHybrid = candidates.some((c) => c.origin === 'HYBRID');
    if (hasHybrid) {
      return {
        canAnswer: true,
        passNumber,
        topScore,
        candidates,
      };
    }

    // Signal 3: RRF score threshold
    // With kRRF=50, a rank-0 vector match yields ~0.0196. Threshold 0.018 ensures solid top-rank candidates pass Pass 1.
    const threshold = passNumber === 1 ? 0.018 : 0.012;
    if (topScore >= threshold) {
      return {
        canAnswer: true,
        passNumber,
        topScore,
        candidates,
      };
    }

    return {
      canAnswer: false,
      passNumber,
      topScore,
      reason: 'INSUFFICIENT_EVIDENCE',
      candidates,
    };
  }
}
