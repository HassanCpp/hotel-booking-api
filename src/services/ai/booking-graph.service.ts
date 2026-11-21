import {
  StateGraph,
  Annotation,
  MessagesAnnotation,
  MemorySaver,
  END,
  START,
} from '@langchain/langgraph';
import { ToolNode, toolsCondition } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  BaseMessage,
} from '@langchain/core/messages';
import { bookingTools, resolveProperty } from './booking-tools';
import { Property } from '../../models/Property';
import { ChatSession } from '../../models/ChatSession';
import { env } from '../../config/env';

/**
 * State definition for LangGraph Booking Agent
 */
export const BookingState = Annotation.Root({
  ...MessagesAnnotation.spec,
  propertyId: Annotation<string | undefined>,
  propertyName: Annotation<string | undefined>,
  sessionId: Annotation<string>,
});

/**
 * Shared in-memory checkpointer for conversational session continuity
 */
const checkpointer = new MemorySaver();

/**
 * Constructs a prompt grounding the booking concierge across all marketplace properties
 */
function buildBookingSystemPrompt(propertyName?: string, propertyId?: string): string {
  const todayStr = new Date().toISOString().split('T')[0];
  const activeFocus = propertyName && propertyName !== 'All Marketplace Stays'
    ? `You are currently focusing on "${propertyName}" (ID: ${propertyId}), but you have full platform-wide knowledge of all hotels and properties on our marketplace.`
    : `You are the master AI Concierge & Booking Assistant for our luxury Hotel Marketplace platform. You have complete knowledge of all participating hotels, destinations, room inventory, and policies.`;

  return `${activeFocus}
Today's Date: ${todayStr}.

YOUR CORE CAPABILITIES & DOMAIN TOOLS:
1. "discover_marketplace_properties": Discover and filter hotels by city (e.g. Lahore, Tokyo, Dubai), amenities (pool, wifi, pets), price, or keyword. Always call this when a guest asks what hotels are available, wants recommendations, or asks to compare properties.
2. "ask_property_policies_rag": Query verified hotel policies, house rules, dining hours, pool facilities, pet rules, parking, and Wi-Fi credentials across any or all properties.
3. "check_room_availability": Check available room types, unit counts, and live rates for requested stay dates and occupancy for any hotel. Always call this when dates or booking intentions are discussed.
4. "calculate_stay_quote": Calculate exact stay pricing (rates, taxes, discounts, promo codes like SUMMER2026).
5. "execute_reservation": Atomically create a direct reservation once guest contact details (Full Name, Email, Phone) and room selection are confirmed. Always pass a unique idempotencyKey.
6. "lookup_reservation": Check reservation status using booking reference (e.g. BK-XXXX) and guest email.
7. "cancel_reservation": Safely cancel a reservation and release inventory.

HOSPITALITY GUIDELINES:
- Warm, professional, first-person luxury concierge persona.
- You can assist guests with ANY hotel on the platform, compare properties, answer any house rules from verified RAG records, and guide them through direct booking.
- Never invent room inventory, rates, or booking references out of thin air. Always rely strictly on tool outputs.
- Once a guest chooses a hotel and dates, check availability, present room options clearly, and assist them through direct booking.`;
}

/**
 * Agent Node: invokes ChatOpenAI with bound tools
 */
async function callBookingModel(state: typeof BookingState.State) {
  const model = new ChatOpenAI({
    model: 'gpt-4o',
    temperature: 0.1,
    apiKey: env.OPENAI_API_KEY,
  });

  const modelWithTools = model.bindTools(bookingTools);

  const systemPrompt = buildBookingSystemPrompt(
    state.propertyName || 'All Marketplace Stays',
    state.propertyId || ''
  );

  const messages: BaseMessage[] = [new SystemMessage(systemPrompt), ...state.messages];
  const response = await modelWithTools.invoke(messages);

  return { messages: [response] };
}

/**
 * Build the compiled LangGraph workflow
 */
function createBookingGraph() {
  const toolNode = new ToolNode(bookingTools);

  const workflow = new StateGraph(BookingState)
    .addNode('agent', callBookingModel)
    .addNode('tools', toolNode)
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', toolsCondition, {
      tools: 'tools',
      __end__: END,
    })
    .addEdge('tools', 'agent');

  return workflow.compile({ checkpointer });
}

