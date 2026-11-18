import { OpenAI } from 'openai';
import { env } from '../../config/env';

export type PreflightRoute = 'SMALL_TALK' | 'OUT_OF_SCOPE' | 'PROPERTY_INQUIRY';

export interface PreflightResult {
  route: PreflightRoute;
  rewrittenQuery: string;
  isFollowUp: boolean;
  intentSummary: string;
  directAnswer?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class PreflightService {
  private static getOpenAI(): OpenAI {
    return new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  /**
   * Preflight classification & query rewriting.
   * Resolves conversational references, classifies intent, and short-circuits small talk.
   */
  public static async analyze(
    rawQuery: string,
    history: ChatMessage[] = [],
    propertyName?: string
  ): Promise<PreflightResult> {
    const trimmed = rawQuery.trim();
    if (!trimmed) {
      return {
        route: 'SMALL_TALK',
        rewrittenQuery: '',
        isFollowUp: false,
        intentSummary: 'Empty query',
        directAnswer: 'Hello! How may I assist you with your stay today?',
      };
    }

    const openai = this.getOpenAI();

    // System prompt enforcing strict classification and query disambiguation
    const systemPrompt = `You are the Preflight Query Router for a luxury hotel customer concierge AI.
Target Property: ${propertyName || 'Hotel'}

Your tasks:
1. Classify the user message into one of three routes:
   - "SMALL_TALK": Greetings, compliments, pleasantries, goodbyes, questions about who you are (e.g., "hi", "thanks", "who are you?").
   - "OUT_OF_SCOPE": Queries completely unrelated to hotels, hospitality, travel, rooms, dining, or property services (e.g., "write python code", "who won the championship", "recipe for lasagna").
   - "PROPERTY_INQUIRY": Any question regarding hotel amenities, policies, check-in/out, fees, parking, dining, room types, pet rules, breakfast, pool, cancellation, or local travel advice.

2. Query Disambiguation & Rewriting:
   - If the user uses pronouns or follow-up references (e.g. "is it heated?", "how much is that?"), use the conversation history to replace pronouns with the exact entity mentioned previously.
   - If the user provides a bare noun (e.g. "parking", "pool", "breakfast"), rewrite it into an explicit information request (e.g. "What are the parking options, rules, and valet fees?").
   - If the query is already explicit, keep it clear and direct.

3. Fast Direct Answer:
   - If route is "SMALL_TALK", provide a warm, 1-2 sentence luxury hotel concierge greeting or acknowledgment in "directAnswer".
   - If route is "OUT_OF_SCOPE", provide a polite 1-sentence deflection in "directAnswer" reminding the guest that you specialize in hotel services and policies.

Return ONLY a strict JSON object with this exact shape:
{
  "route": "SMALL_TALK" | "OUT_OF_SCOPE" | "PROPERTY_INQUIRY",
  "rewrittenQuery": "string",
  "isFollowUp": boolean,
  "intentSummary": "string",
  "directAnswer": "string | null"
}`;

    try {
      const messages: any[] = [{ role: 'system', content: systemPrompt }];

      // Include up to 6 recent messages from history
      const recentHistory = history.slice(-6);
      for (const msg of recentHistory) {
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        });
      }

      messages.push({ role: 'user', content: trimmed });

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 250,
      });

      const content = completion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      return {
        route: parsed.route || 'PROPERTY_INQUIRY',
        rewrittenQuery: parsed.rewrittenQuery || trimmed,
        isFollowUp: Boolean(parsed.isFollowUp),
        intentSummary: parsed.intentSummary || '',
        directAnswer: parsed.directAnswer || undefined,
      };
    } catch (err) {
      console.error('Preflight analysis error, falling back to PROPERTY_INQUIRY:', err);
      return {
        route: 'PROPERTY_INQUIRY',
        rewrittenQuery: trimmed,
        isFollowUp: false,
        intentSummary: 'Fallback',
      };
    }
  }
}
