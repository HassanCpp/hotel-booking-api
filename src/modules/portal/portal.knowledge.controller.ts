import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../../types/auth.types';
import { AppError } from '../../middleware/errorHandler';
import { KnowledgeDocument } from '../../models/KnowledgeDocument';
import { KnowledgeChunk } from '../../models/KnowledgeChunk';
import { Property } from '../../models/Property';
import { DocumentIngestionService } from '../../services/ai/document-ingestion.service';
import { RagPipelineService } from '../../services/ai/rag-pipeline.service';

export class PortalKnowledgeController {
  /**
   * Upload and ingest a .txt or searchable .pdf document for the tenant
   */
  public static async uploadDocument(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }
      if (!req.hotelAccountId && req.user.role !== 'SUPER_ADMIN') {
        throw new AppError('Tenant context required', 401, 'UNAUTHORIZED');
      }

      if (!req.file) {
        throw new AppError('No file provided for upload', 400, 'FILE_REQUIRED');
      }

      const { title, propertyId } = req.body;
      const docTitle = (title && title.trim()) || req.file.originalname.replace(/\.[^/.]+$/, '');

      let validatedPropertyId: Types.ObjectId | undefined = undefined;
      let targetHotelAccountId = req.hotelAccountId || null;

      // If propertyId is passed, verify property exists
      if (propertyId && propertyId !== 'ALL' && propertyId !== 'null' && propertyId !== '') {
        const propFilter: any = { _id: propertyId };
        if (req.hotelAccountId) {
          propFilter.hotelAccountId = req.hotelAccountId;
        }
        const prop = await Property.findOne(propFilter);

        if (!prop) {
          throw new AppError('Specified property does not exist', 404, 'PROPERTY_NOT_FOUND');
        }
        validatedPropertyId = prop._id;
        if (!targetHotelAccountId && prop.hotelAccountId) {
          targetHotelAccountId = prop.hotelAccountId as any;
        }
      }

      const document = await DocumentIngestionService.ingest({
        file: {
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
        },
        title: docTitle,
        hotelAccountId: targetHotelAccountId,
        propertyId: validatedPropertyId || null,
        uploadedBy: {
          userId: new Types.ObjectId(req.user.id),
          userRole: req.user.role,
          userEmail: req.user.email,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Knowledge document uploaded and indexed successfully',
        data: document,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List all knowledge documents belonging to the authenticated hotel account
   */
  public static async getDocuments(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.hotelAccountId && req.user?.role !== 'SUPER_ADMIN') {
        throw new AppError('Tenant context required', 401, 'UNAUTHORIZED');
      }

      const filter: Record<string, any> = {};
      if (req.hotelAccountId) {
        filter.hotelAccountId = req.hotelAccountId;
      }

      const documents = await KnowledgeDocument.find(filter)
        .populate('propertyId', 'name city')
        .sort({ createdAt: -1 })
        .lean();

      res.status(200).json({
        success: true,
        data: documents,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Inspect parsed 3-tier chunks for a specific document
   */
  public static async getDocumentChunks(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.hotelAccountId && req.user?.role !== 'SUPER_ADMIN') {
        throw new AppError('Tenant context required', 401, 'UNAUTHORIZED');
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const docFilter: any = { _id: id };
      if (req.hotelAccountId) {
        docFilter.hotelAccountId = req.hotelAccountId;
      }

      const document = await KnowledgeDocument.findOne(docFilter)
        .populate('propertyId', 'name city')
        .lean();

      if (!document) {
        throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
      }

      const chunks = await KnowledgeChunk.find({ documentId: id })
        .sort({ tier: 1, chunkIndex: 1 })
        .lean();

      res.status(200).json({
        success: true,
        data: {
          document,
          chunks,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a knowledge document, its chunks, and all associated Pinecone vectors
   */
  public static async deleteDocument(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.hotelAccountId && req.user?.role !== 'SUPER_ADMIN') {
        throw new AppError('Tenant context required', 401, 'UNAUTHORIZED');
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const docFilter: any = { _id: id };
      if (req.hotelAccountId) {
        docFilter.hotelAccountId = req.hotelAccountId;
      }

      const document = await KnowledgeDocument.findOne(docFilter);

      if (!document) {
        throw new AppError('Document not found or does not belong to your account', 404, 'DOCUMENT_NOT_FOUND');
      }

      await DocumentIngestionService.deleteDocument(id);

      res.status(200).json({
        success: true,
        message: 'Document, chunks, and vector embeddings successfully deleted',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Knowledge Base Simulator: Test query against tenant's knowledge base
   */
  public static async testQuery(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.hotelAccountId && req.user?.role !== 'SUPER_ADMIN') {
        throw new AppError('Tenant context required', 401, 'UNAUTHORIZED');
      }

      const { query, propertyId } = req.body;
      if (!query || typeof query !== 'string' || !query.trim()) {
        throw new AppError('Query is required', 400, 'QUERY_REQUIRED');
      }

      let propertyName: string | undefined = undefined;
      let validPropId: string | undefined = undefined;
      let targetHotelAccountId = req.hotelAccountId ? req.hotelAccountId.toString() : undefined;

      if (propertyId && propertyId !== 'ALL') {
        const propFilter: any = { _id: propertyId };
        if (req.hotelAccountId) {
          propFilter.hotelAccountId = req.hotelAccountId;
        }
        const prop = await Property.findOne(propFilter);
        if (prop) {
          propertyName = prop.name;
          validPropId = prop._id.toString();
          if (!targetHotelAccountId && prop.hotelAccountId) {
            targetHotelAccountId = prop.hotelAccountId.toString();
          }
        }
      }

      const result = await RagPipelineService.ask({
        query: query.trim(),
        hotelAccountId: targetHotelAccountId,
        propertyId: validPropId,
        propertyName: propertyName || req.user?.hotelAccountName || 'Our Hotel',
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
