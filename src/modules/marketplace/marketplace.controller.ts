import { Request, Response, NextFunction } from 'express';
import mongoose, { Types } from 'mongoose';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Property } from '../../models/Property';
import { RoomType } from '../../models/RoomType';
import { HotelAccount } from '../../models/HotelAccount';
import { Policy } from '../../models/Policy';
import { Booking } from '../../models/Booking';
import { Review } from '../../models/Review';
import { User } from '../../models/User';
import { PromoCode } from '../../models/PromoCode';
import { AppError } from '../../middleware/errorHandler';
import { checkAvailability, reserveRooms } from '../../utils/availability';
import { calculateStayPricing, normalizeDate } from '../../utils/rateEngine';
import { generateBookingReference } from '../../utils/bookingReference';
import { sendBookingConfirmationEmail } from '../../utils/email';
import { logActivity } from '../../utils/logActivity';
import { FeaturedDestination } from '../../models/FeaturedDestination';
import { resolveVisitorLocation } from '../../utils/geo';

export class MarketplaceController {
  /**
   * Search and filter published properties across all active hotels.
   */
  static async searchProperties(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        city,
        checkIn,
        checkOut,
        adults,
        children,
        minPrice,
        maxPrice,
        propertyType,
        amenities,
        minRating,
        starRating,
        sortBy = 'recommended',
        page = '1',
        limit = '12',
      } = req.query as Record<string, string>;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
      const skip = (pageNum - 1) * limitNum;

      // 1. Get all active HotelAccounts
      const activeHotels = await HotelAccount.find({ status: 'ACTIVE' }).select('_id').lean();
      const activeHotelIds = activeHotels.map((h) => h._id);

      // 2. Build property query
      const query: any = {
        status: 'PUBLISHED',
        hotelAccountId: { $in: activeHotelIds },
      };

      if (city && city.trim()) {
        query['address.city'] = { $regex: new RegExp(`^${city.trim()}`, 'i') };
      }

      if (propertyType && propertyType.trim()) {
        const types = propertyType.split(',').map((t) => t.trim().toUpperCase());
        query.propertyType = { $in: types };
      }

      if (starRating) {
        const stars = starRating.split(',').map((s) => parseInt(s.trim(), 10)).filter(Boolean);
        if (stars.length > 0) {
          query.starRating = { $in: stars };
        }
      }

      if (minRating) {
        const ratingVal = parseFloat(minRating);
        if (!isNaN(ratingVal)) {
          query.averageRating = { $gte: ratingVal };
        }
      }

      if (amenities && amenities.trim()) {
        const amenityList = amenities.split(',').map((a) => a.trim());
        query.amenities = { $all: amenityList };
      }

      // Sort criteria
      let sort: any = { isGuestFavorite: -1, averageRating: -1, createdAt: -1 };
      if (sortBy === 'rating') {
        sort = { averageRating: -1, reviewCount: -1 };
      } else if (sortBy === 'newest') {
        sort = { createdAt: -1 };
      }

      // Find matching properties
      const totalCount = await Property.countDocuments(query);
      const properties = await Property.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean();

      // Enrich properties with starting price and room availability
      const enrichedProperties = await Promise.all(
        properties.map(async (prop) => {
          const roomQuery: any = {
            propertyId: prop._id,
            isActive: true,
          };

          if (adults) {
            const adultNum = parseInt(adults, 10) || 1;
            roomQuery['maxOccupancy.adults'] = { $gte: adultNum };
          }

          const rooms = await RoomType.find(roomQuery)
            .sort({ basePricePerNight: 1 })
            .select('basePricePerNight totalUnits name category')
            .lean();

          const startingPrice = rooms.length > 0 ? rooms[0].basePricePerNight : 0;

          return {
            ...prop,
            startingPrice,
            availableRoomTypesCount: rooms.length,
          };
        })
      );

