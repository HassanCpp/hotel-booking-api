import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { Types } from 'mongoose';
import { Property } from '../../models/Property';
import { RoomType } from '../../models/RoomType';
import { Booking } from '../../models/Booking';
import { checkAvailability, reserveRooms, releaseRooms } from '../../utils/availability';
import { calculateStayPricing, normalizeDate } from '../../utils/rateEngine';
import { generateBookingReference } from '../../utils/bookingReference';
import { RagPipelineService } from './rag-pipeline.service';

/**
 * Resolves property by ObjectId, Slug, or Case-Insensitive Name
 */
export async function resolveProperty(propertyIdentifier?: string) {
  if (!propertyIdentifier || typeof propertyIdentifier !== 'string') return null;
  const clean = propertyIdentifier.trim();
  if (!clean) return null;

  if (Types.ObjectId.isValid(clean)) {
    const prop = await Property.findById(clean).lean();
    if (prop) return prop;
  }

  // Try by exact slug
  const bySlug = await Property.findOne({ slug: clean.toLowerCase() }).lean();
  if (bySlug) return bySlug;

  // Try by exact or substring name match (case-insensitive)
  const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return await Property.findOne({
    status: 'PUBLISHED',
    name: new RegExp(escaped, 'i'),
  }).lean();
}

/**
 * Tool 1: Discover Marketplace Properties (Cross-Property Catalog)
 */
export const discoverMarketplacePropertiesTool = tool(
  async ({ city, propertyType, amenity, maxPrice, query }) => {
    try {
      const filter: Record<string, any> = { status: 'PUBLISHED' };

      if (city) {
        filter['address.city'] = new RegExp(city.trim(), 'i');
      }

      if (propertyType) {
        filter.propertyType = propertyType.toUpperCase().trim();
      }

      if (amenity) {
        filter.amenities = new RegExp(amenity.trim(), 'i');
      }

      if (query) {
        const qEscaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter['$or'] = [
          { name: new RegExp(qEscaped, 'i') },
          { shortDescription: new RegExp(qEscaped, 'i') },
          { 'address.city': new RegExp(qEscaped, 'i') },
          { 'address.country': new RegExp(qEscaped, 'i') },
        ];
      }

      const properties = await Property.find(filter)
        .select('name slug propertyType address coverImage amenities averageRating reviewCount')
        .limit(8)
        .lean();

      if (!properties || properties.length === 0) {
        // Fallback: return all published properties if specific filter had 0 results
        const allProps = await Property.find({ status: 'PUBLISHED' })
          .select('name slug propertyType address amenities')
          .limit(5)
          .lean();

        return JSON.stringify({
          matchedCount: 0,
          message: `No published properties matched your exact criteria. Here are our available platform properties:`,
          availableProperties: allProps.map((p) => ({
            id: p._id.toString(),
            name: p.name,
            slug: p.slug,
            city: p.address.city,
            country: p.address.country,
            amenities: p.amenities?.slice(0, 5),
          })),
        });
      }

      // Enrich with starting rates
      const enriched = await Promise.all(
        properties.map(async (p) => {
          const room = await RoomType.findOne({ propertyId: p._id, isActive: true })
            .select('basePricePerNight')
            .lean();
          return {
            id: p._id.toString(),
            name: p.name,
            slug: p.slug,
            propertyType: p.propertyType,
            city: p.address.city,
            country: p.address.country,
            startingPrice: room ? room.basePricePerNight : null,
            rating: p.averageRating,
            reviewCount: p.reviewCount,
            keyAmenities: p.amenities?.slice(0, 6),
          };
        })
      );

      return JSON.stringify({
        totalResults: enriched.length,
        properties: enriched,
      });
    } catch (err: any) {
      return JSON.stringify({ error: err.message || 'Error discovering marketplace properties.' });
    }
  },
  {
    name: 'discover_marketplace_properties',
    description:
      'Search and list hotels/properties across the entire marketplace platform by city (e.g. Lahore, Tokyo, Dubai), property type (HOTEL, VILLA, RESORT), amenity (pool, wifi, pet friendly), or keyword.',
    schema: z.object({
      city: z.string().optional().describe('City name to filter stays (e.g. "Lahore", "Tokyo", "Dubai")'),
      propertyType: z.string().optional().describe('Property category (e.g. "HOTEL", "BOUTIQUE", "RESORT", "VILLA", "RYOKAN")'),
      amenity: z.string().optional().describe('Desired amenity (e.g. "Swimming Pool", "Pet Friendly", "Breakfast", "Gym", "Spa")'),
      maxPrice: z.number().optional().describe('Maximum nightly rate budget'),
      query: z.string().optional().describe('Search keyword or hotel name'),
    }),
  }
);