export const bookingAgentGraph = createBookingGraph();

export interface ProcessBookingParams {
  propertyId?: string;
  message: string;
  sessionId?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  clientIp?: string;
  userAgent?: string;
}

export interface ProcessBookingResponse {
  answer: string;
  sessionId: string;
  bookingAction?: {
    type: 'ROOMS_AVAILABLE' | 'QUOTE_GENERATED' | 'BOOKING_CONFIRMED' | 'BOOKING_CANCELLED' | 'GENERAL';
    data?: any;
  };
  toolCallsMade: string[];
  latencyMs: number;
}

/**
 * Service orchestrator running the LangGraph Booking Agent
 */
export class BookingGraphService {
  static async processGuestMessage(params: ProcessBookingParams): Promise<ProcessBookingResponse> {
    const startTime = Date.now();
    const sessionId = params.sessionId || `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Resolve property details if passed or default to platform-wide
    let property = null;
    if (params.propertyId) {
      property = await resolveProperty(params.propertyId);
    }
    const propertyName = property ? property.name : 'All Marketplace Stays';

    // Prepare message history
    const initialMessages: BaseMessage[] = [];
    if (params.history && Array.isArray(params.history)) {
      for (const h of params.history) {
        if (h.role === 'user') {
          initialMessages.push(new HumanMessage(h.content));
        } else if (h.role === 'assistant') {
          initialMessages.push(new AIMessage(h.content));
        }
      }
    }
    initialMessages.push(new HumanMessage(params.message));

    // Execute the LangGraph workflow
    const config = {
      configurable: {
        thread_id: sessionId,
      },
    };

    const finalState = await bookingAgentGraph.invoke(
      {
        messages: initialMessages,
        propertyId: property ? property._id.toString() : undefined,
        propertyName,
        sessionId,
      },
      config
    );

    // Extract latest response and tool activity
    const lastMessage = finalState.messages[finalState.messages.length - 1];
    let answerText = typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content);

    // Collect all tool calls made during this run
    const toolCallsMade: string[] = [];
    for (const msg of finalState.messages) {
      if ((msg as any).tool_calls && Array.isArray((msg as any).tool_calls)) {
        for (const tc of (msg as any).tool_calls) {
          if (tc.name) toolCallsMade.push(tc.name);
        }
      }
    }

    const latencyMs = Date.now() - startTime;

    // Detect booking actions to pass back to UI
    let bookingAction: ProcessBookingResponse['bookingAction'] = { type: 'GENERAL' };
    if (toolCallsMade.includes('execute_reservation')) {
      bookingAction = { type: 'BOOKING_CONFIRMED' };
    } else if (toolCallsMade.includes('cancel_reservation')) {
      bookingAction = { type: 'BOOKING_CANCELLED' };
    } else if (toolCallsMade.includes('calculate_stay_quote')) {
      bookingAction = { type: 'QUOTE_GENERATED' };
    } else if (toolCallsMade.includes('check_room_availability')) {
      bookingAction = { type: 'ROOMS_AVAILABLE' };
    }

    // Persist to ChatSession for Super Admin live surveillance
    try {
      let chatSession = await ChatSession.findOne({ sessionId });
      if (!chatSession) {
        chatSession = new ChatSession({
          sessionId,
          propertyId: property ? property._id : undefined,
          hotelAccountId: property ? property.hotelAccountId : undefined,
          ipAddress: params.clientIp || '127.0.0.1',
          userAgent: params.userAgent || 'Web Client',
          status: 'ACTIVE',
          messages: [],
        });
      }

      chatSession.messages.push({
        role: 'user',
        content: params.message,
        timestamp: new Date(),
      });

      chatSession.messages.push({
        role: 'assistant',
        content: answerText,
        route: 'BOOKING_INQUIRY',
        confidence: 'HIGH',
        latencyMs,
        citations: [],
        timestamp: new Date(),
      });

      chatSession.messageCount = chatSession.messages.length;
      chatSession.lastActivityAt = new Date();
      await chatSession.save();
    } catch (saveErr) {
      console.error('[BookingGraphService] Failed to persist surveillance turn:', saveErr);
    }

    return {
      answer: answerText,
      sessionId,
      bookingAction,
      toolCallsMade,
      latencyMs,
    };
  }
}