      // Filter by min/max price if specified
      let finalResults = enrichedProperties;
      if (minPrice || maxPrice) {
        const min = minPrice ? parseFloat(minPrice) : 0;
        const max = maxPrice ? parseFloat(maxPrice) : Infinity;
        finalResults = enrichedProperties.filter(
          (p) => p.startingPrice >= min && p.startingPrice <= max
        );
      }

      // Price sorting if requested
      if (sortBy === 'price_low') {
        finalResults.sort((a, b) => a.startingPrice - b.startingPrice);
      } else if (sortBy === 'price_high') {
        finalResults.sort((a, b) => b.startingPrice - a.startingPrice);
      }

      res.status(200).json({
        success: true,
        data: {
          properties: finalResults,
          pagination: {
            page: pageNum,
            limit: limitNum,
            totalCount,
            totalPages: Math.ceil(totalCount / limitNum),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get property detail by public URL slug.
   */
  static async getPropertyBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const slugStr = String(req.params.slug).toLowerCase();

      const property = await Property.findOne({ slug: slugStr, status: 'PUBLISHED' })
        .populate('hotelAccountId', 'name slug country currency timezone')
        .lean();

      if (!property) {
        throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
      }

      // Fetch policies
      const policies = await Policy.findOne({ propertyId: property._id }).lean();

      res.status(200).json({
        success: true,
        data: {
          property,
          policies: policies || null,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get available room types with live pricing for selected dates.
   */
  static async getAvailableRooms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const slugStr = String(req.params.slug).toLowerCase();
      const { checkIn, checkOut, adults = '1', children = '0', rooms = '1' } = req.query as Record<
        string,
        string
      >;

      const property = await Property.findOne({ slug: slugStr, status: 'PUBLISHED' }).lean();
      if (!property) {
        throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
      }

      const adultNum = Math.max(1, parseInt(adults, 10) || 1);
      const childNum = Math.max(0, parseInt(children, 10) || 0);
      const roomNum = Math.max(1, parseInt(rooms, 10) || 1);

      const allRooms = await RoomType.find({
        propertyId: property._id,
        isActive: true,
        'maxOccupancy.adults': { $gte: adultNum },
      }).lean();

      // If dates are provided, evaluate live availability and pricing
      const results = await Promise.all(
        allRooms.map(async (rt) => {
          if (checkIn && checkOut) {
            const avail = await checkAvailability({
              roomTypeId: rt._id,
              propertyId: property._id,
              checkIn,
              checkOut,
              requestedRooms: roomNum,
            });

            let pricing = null;
            if (avail.isAvailable) {
              pricing = await calculateStayPricing({
                roomTypeId: rt._id,
                hotelAccountId: property.hotelAccountId,
                checkIn,
                checkOut,
                rooms: roomNum,
              });
            }

            return {
              ...rt,
              availability: {
                isAvailable: avail.isAvailable,
                availableUnits: avail.minAvailableUnits,
                dates: avail.dates,
              },
              pricing,
            };
          }

          return {
            ...rt,
            availability: {
              isAvailable: rt.totalUnits > 0,
              availableUnits: rt.totalUnits,
            },
            pricing: {
              ratePerNight: rt.basePricePerNight,
              totalAmount: rt.basePricePerNight,
              currency: 'PKR',
            },
          };
        })
      );

      res.status(200).json({
        success: true,
        data: {
          rooms: results,
          roomTypes: results,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check rates and pricing breakdown for a stay.
   */
  static async checkRates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const slugFromParam = req.params.slug ? String(req.params.slug).toLowerCase() : null;
      const { propertyId, slug, roomTypeId, checkIn, checkOut, rooms = 1, promoCode, addOns } = req.body;

      if (!roomTypeId || !checkIn || !checkOut) {
        throw new AppError('roomTypeId, checkIn, and checkOut are required', 400, 'INVALID_INPUT');
      }

      let property = null;
      if (propertyId) {
        property = await Property.findOne({ _id: propertyId, status: 'PUBLISHED' }).lean();
      } else if (slugFromParam || slug) {
        property = await Property.findOne({ slug: slugFromParam || slug, status: 'PUBLISHED' }).lean();
      }

      if (!property) {
        throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
      }

      const roomType = await RoomType.findOne({ _id: roomTypeId, propertyId: property._id, isActive: true }).lean();
      if (!roomType) {
        throw new AppError('Room type not found', 404, 'ROOM_TYPE_NOT_FOUND');
      }

      const avail = await checkAvailability({
        roomTypeId,
        propertyId: property._id,
        checkIn,
        checkOut,
        requestedRooms: rooms,
      });

      let pricing = null;
      if (avail.isAvailable) {
        pricing = await calculateStayPricing({
          roomTypeId,
          hotelAccountId: property.hotelAccountId,
          checkIn,
          checkOut,
          rooms,
          promoCode,
          addOns,
        });
      } else {
        // Compute base estimate even if sold out so user can see what rates would be
        try {
          pricing = await calculateStayPricing({
            roomTypeId,
            hotelAccountId: property.hotelAccountId,
            checkIn,
            checkOut,
            rooms,
            promoCode,
            addOns,
          });
        } catch {
          pricing = null;
        }
      }

      res.status(200).json({
        success: true,
        data: {
          isAvailable: avail.isAvailable,
          availableUnits: avail.minAvailableUnits,
          dates: avail.dates,
          pricing,
          property: {
            _id: property._id,
            id: property._id,
            name: property.name,
            slug: property.slug,
            coverImage: property.coverImage,
            address: property.address,
            policies: (property as any).policies || null,
            averageRating: property.averageRating,
          },
          roomType: {
            _id: roomType._id,
            id: roomType._id,
            name: roomType.name,
            category: roomType.category,
            basePricePerNight: roomType.basePricePerNight,
            maxOccupancy: roomType.maxOccupancy,
            photos: roomType.images || [],
            images: roomType.images || [],
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate a promotional coupon code.
   */
  static async validatePromo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let { code, hotelAccountId, propertyId, roomTypeId, checkIn, checkOut, rooms = 1, bookingAmount } = req.body;

      if (!hotelAccountId && propertyId) {
        const prop = await Property.findById(propertyId).select('hotelAccountId').lean();
        if (prop) {
          hotelAccountId = prop.hotelAccountId;
        }
      }

      if (!code || !hotelAccountId) {
        throw new AppError('code and hotelAccountId (or propertyId) are required', 400, 'INVALID_INPUT');
      }

      const checkInDate = normalizeDate(checkIn || new Date());
      const checkOutDate = normalizeDate(checkOut || new Date(checkInDate.getTime() + 86400000));

      const promo = await PromoCode.findOne({
        hotelAccountId,
        code: code.trim().toUpperCase(),
        isActive: true,
        validFrom: { $lte: checkOutDate },
        validTo: { $gte: checkInDate },
      }).lean();

      if (!promo) {
        throw new AppError('Invalid or expired promo code', 404, 'PROMO_NOT_FOUND');
      }

      if (promo.maxUses && promo.currentUses >= promo.maxUses) {
        throw new AppError('Promo code usage limit has been reached', 400, 'PROMO_EXHAUSTED');
      }

      let discountAmount = 0;
      const baseAmount = parseFloat(bookingAmount) || 0;
      if (baseAmount > 0) {
        if (promo.minBookingAmount && baseAmount < promo.minBookingAmount) {
          throw new AppError(`Booking total must be at least PKR ${promo.minBookingAmount} to apply this promo code`, 400, 'MIN_BOOKING_NOT_MET');
        }

        if (promo.discountType === 'PERCENTAGE') {
          discountAmount = Math.round((baseAmount * promo.discountValue) / 100);
          if (promo.maxDiscountAmount && discountAmount > promo.maxDiscountAmount) {
            discountAmount = promo.maxDiscountAmount;
          }
        } else if (promo.discountType === 'FIXED_AMOUNT') {
          discountAmount = Math.min(baseAmount, promo.discountValue);
        }
      }

      res.status(200).json({
        success: true,
        data: {
          code: promo.code,
          discountType: promo.discountType,
          discountValue: promo.discountValue,
          maxDiscountAmount: promo.maxDiscountAmount,
          minBookingAmount: promo.minBookingAmount,
          discountAmount,
          description: promo.description,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get unique active cities with published property counts.
   */
  static async getAvailableCities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cities = await Property.aggregate([
        { $match: { status: 'PUBLISHED' } },
        {
          $group: {
            _id: '$address.city',
            count: { $sum: 1 },
            country: { $first: '$address.country' },
            sampleImage: { $first: '$coverImage' },
          },
        },
        { $sort: { count: -1 } },
      ]);

      res.status(200).json({
        success: true,
        data: {
          cities: cities.map((c) => ({
            city: c._id,
            country: c.country,
            count: c.count,
            sampleImage: c.sampleImage || '',
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new marketplace booking (Guest Checkout).
   */
  static async createBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
    const idempotencyKey = req.headers['x-idempotency-key'] as string;

    // 1. Check idempotency for agent safe retries
    if (idempotencyKey) {
      const existingBooking = await Booking.findOne({ idempotencyKey }).lean();
      if (existingBooking) {
        res.status(200).json({
          success: true,
          data: { booking: existingBooking },
        });
        return;
      }
    }

    let session: mongoose.ClientSession | undefined = undefined;
    let useTransaction = false;

    try {
      const isReplicaSet = Boolean((mongoose.connection as any)?.client?.options?.replicaSet);
      if (isReplicaSet) {
        session = await mongoose.startSession();
        session.startTransaction();
        useTransaction = true;
      }
    } catch {
      session = undefined;
      useTransaction = false;
    }

    try {
      const bookingSchema = z.object({
        propertyId: z.string(),
        roomTypeId: z.string(),
        checkIn: z.string(),
        checkOut: z.string(),
        rooms: z.number().int().min(1).default(1),
        adults: z.number().int().min(1).default(1),
        children: z.number().int().min(0).default(0),
        guest: z.object({
          fullName: z.string().min(2),
          email: z.string().email(),
          phone: z.string().min(5),
          nationality: z.string().optional(),
          identityDocument: z.string().optional(),
        }),
        paymentMethod: z.enum(['CASH', 'CARD_ON_ARRIVAL', 'ONLINE', 'BANK_TRANSFER']).default('CASH'),
        promoCode: z.string().optional(),
        specialRequests: z.string().optional(),
        createAccount: z.boolean().optional(),
        password: z.string().min(6).optional(),
      });

      const body = bookingSchema.parse(req.body);

      // Verify property and hotel status
      const property = await Property.findById(body.propertyId);
      if (!property || property.status !== 'PUBLISHED') {
        throw new AppError('Property not available for booking', 400, 'PROPERTY_NOT_AVAILABLE');
      }

      const hotel = await HotelAccount.findById(property.hotelAccountId);
      if (!hotel || hotel.status !== 'ACTIVE') {
        throw new AppError('Hotel is currently not accepting reservations', 403, 'HOTEL_INACTIVE');
      }

      const roomType = await RoomType.findById(body.roomTypeId);
      if (!roomType || !roomType.isActive) {
        throw new AppError('Room type is not available', 400, 'ROOM_TYPE_INACTIVE');
      }

      // 2. Atomically reserve rooms
      try {
        await reserveRooms({
          roomTypeId: roomType._id,
          propertyId: property._id,
          hotelAccountId: hotel._id,
          checkIn: body.checkIn,
          checkOut: body.checkOut,
          rooms: body.rooms,
          session,
        });
      } catch (reserveErr: any) {
        throw new AppError(
          reserveErr.message || 'Selected room has insufficient availability for these dates',
          409,
          'ROOM_UNAVAILABLE'
        );
      }

      // 3. Calculate pricing via rate engine
      const pricing = await calculateStayPricing({
        roomTypeId: roomType._id,
        hotelAccountId: hotel._id,
        checkIn: body.checkIn,
        checkOut: body.checkOut,
        rooms: body.rooms,
        promoCode: body.promoCode,
      });

      // 4. Generate reference
      const bookingReference = await generateBookingReference(hotel.slug);

      const checkInDate = normalizeDate(body.checkIn);
      const checkOutDate = normalizeDate(body.checkOut);
      const nights = Math.max(1, Math.round((checkOutDate.getTime() - checkInDate.getTime()) / 86400000));

      // 5. Create guest account if requested
      let guestUserId: Types.ObjectId | undefined = undefined;
      if (body.createAccount && body.password) {
        const existingUser = await User.findOne({ email: body.guest.email.toLowerCase() });
        if (!existingUser) {
          const passwordHash = await bcrypt.hash(body.password, 12);
          const newUser = await User.create({
            fullName: body.guest.fullName,
            email: body.guest.email.toLowerCase(),
            passwordHash,
            role: 'GUEST',
            status: 'ACTIVE',
            phone: body.guest.phone,
            nationality: body.guest.nationality,
            savedProperties: [],
          });
          guestUserId = newUser._id;
        } else {
          guestUserId = existingUser._id;
        }
      }

      // 6. Create booking
      const createdBooking = await Booking.create({
        bookingReference,
        propertyId: property._id,
        hotelAccountId: hotel._id,
        roomTypeId: roomType._id,
        guest: {
          ...body.guest,
          guestUserId,
        },
        checkIn: checkInDate,
        checkOut: checkOutDate,
        nights,
        rooms: body.rooms,
        adults: body.adults,
        children: body.children,
        pricing,
        status: 'PENDING',
        paymentStatus: 'UNPAID',
        paymentMethod: body.paymentMethod,
        source: 'MARKETPLACE',
        specialRequests: body.specialRequests,
        idempotencyKey,
        hasReview: false,
      });

      // Increment promo usage if applied
      if (pricing.promoCode) {
        await PromoCode.findOneAndUpdate(
          { hotelAccountId: hotel._id, code: pricing.promoCode },
          { $inc: { currentUses: 1 } },
          { session }
        );
      }

      // Commit transaction if active
      if (useTransaction && session) {
        await session.commitTransaction();
        session.endSession();
      }

      // Async email confirmation
      const policies = await Policy.findOne({ propertyId: property._id }).lean();
      sendBookingConfirmationEmail({
        to: createdBooking.guest.email,
        guestName: createdBooking.guest.fullName,
        bookingReference: createdBooking.bookingReference,
        propertyName: property.name,
        roomTypeName: roomType.name,
        checkIn: createdBooking.checkIn,
        checkOut: createdBooking.checkOut,
        nights: createdBooking.nights,
        rooms: createdBooking.rooms,
        totalAmount: createdBooking.pricing.totalAmount,
        currency: createdBooking.pricing.currency,
        cancellationPolicy: policies?.cancellationPolicy,
        propertyAddress: property.address.formattedAddress || `${property.address.city}, ${property.address.country}`,
        propertyPhone: property.contactPhone,
        specialRequests: createdBooking.specialRequests,
      }).catch((e) => console.error('[Email Error]', e));

      // Log platform activity
      logActivity({
        tenantId: hotel._id,
        actorId: guestUserId || createdBooking._id,
        actorRole: 'HOTEL_ADMIN',
        action: 'BOOKING_CREATED',
        targetType: 'Booking',
        targetId: createdBooking._id,
        metadata: {
          reference: createdBooking.bookingReference,
          property: property.name,
          totalAmount: createdBooking.pricing.totalAmount,
        },
      });

      res.status(201).json({
        success: true,
        data: {
          booking: createdBooking,
        },
      });
    } catch (error) {
      if (useTransaction && session) {
        await session.abortTransaction();
        session.endSession();
      }
      next(error);
    }
  }

  /**
   * Get published reviews for a property with Airbnb category breakdown summary.
   */
  static async getPropertyReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const slugStr = String(req.params.slug).toLowerCase();
      const { page = '1', limit = '10', sortBy = 'newest', minRating } = req.query as Record<string, string>;

      const property = await Property.findOne({ slug: slugStr }).lean();
      if (!property) {
        throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
      }

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
      const skip = (pageNum - 1) * limitNum;

      const query: any = {
        propertyId: property._id,
        status: 'PUBLISHED',
      };

      if (minRating) {
        const r = parseFloat(minRating);
        if (!isNaN(r)) query.overallRating = { $gte: r };
      }

      let sort: any = { createdAt: -1 };
      if (sortBy === 'rating_high') sort = { overallRating: -1, createdAt: -1 };
      if (sortBy === 'rating_low') sort = { overallRating: 1, createdAt: -1 };

      const totalCount = await Review.countDocuments(query);
      const reviews = await Review.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean();

      res.status(200).json({
        success: true,
        data: {
          summary: {
            averageRating: property.averageRating || 0,
            reviewCount: property.reviewCount || 0,
            categoryRatings: property.categoryRatings || {
              cleanliness: 0,
              accuracy: 0,
              checkIn: 0,
              communication: 0,
              location: 0,
              value: 0,
            },
            isGuestFavorite: property.isGuestFavorite || false,
          },
          reviews,
          pagination: {
            page: pageNum,
            limit: limitNum,
            totalCount,
            totalPages: Math.ceil(totalCount / limitNum),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Home Feed: Returns geo-personalized destinations, featured spotlights, and properties.
   */
  static async getHomeFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const location = resolveVisitorLocation(req);

      // 1. Get active HotelAccounts
      const activeHotels = await HotelAccount.find({ status: 'ACTIVE' }).select('_id').lean();
      const activeHotelIds = activeHotels.map((h) => h._id);

      // 2. Fetch Super Admin curated destinations matching visitor country or 'ALL'
      let destinations = await FeaturedDestination.find({
        isActive: true,
        $or: [
          { targetCountries: location.countryCode },
          { targetCountries: 'ALL' },
          { countryCode: location.countryCode },
        ],
      })
        .sort({ displayOrder: 1, isPopular: -1, createdAt: -1 })
        .lean();

      // If fewer than 4 destinations match, backfill with remaining active destinations
      if (destinations.length < 4) {
        const existingIds = destinations.map((d) => d._id.toString());
        const extraDestinations = await FeaturedDestination.find({
          isActive: true,
          _id: { $nin: existingIds },
        })
          .sort({ displayOrder: 1, isPopular: -1, createdAt: -1 })
          .limit(4 - destinations.length)
          .lean();

        destinations = [...destinations, ...extraDestinations];
      }

      // 3. Query all published properties
      const allPublished = await Property.find({
        status: 'PUBLISHED',
        hotelAccountId: { $in: activeHotelIds },
      })
        .sort({ isFeaturedOnHome: -1, featuredPriority: 1, isGuestFavorite: -1, averageRating: -1 })
        .lean();

      // Enrich properties with starting price and room count
      const enrichedProperties = await Promise.all(
        allPublished.map(async (prop) => {
          const rooms = await RoomType.find({ propertyId: prop._id, isActive: true })
            .sort({ basePricePerNight: 1 })
            .select('basePricePerNight totalUnits name category')
            .lean();

          return {
            ...prop,
            startingPrice: rooms.length > 0 ? rooms[0].basePricePerNight : 0,
            availableRoomTypesCount: rooms.length,
          };
        })
      );

      // Split into Featured properties vs All properties
      const featuredProperties = enrichedProperties.filter((p) => (p as any).isFeaturedOnHome);

      // Regional properties matching detected country
      const regionalProperties = enrichedProperties.filter(
        (p) =>
          p.address.country.toLowerCase() === location.countryName.toLowerCase() ||
          p.address.country.toUpperCase() === location.countryCode.toUpperCase()
      );

      // Unique countries with published stays for the country selector
      const availableCountries = Array.from(
        new Set(enrichedProperties.map((p) => p.address.country).filter(Boolean))
      );

      res.status(200).json({
        success: true,
        data: {
          detectedLocation: location,
          destinations,
          featuredProperties,
          regionalProperties,
          properties: enrichedProperties,
          availableCountries,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