/**
 * Tool 2: Ask Property Policies RAG (Platform-Wide & Property-Specific)
 */
export const askPropertyPoliciesRAGTool = tool(
  async ({ question, propertyNameOrId }) => {
    try {
      let resolvedProp = null;
      if (propertyNameOrId) {
        resolvedProp = await resolveProperty(propertyNameOrId);
      }

      const result = await RagPipelineService.ask({
        propertyId: resolvedProp ? resolvedProp._id.toString() : undefined,
        hotelAccountId: resolvedProp?.hotelAccountId ? resolvedProp.hotelAccountId.toString() : undefined,
        propertyName: resolvedProp ? resolvedProp.name : 'All Marketplace Stays',
        query: question,
      });

      return JSON.stringify({
        propertyName: resolvedProp ? resolvedProp.name : 'Marketplace Platform Knowledge',
        answer: result.answer,
        confidence: result.confidence,
        citations: result.citations,
      });
    } catch (err: any) {
      return JSON.stringify({ error: err.message || 'Error querying property policies.' });
    }
  },
  {
    name: 'ask_property_policies_rag',
    description:
      'Answers verified hotel policy and house rule questions (Wi-Fi passwords, pool hours, dining times, pet policies, parking fees, check-in schedules, cancellations) across all properties or for a specific property using the RAG knowledge base.',
    schema: z.object({
      question: z.string().describe('The specific policy, amenity, or rule question to query'),
      propertyNameOrId: z.string().optional().describe('Optional property name (e.g. "Milli Dorms"), slug, or ID if asking about a specific hotel'),
    }),
  }
);

/**
 * Tool 3: Check Room Availability
 */
