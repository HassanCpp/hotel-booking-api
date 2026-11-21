import { Request, Response, NextFunction } from 'express';
import { Property } from '../../models/Property';
import { ChatSession } from '../../models/ChatSession';
import { RagPipelineService } from '../../services/ai/rag-pipeline.service';
import { AppError } from '../../middleware/errorHandler';
import { AuthRequest } from '../../types/auth.types';

export class MarketplaceKnowledgeController {
  /**
   * Public guest concierge endpoint: Ask question about a specific property
   * Automatically persists conversation history, IP, and citations for Super Admin surveillance.
   */
  public static async askPropertyConcierge(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { propertyId } = req.params;
      const { query, history, sessionId: clientSessionId } = req.body;

      if (!query || typeof query !== 'string' || !query.trim()) {
        throw new AppError('Query string is required', 400, 'QUERY_REQUIRED');
      }

      const property = await Property.findById(propertyId).lean();
      if (!property) {
        throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
      }

      const hotelAccountId = property.hotelAccountId ? property.hotelAccountId.toString() : undefined;

      // 1. Run RAG Pipeline
      const result = await RagPipelineService.ask({
        query: query.trim(),
        hotelAccountId,
        propertyId: property._id.toString(),
        propertyName: property.name,
        history: Array.isArray(history) ? history : [],
      });

      // 2. Resolve Session Identifier
      const sessionId =
        (clientSessionId && String(clientSessionId).trim()) ||
        (req.headers['x-session-id'] as string) ||
        `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // 3. Extract Client Metadata for Surveillance
      const authReq = req as AuthRequest;
      const guestUser = authReq.user;
      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.ip ||
        req.socket.remoteAddress ||
        'Unknown IP';
      const userAgent = req.headers['user-agent'] || 'Unknown Client';

      // 4. Record Messages in ChatSession
      const userMessage = {
        role: 'user' as const,
        content: query.trim(),
        timestamp: new Date(),
      };

      const assistantMessage = {
        role: 'assistant' as const,
        content: result.answer,
        route: result.route,
        confidence: result.confidence,
        citations: result.citations.map((c) => ({
          documentId: c.documentId,
          title: c.title,
          snippet: c.snippet,
          tier: c.tier,
        })),
        latencyMs: result.latencyMs,
        timestamp: new Date(),
      };

      // Determine flag condition (e.g. if fallback triggered or out of scope)
      const isFallback = result.confidence === 'FALLBACK';
      const isOutOfScope = result.route === 'OUT_OF_SCOPE';

      let session = await ChatSession.findOne({ sessionId });
      if (!session) {
        session = new ChatSession({
          sessionId,
          guestId: guestUser ? guestUser.id : null,
          guestEmail: guestUser ? guestUser.email : null,
          guestName: guestUser ? guestUser.fullName : null,
          propertyId: property._id,
          hotelAccountId: property.hotelAccountId || null,
          ipAddress: clientIp,
          userAgent,
          status: isFallback ? 'FLAGGED' : 'ACTIVE',
          flagReason: isFallback
            ? 'UNVERIFIED_POLICY_FALLBACK'
            : isOutOfScope
            ? 'OUT_OF_SCOPE_INQUIRY'
            : null,
          messages: [userMessage, assistantMessage],
          messageCount: 2,
          lastActivityAt: new Date(),
        });
      } else {
        session.messages.push(userMessage, assistantMessage);
        session.messageCount = session.messages.length;
        session.lastActivityAt = new Date();
        if (guestUser && !session.guestId) {
          session.guestId = guestUser.id as any;
          session.guestEmail = guestUser.email;
          session.guestName = guestUser.fullName;
        }
        if (isFallback && session.status !== 'FLAGGED') {
          session.status = 'FLAGGED';
          session.flagReason = 'UNVERIFIED_POLICY_FALLBACK';
        }
      }

      await session.save();

      // 5. Return grounded response with active sessionId
      res.status(200).json({
        success: true,
        data: {
          ...result,
          sessionId,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Autonomous LangGraph AI Booking Concierge:
   * Multi-turn conversational booking assistant executing availability checks,
   * rate quotes, atomic reservations, status lookups, and cancellations.
   */
  public static async bookWithAgent(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const propertyId = req.params.propertyId || req.body.propertyId;
      const { message, query, history, sessionId: clientSessionId } = req.body;
      const userMessage = message || query;

      if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
        throw new AppError('Message is required for AI booking agent', 400, 'MESSAGE_REQUIRED');
      }

      let resolvedPropertyId: string | undefined = undefined;
      if (propertyId && typeof propertyId === 'string' && propertyId.trim()) {
        const { resolveProperty } = await import('../../services/ai/booking-tools');
        const prop = await resolveProperty(propertyId);
        if (prop) {
          resolvedPropertyId = prop._id.toString();
        }
      }

      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.ip ||
        req.socket.remoteAddress ||
        '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Web Client';

      const { BookingGraphService } = await import('../../services/ai/booking-graph.service');

      const result = await BookingGraphService.processGuestMessage({
        propertyId: resolvedPropertyId,
        message: userMessage.trim(),
        sessionId: clientSessionId,
        history: Array.isArray(history) ? history : [],
        clientIp,
        userAgent,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
