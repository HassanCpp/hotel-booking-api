import { OpenAI } from 'openai';
import { env } from '../../config/env';
import { RetrievedCandidate } from './hybrid-retriever.service';
import { ChatMessage } from './preflight.service';

export interface Citation {
  documentId: string;
  title: string;
  snippet: string;
  tier: string;
}

export interface RagResponse {
  answer: string;
  citations: Citation[];
  confidence: 'HIGH' | 'MEDIUM' | 'FALLBACK';
  passNumber?: 1 | 2;
}

export class RagGeneratorService {
  private static getOpenAI(): OpenAI {
    return new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  /**
   * Deterministically trims context to fit within token budget (drops entire blocks from the end)
   */
  public static trimContextToTokenBudget(
    candidates: RetrievedCandidate[],
    maxTokens: number = 2500
  ): { trimmedCandidates: RetrievedCandidate[]; contextText: string } {
    let currentTokens = 0;
    const accepted: RetrievedCandidate[] = [];
    const blocks: string[] = [];

    for (const c of candidates) {
      // Use hydrated parent text if available, otherwise direct chunk text
      const content = c.hydratedParentText && c.hydratedParentText.length > c.text.length
        ? c.hydratedParentText
        : c.text;

      const blockText = `[SECTION: ${c.title}]\n${content}`;
      const estimatedTokens = Math.ceil(blockText.length / 4);

      if (currentTokens + estimatedTokens > maxTokens && accepted.length > 0) {
        break;
      }

      currentTokens += estimatedTokens;
      accepted.push(c);
      blocks.push(blockText);
    }

    return {
      trimmedCandidates: accepted,
      contextText: blocks.join('\n\n---\n\n'),
    };
  }

  /**
   * Generates a grounded, luxury hotel concierge response
   */
  public static async generateAnswer(params: {
    query: string;
    propertyName?: string;
    candidates: RetrievedCandidate[];
    history?: ChatMessage[];
    passNumber?: 1 | 2;
  }): Promise<RagResponse> {
    const { query, propertyName = 'Our Hotel', candidates, history = [], passNumber = 1 } = params;

    const { trimmedCandidates, contextText } = this.trimContextToTokenBudget(candidates, 2500);

    const systemPrompt = `You are the Virtual Concierge for "${propertyName}".
You provide guests with warm, elegant, accurate, and helpful answers regarding the hotel's amenities, policies, dining, check-in, and services.

STRICT OPERATIONAL RULES:
1. Grounding: Rely EXCLUSIVELY on the provided VERIFIED HOTEL KNOWLEDGE below. Never fabricate fees, rules, hours, or amenities.
2. Missing Amenities: If a guest asks about an amenity, service, or policy that is NOT mentioned in the verified knowledge base (e.g. heated pool, EV charging, airport shuttle), politely inform them that this specific amenity or service is not listed for this property, and invite them to confirm with our front desk upon arrival.
3. Tone & Style: Refined, hospitable, warm, and concise. Speak directly in the first person ("We offer...", "Our check-in begins at...").
4. ANTI-META LANGUAGE BAN: You are STRICTLY FORBIDDEN from using meta-phrases such as:
   - "According to the provided document..."
   - "Based on the text above..."
   - "The context does not state..."
   - "As an AI..."
5. Currency & Numbers: State exact fees, percentages, and times precisely as recorded in the knowledge base.

VERIFIED HOTEL KNOWLEDGE:
${contextText || '(No specific knowledge documents found)'}`;

    const messages: any[] = [{ role: 'system', content: systemPrompt }];

    // Add recent history for context
    const recentHistory = history.slice(-4);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      });
    }

    messages.push({ role: 'user', content: query });

    try {
      const openai = this.getOpenAI();
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        temperature: 0.2,
        max_tokens: 600,
      });

      const rawAnswer = completion.choices[0]?.message?.content || '';

      // Citation Suppression Rules (from fervent-curie-2):
      // Rule 1: If answer indicates refusal or lack of knowledge, suppress citations.
      const isRefusal = this.checkIfRefusal(rawAnswer);
      if (isRefusal) {
        return {
          answer: rawAnswer,
          citations: [],
          confidence: 'FALLBACK',
          passNumber,
        };
      }

      // Rule 2: Only attach citations that have lexical overlap with the generated answer
      const verifiedCitations = this.filterCitationsByLexicalOverlap(rawAnswer, trimmedCandidates);

      return {
        answer: rawAnswer,
        citations: verifiedCitations,
        confidence: passNumber === 1 ? 'HIGH' : 'MEDIUM',
        passNumber,
      };
    } catch (err: any) {
      console.error('Answer generation error:', err);
      return {
        answer: `I apologize for the inconvenience. Our concierge system is temporarily unable to retrieve this policy. Please feel free to inquire with our front desk directly.`,
        citations: [],
        confidence: 'FALLBACK',
        passNumber,
      };
    }
  }

  /**
   * Detects if the generated answer is a refusal, fallback, or out-of-scope notice
   */
  private static checkIfRefusal(answer: string): boolean {
    const refusalPatterns = [
      /not (?:listed|mentioned|stated|found|specified) in (?:our|the) (?:knowledge|records|compendium|manual|policies|system)/i,
      /is not listed for (?:this|our|the) property/i,
      /do not have (?:information|details|record|records) (?:regarding|about|on|for)/i,
      /unable to (?:find|provide|confirm|locate) (?:information|details|specifics)/i,
      /I apologize, but (?:the .* is not listed|we do not have|there is no record)/i,
      /(?:please|feel free to) (?:inquire|check) (?:directly )?with (?:our|the) front desk (?:team )?to confirm/i,
    ];
    return refusalPatterns.some((pattern) => pattern.test(answer));
  }

  /**
   * Filters citations ensuring only sections with substantive lexical overlap to the answer are attached
   */
  private static filterCitationsByLexicalOverlap(
    answer: string,
    candidates: RetrievedCandidate[]
  ): Citation[] {
    const answerWords = new Set(
      answer
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length >= 4)
    );

    const validCitations: Citation[] = [];
    const seenTitles = new Set<string>();

    for (const cand of candidates) {
      if (seenTitles.has(cand.title)) continue;

      // Extract significant words from candidate
      const candWords = cand.text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length >= 4);

      // Count overlap
      let overlapCount = 0;
      for (const cw of candWords) {
        if (answerWords.has(cw)) {
          overlapCount++;
        }
      }

      // If at least 3 significant words overlap, include citation
      if (overlapCount >= 3) {
        seenTitles.add(cand.title);
        validCitations.push({
          documentId: cand.documentId,
          title: cand.title,
          snippet: cand.text.slice(0, 250) + (cand.text.length > 250 ? '...' : ''),
          tier: cand.tier,
        });
      }
    }

    return validCitations.slice(0, 3);
  }
}