export const checkRoomAvailabilityTool = tool(
  async ({ propertyIdOrName, checkIn, checkOut, adults = 1, children = 0, rooms = 1 }) => {
    try {
      const property = await resolveProperty(propertyIdOrName);
      if (!property) {
        return JSON.stringify({ error: `Could not identify property from "${propertyIdOrName}". Please specify the hotel name.` });
      }

      const adultCount = Math.max(1, adults);
      const roomTypes = await RoomType.find({
        propertyId: property._id,
        isActive: true,
        'maxOccupancy.adults': { $gte: adultCount },
      }).lean();

      if (!roomTypes || roomTypes.length === 0) {
        return JSON.stringify({
          propertyName: property.name,
          availableRooms: [],
          message: `No room types match capacity for ${adultCount} adult(s) at ${property.name}.`,
        });
      }

      const availabilityList = await Promise.all(
        roomTypes.map(async (rt) => {
          const avail = await checkAvailability({
            roomTypeId: rt._id,
            propertyId: property._id,
            checkIn,
            checkOut,
            requestedRooms: rooms,
          });

          let pricingSummary = null;
          if (avail.isAvailable) {
            try {
              pricingSummary = await calculateStayPricing({
                roomTypeId: rt._id,
                hotelAccountId: property.hotelAccountId,
                checkIn,
                checkOut,
                rooms,
              });
            } catch (pErr) {
              pricingSummary = { totalAmount: rt.basePricePerNight, currency: 'USD' };
            }
          }

          return {
            roomTypeId: rt._id.toString(),
            name: rt.name,
            code: rt.code,
            category: rt.category,
            bedding: rt.bedding,
            maxOccupancy: rt.maxOccupancy,
            isAvailable: avail.isAvailable,
            availableUnits: avail.minAvailableUnits,
            basePricePerNight: rt.basePricePerNight,
            totalStayPrice: pricingSummary ? pricingSummary.totalAmount : null,
            currency: pricingSummary ? pricingSummary.currency : 'USD',
          };
        })
      );

      const availableOnly = availabilityList.filter((r) => r.isAvailable);

      return JSON.stringify({
        propertyName: property.name,
        propertyId: property._id.toString(),
        checkIn,
        checkOut,
        adults: adultCount,
        children,
        roomsRequested: rooms,
        totalAvailableOptions: availableOnly.length,
        options: availableOnly,
        soldOutOptions: availabilityList.filter((r) => !r.isAvailable).map((r) => r.name),
      });
    } catch (err: any) {
      return JSON.stringify({ error: err.message || 'Error checking room availability.' });
    }
  },
  {
    name: 'check_room_availability',
    description:
      'Check real-time room availability, remaining units, and pricing for a hotel property across requested stay dates and occupancy.',
    schema: z.object({
      propertyIdOrName: z.string().describe('The property name (e.g. "Milli Dorms"), slug, or Mongo ObjectId'),
      checkIn: z.string().describe('Check-in date in YYYY-MM-DD format (e.g. 2026-11-25)'),
      checkOut: z.string().describe('Check-out date in YYYY-MM-DD format (e.g. 2026-11-27)'),
      adults: z.number().optional().default(1).describe('Number of adult guests'),
      children: z.number().optional().default(0).describe('Number of child guests'),
      rooms: z.number().optional().default(1).describe('Number of rooms requested'),
    }),
  }
);

/**
 * Tool 4: Calculate Stay Quote
 */
