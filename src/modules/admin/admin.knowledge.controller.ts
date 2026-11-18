import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../../types/auth.types';
import { AppError } from '../../middleware/errorHandler';
import { KnowledgeDocument } from '../../models/KnowledgeDocument';
import { KnowledgeChunk } from '../../models/KnowledgeChunk';
import { ChatSession } from '../../models/ChatSession';
import { DocumentIngestionService } from '../../services/ai/document-ingestion.service';
import { VectorService } from '../../services/ai/vector.service';

export class AdminKnowledgeController {
  /**
   * Super Admin: Upload platform-wide global knowledge document
   */
  public static async uploadGlobalDocument(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'SUPER_ADMIN') {
        throw new AppError('Super Admin permissions required', 403, 'FORBIDDEN');
      }

      if (!req.file) {
        throw new AppError('No file provided for upload', 400, 'FILE_REQUIRED');
      }

      const { title } = req.body;
      const docTitle = (title && title.trim()) || req.file.originalname.replace(/\.[^/.]+$/, '');

      const document = await DocumentIngestionService.ingest({
        file: {
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
        },
        title: docTitle,
        hotelAccountId: null, // Platform-wide global doc
        propertyId: null,
        uploadedBy: {
          userId: new Types.ObjectId(req.user.id),
          userRole: req.user.role,
          userEmail: req.user.email,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Global platform document uploaded and indexed successfully',
        data: document,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Super Admin: View all knowledge documents across all hotel tenants
   */
  public static async getAllDocuments(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'SUPER_ADMIN') {
        throw new AppError('Super Admin permissions required', 403, 'FORBIDDEN');
      }

      const { hotelAccountId, status, page = 1, limit = 50 } = req.query;

      const filter: Record<string, any> = {};
      if (hotelAccountId) {
        filter.hotelAccountId = hotelAccountId;
      }
      if (status) {
        filter.status = status;
      }

      const skip = (Number(page) - 1) * Number(limit);

      const [documents, total] = await Promise.all([
        KnowledgeDocument.find(filter)
          .populate('hotelAccountId', 'name slug email')
          .populate('propertyId', 'name city')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        KnowledgeDocument.countDocuments(filter),
      ]);

      res.status(200).json({
        success: true,
        data: {
          documents,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Super Admin: Inspect Pinecone vector index health & metrics
   */
  public static async getIndexHealth(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'SUPER_ADMIN') {
        throw new AppError('Super Admin permissions required', 403, 'FORBIDDEN');
      }

      const health = await VectorService.getIndexHealth();
      const totalMongoChunks = await KnowledgeChunk.countDocuments();
      const totalMongoDocs = await KnowledgeDocument.countDocuments();

      res.status(200).json({
        success: true,
        data: {
          pinecone: health,
          mongodb: {
            totalDocuments: totalMongoDocs,
            totalChunks: totalMongoChunks,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Super Admin: Delete any document platform-wide
   */
  public static async deleteAnyDocument(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'SUPER_ADMIN') {
        throw new AppError('Super Admin permissions required', 403, 'FORBIDDEN');
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      await DocumentIngestionService.deleteDocument(id);

      res.status(200).json({
        success: true,
        message: 'Document and vectors deleted successfully by Super Admin',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Super Admin Surveillance: List guest chat sessions platform-wide
   */
  public static async getChatSessions(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'SUPER_ADMIN') {
        throw new AppError('Super Admin permissions required', 403, 'FORBIDDEN');
      }

      const { propertyId, hotelAccountId, status, search, page = 1, limit = 20 } = req.query;

      const filter: Record<string, any> = {};
      if (propertyId) filter.propertyId = propertyId;
      if (hotelAccountId) filter.hotelAccountId = hotelAccountId;
      if (status) filter.status = status;

      if (search && typeof search === 'string') {
        const term = search.trim();
        filter.$or = [
          { sessionId: { $regex: term, $options: 'i' } },
          { guestEmail: { $regex: term, $options: 'i' } },
          { guestName: { $regex: term, $options: 'i' } },
          { ipAddress: { $regex: term, $options: 'i' } },
          { 'messages.content': { $regex: term, $options: 'i' } },
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);

      const [sessions, total] = await Promise.all([
        ChatSession.find(filter)
          .populate('propertyId', 'name city')
          .populate('hotelAccountId', 'name')
          .populate('guestId', 'fullName email')
          .select('-messages') // omit full transcript in list view for performance
          .sort({ lastActivityAt: -1 })
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        ChatSession.countDocuments(filter),
      ]);

      res.status(200).json({
        success: true,
        data: {
          sessions,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Super Admin Surveillance: View full session transcript and citations
   */
  public static async getChatSessionById(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'SUPER_ADMIN') {
        throw new AppError('Super Admin permissions required', 403, 'FORBIDDEN');
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      let session = await ChatSession.findById(id)
        .populate('propertyId', 'name city address')
        .populate('hotelAccountId', 'name slug email')
        .lean();

      if (!session) {
        // Fallback to find by sessionId string
        session = await ChatSession.findOne({ sessionId: id })
          .populate('propertyId', 'name city address')
          .populate('hotelAccountId', 'name slug email')
          .lean();
      }

      if (!session) {
        throw new AppError('Chat session not found', 404, 'SESSION_NOT_FOUND');
      }

      res.status(200).json({
        success: true,
        data: session,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Super Admin: Update chat session status (e.g. Flag or Resolve)
   */
  public static async updateChatSessionStatus(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'SUPER_ADMIN') {
        throw new AppError('Super Admin permissions required', 403, 'FORBIDDEN');
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { status, flagReason } = req.body;

      let session = null;
      if (Types.ObjectId.isValid(id)) {
        session = await ChatSession.findByIdAndUpdate(
          id,
          {
            $set: {
              status,
              flagReason: status === 'FLAGGED' ? flagReason || 'FLAGGED_BY_ADMIN' : null,
            },
          },
          { new: true }
        );
      }
      if (!session) {
        session = await ChatSession.findOneAndUpdate(
          { sessionId: id },
          {
            $set: {
              status,
              flagReason: status === 'FLAGGED' ? flagReason || 'FLAGGED_BY_ADMIN' : null,
            },
          },
          { new: true }
        );
      }

      if (!session) {
        throw new AppError('Chat session not found', 404, 'SESSION_NOT_FOUND');
      }

      res.status(200).json({
        success: true,
        message: 'Chat session status updated successfully',
        data: session,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Super Admin: Delete chat session
   */
  public static async deleteChatSession(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'SUPER_ADMIN') {
        throw new AppError('Super Admin permissions required', 403, 'FORBIDDEN');
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      let session = null;
      if (Types.ObjectId.isValid(id)) {
        session = await ChatSession.findByIdAndDelete(id);
      }
      if (!session) {
        session = await ChatSession.findOneAndDelete({ sessionId: id });
      }

      res.status(200).json({
        success: true,
        message: 'Chat session deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