export const calculateStayQuoteTool = tool(
  async ({ propertyIdOrName, roomTypeId, checkIn, checkOut, rooms = 1, promoCode, addOns }) => {
    try {
      const property = await resolveProperty(propertyIdOrName);
      if (!property) {
        return JSON.stringify({ error: `Property not found for identifier "${propertyIdOrName}".` });
      }

      // If roomTypeId is not an ObjectId, attempt to find room by name in this property
      let roomType = null;
      if (Types.ObjectId.isValid(roomTypeId)) {
        roomType = await RoomType.findById(roomTypeId).lean();
      }
      if (!roomType) {
        roomType = await RoomType.findOne({
          propertyId: property._id,
          name: new RegExp(roomTypeId.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
        }).lean();
      }
      if (!roomType) {
        // Default to first room type if user just asked for a quote
        roomType = await RoomType.findOne({ propertyId: property._id, isActive: true }).lean();
      }

      if (!roomType) {
        return JSON.stringify({ error: `Could not identify room type "${roomTypeId}" for ${property.name}.` });
      }

      const pricing = await calculateStayPricing({
        roomTypeId: roomType._id,
        hotelAccountId: property.hotelAccountId,
        checkIn,
        checkOut,
        rooms,
        promoCode,
        addOns: addOns && addOns.length > 0 ? addOns.map((a) => ({ name: a, price: 25 })) : [],
      });

      const dIn = normalizeDate(checkIn);
      const dOut = normalizeDate(checkOut);
      const nights = Math.max(1, Math.round((dOut.getTime() - dIn.getTime()) / (1000 * 60 * 60 * 24)));

      return JSON.stringify({
        propertyName: property.name,
        roomTypeName: roomType.name,
        roomTypeId: roomType._id.toString(),
        checkIn,
        checkOut,
        nights,
        rooms,
        ratePerNight: pricing.ratePerNight,
        ratePlanName: pricing.ratePlanName || 'Standard Flexible Rate',
        roomTotal: pricing.roomTotal,
        taxes: pricing.taxes,
        taxRate: pricing.taxRate || 0.16,
        discount: pricing.discount || 0,
        promoCodeApplied: pricing.promoCode || null,
        totalAmount: pricing.totalAmount,
        currency: pricing.currency,
        cancellationPolicySummary:
          'Free cancellation up to 48 hours prior to check-in. Cancellations within 48 hours incur a 1-night room charge.',
      });
    } catch (err: any) {
      return JSON.stringify({ error: err.message || 'Error calculating stay quote.' });
    }
  },
  {
    name: 'calculate_stay_quote',
    description:
      'Calculates exact stay pricing quote including base nightly rates, active rate plans, taxes (16%), promo code discounts, and stay totals.',
    schema: z.object({
      propertyIdOrName: z.string().describe('Property name (e.g. "Milli Dorms"), slug, or ID'),
      roomTypeId: z.string().describe('Room type name or ObjectId to quote'),
      checkIn: z.string().describe('Check-in date YYYY-MM-DD'),
      checkOut: z.string().describe('Check-out date YYYY-MM-DD'),
      rooms: z.number().optional().default(1).describe('Number of rooms to quote'),
      promoCode: z.string().optional().describe('Optional promotional discount coupon code (e.g. SUMMER2026)'),
      addOns: z.array(z.string()).optional().describe('Optional add-ons (e.g. ["Airport Chauffeur", "Breakfast Buffet"])'),
    }),
  }
);

/**
 * Tool 5: Execute Reservation
 */
export const executeReservationTool = tool(
  async ({
    propertyIdOrName,
    roomTypeId,
    checkIn,
    checkOut,
    adults = 1,
    children = 0,
    rooms = 1,
    guest,
    promoCode,
    specialRequests,
    idempotencyKey,
  }) => {
    try {
      const property = await resolveProperty(propertyIdOrName);
      if (!property) {
        return JSON.stringify({ error: `Property not found for identifier "${propertyIdOrName}".` });
      }

      let roomType = null;
      if (Types.ObjectId.isValid(roomTypeId)) {
        roomType = await RoomType.findById(roomTypeId);
      }
      if (!roomType) {
        roomType = await RoomType.findOne({
          propertyId: property._id,
          name: new RegExp(roomTypeId.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
        });
      }
      if (!roomType) {
        roomType = await RoomType.findOne({ propertyId: property._id, isActive: true });
      }

      if (!roomType) {
        return JSON.stringify({ error: `Room type "${roomTypeId}" not found for ${property.name}.` });
      }

      const idKey = idempotencyKey || `agent-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const existingBooking = await Booking.findOne({ idempotencyKey: idKey }).lean();
      if (existingBooking) {
        return JSON.stringify({
          success: true,
          isDuplicate: true,
          bookingReference: existingBooking.bookingReference,
          status: existingBooking.status,
          totalAmount: existingBooking.pricing.totalAmount,
          currency: existingBooking.pricing.currency,
          voucherUrl: `/guest/bookings/${existingBooking._id}/voucher`,
          message: 'Booking already existed with this idempotency key and has been safely returned.',
        });
      }

      // Verify availability
      const avail = await checkAvailability({
        roomTypeId: roomType._id,
        propertyId: property._id,
        checkIn,
        checkOut,
        requestedRooms: rooms,
      });

      if (!avail.isAvailable) {
        return JSON.stringify({
          error: `Insufficient availability for ${roomType.name} between ${checkIn} and ${checkOut}. Please select another room or alternative dates.`,
        });
      }

      // Calculate Pricing
      const pricing = await calculateStayPricing({
        roomTypeId: roomType._id,
        hotelAccountId: property.hotelAccountId,
        checkIn,
        checkOut,
        rooms,
        promoCode,
      });

      // Atomically reserve rooms
      await reserveRooms({
        roomTypeId: roomType._id,
        propertyId: property._id,
        hotelAccountId: property.hotelAccountId,
        checkIn,
        checkOut,
        rooms,
      });

      // Create Booking
      const bookingReference = await generateBookingReference(property.slug || 'stay');
      const dIn = normalizeDate(checkIn);
      const dOut = normalizeDate(checkOut);
      const nights = Math.max(1, Math.round((dOut.getTime() - dIn.getTime()) / (1000 * 60 * 60 * 24)));

      const booking = await Booking.create({
        bookingReference,
        idempotencyKey: idKey,
        propertyId: property._id,
        hotelAccountId: property.hotelAccountId,
        roomTypeId: roomType._id,
        guest: {
          fullName: guest.fullName.trim(),
          email: guest.email.toLowerCase().trim(),
          phone: guest.phone.trim(),
          nationality: guest.nationality || 'Unspecified',
        },
        checkIn: dIn,
        checkOut: dOut,
        nights,
        rooms: rooms,
        adults: Math.max(1, adults),
        children: Math.max(0, children),
        pricing,
        status: 'CONFIRMED',
        paymentStatus: 'UNPAID',
        paymentMethod: 'CARD_ON_ARRIVAL',
        source: 'AGENT',
        specialRequests: specialRequests || '',
        hasReview: false,
      });

      return JSON.stringify({
        success: true,
        bookingId: booking._id.toString(),
        bookingReference: booking.bookingReference,
        status: booking.status,
        propertyName: property.name,
        roomTypeName: roomType.name,
        checkIn: dIn.toISOString().split('T')[0],
        checkOut: dOut.toISOString().split('T')[0],
        nights,
        guestName: guest.fullName,
        guestEmail: guest.email,
        totalAmount: pricing.totalAmount,
        currency: pricing.currency,
        voucherUrl: `/guest/bookings/${booking._id}/voucher`,
        message: `Reservation confirmed successfully! Reference code is ${booking.bookingReference}.`,
      });
    } catch (err: any) {
      return JSON.stringify({ error: err.message || 'Error executing reservation.' });
    }
  },
  {
    name: 'execute_reservation',
    description:
      'Creates a direct confirmed hotel reservation, reserves inventory, generates a unique booking reference, and returns the digital stay voucher link.',
    schema: z.object({
      propertyIdOrName: z.string().describe('Property name (e.g. "Milli Dorms"), slug, or ID'),
      roomTypeId: z.string().describe('Selected room type name or ObjectId'),
      checkIn: z.string().describe('Check-in date YYYY-MM-DD'),
      checkOut: z.string().describe('Check-out date YYYY-MM-DD'),
      adults: z.number().optional().default(1).describe('Number of adult guests'),
      children: z.number().optional().default(0).describe('Number of child guests'),
      rooms: z.number().optional().default(1).describe('Number of rooms to book'),
      guest: z.object({
        fullName: z.string().min(2).describe('Full legal name of the primary guest'),
        email: z.string().email().describe('Valid email address for reservation confirmation'),
        phone: z.string().min(5).describe('Contact telephone number including country code'),
        nationality: z.string().optional().describe('Guest nationality'),
      }),
      promoCode: z.string().optional().describe('Optional promo code discount'),
      specialRequests: z.string().optional().describe('Optional guest requests (e.g. quiet room, late check-in)'),
      idempotencyKey: z.string().optional().describe('Unique client submission UUID to prevent accidental double-booking'),
    }),
  }
);

/**
 * Tool 6: Lookup Reservation Status
 */
export const lookupReservationTool = tool(
  async ({ bookingReference, guestEmail }) => {
    try {
      const cleanRef = bookingReference.toUpperCase().trim();
      const cleanEmail = guestEmail.toLowerCase().trim();

      const booking = await Booking.findOne({
        bookingReference: cleanRef,
        'guest.email': cleanEmail,
      })
        .populate('propertyId', 'name slug address coverImage')
        .populate('roomTypeId', 'name code category')
        .lean();

      if (!booking) {
        return JSON.stringify({
          error: `No reservation found matching reference "${cleanRef}" and email "${cleanEmail}".`,
        });
      }

      const property: any = booking.propertyId;
      const roomType: any = booking.roomTypeId;

      return JSON.stringify({
        success: true,
        bookingReference: booking.bookingReference,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        propertyName: property ? property.name : 'Unknown Property',
        roomTypeName: roomType ? roomType.name : 'Standard Room',
        checkIn: new Date(booking.checkIn).toISOString().split('T')[0],
        checkOut: new Date(booking.checkOut).toISOString().split('T')[0],
        nights: booking.nights,
        guestName: booking.guest.fullName,
        totalAmount: booking.pricing.totalAmount,
        currency: booking.pricing.currency,
        voucherUrl: `/guest/bookings/${booking._id}/voucher`,
      });
    } catch (err: any) {
      return JSON.stringify({ error: err.message || 'Error looking up reservation.' });
    }
  },
  {
    name: 'lookup_reservation',
    description:
      'Look up an existing hotel reservation by its booking reference number and guest email address to verify status, stay dates, and access the digital voucher.',
    schema: z.object({
      bookingReference: z.string().describe('Unique booking reference code (e.g. REF-28941)'),
      guestEmail: z.string().email().describe('Guest email address matching the reservation for identity verification'),
    }),
  }
);

/**
 * Tool 7: Cancel Reservation
 */
export const cancelReservationTool = tool(
  async ({ bookingReference, guestEmail, reason }) => {
    try {
      const cleanRef = bookingReference.toUpperCase().trim();
      const cleanEmail = guestEmail.toLowerCase().trim();

      const booking = await Booking.findOne({
        bookingReference: cleanRef,
        'guest.email': cleanEmail,
      });

      if (!booking) {
        return JSON.stringify({
          error: `No reservation found matching reference "${cleanRef}" and email "${cleanEmail}".`,
        });
      }

      if (booking.status === 'CANCELLED') {
        return JSON.stringify({
          message: `Reservation ${cleanRef} is already cancelled.`,
          status: 'CANCELLED',
        });
      }

      if (['CHECKED_IN', 'CHECKED_OUT', 'COMPLETED'].includes(booking.status)) {
        return JSON.stringify({
          error: `Cannot cancel booking with current status "${booking.status}". Please contact the front desk directly.`,
        });
      }

      // Release rooms in availability inventory
      await releaseRooms({
        roomTypeId: booking.roomTypeId,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        rooms: booking.rooms || 1,
      });

      // Update booking status
      booking.status = 'CANCELLED';
      booking.cancellation = {
        cancelledAt: new Date(),
        cancelledBy: 'GUEST',
        reason: reason || 'Cancelled via AI Concierge Booking Assistant',
        refundAmount: 0,
      };
      await booking.save();

      return JSON.stringify({
        success: true,
        bookingReference: booking.bookingReference,
        status: 'CANCELLED',
        cancelledAt: booking.cancellation.cancelledAt,
        message: `Reservation ${booking.bookingReference} has been successfully cancelled and inventory released.`,
      });
    } catch (err: any) {
      return JSON.stringify({ error: err.message || 'Error cancelling reservation.' });
    }
  },
  {
    name: 'cancel_reservation',
    description:
      'Safely cancels an active reservation by reference and guest email, releasing the room inventory back into the hotel pool.',
    schema: z.object({
      bookingReference: z.string().describe('Unique booking reference code (e.g. REF-28941)'),
      guestEmail: z.string().email().describe('Guest email address to authorize the cancellation'),
      reason: z.string().optional().describe('Optional cancellation reason provided by the guest'),
    }),
  }
);

/**
 * Exported Array of All Approved Booking Tools
 */
export const bookingTools = [
  discoverMarketplacePropertiesTool,
  askPropertyPoliciesRAGTool,
  checkRoomAvailabilityTool,
  calculateStayQuoteTool,
  executeReservationTool,
  lookupReservationTool,
  cancelReservationTool,
];
