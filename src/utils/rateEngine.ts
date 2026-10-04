import { Types } from 'mongoose';
import { RoomType } from '../models/RoomType';
import { Availability } from '../models/Availability';
import { RatePlan } from '../models/RatePlan';
import { PromoCode } from '../models/PromoCode';
import { IBookingPricing } from '../models/Booking';

export interface ResolveRateResult {
  effectiveRate: number;
  source: 'DATE_OVERRIDE' | 'RATE_PLAN' | 'BASE_RATE';
  ratePlanName?: string;
}

/**
 * Normalizes Date to midnight UTC for uniform calendar calculations
 */
export function normalizeDate(date: Date | string): Date {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

/**
 * Resolves the effective rate for a single calendar night.
 * Hierarchy:
 * 1. Availability.rateOverride (per-date override set by admin)
 * 2. Active RatePlan with highest priority
 * 3. RoomType.basePricePerNight
 */
export async function resolveNightRate(params: {
  roomTypeId: Types.ObjectId | string;
  date: Date;
  nightsCount: number;
  bookingLeadDays: number;
  basePrice: number;
}): Promise<ResolveRateResult> {
  const normalizedDate = normalizeDate(params.date);

  // 1. Check Date-level override in Availability
  const avail = await Availability.findOne({
    roomTypeId: params.roomTypeId,
    date: normalizedDate,
  }).lean();

  if (avail && typeof avail.rateOverride === 'number' && avail.rateOverride > 0) {
    return {
      effectiveRate: avail.rateOverride,
      source: 'DATE_OVERRIDE',
    };
  }

  // 2. Query active RatePlans valid for this date
  const dayOfWeek = normalizedDate.getUTCDay(); // 0 = Sun, 6 = Sat

  const activePlans = await RatePlan.find({
    roomTypeId: params.roomTypeId,
    isActive: true,
    validFrom: { $lte: normalizedDate },
    validTo: { $gte: normalizedDate },
  })
    .sort({ priority: -1 })
    .lean();

  for (const plan of activePlans) {
    // Check days of week restriction if defined
    if (plan.daysOfWeek && plan.daysOfWeek.length > 0 && !plan.daysOfWeek.includes(dayOfWeek)) {
      continue;
    }

    // Check minimum nights
    if (plan.minNights && params.nightsCount < plan.minNights) {
      continue;
    }

    // Check maximum nights
    if (plan.maxNights && params.nightsCount > plan.maxNights) {
      continue;
    }

    // Check early-bird advance booking days
    if (plan.advanceBookingDays && params.bookingLeadDays < plan.advanceBookingDays) {
      continue;
    }

    // Calculate adjusted rate
    let calculatedRate = params.basePrice;
    if (plan.adjustmentType === 'FIXED_PRICE') {
      calculatedRate = plan.adjustmentValue;
    } else if (plan.adjustmentType === 'PERCENTAGE_INCREASE') {
      calculatedRate = params.basePrice * (1 + plan.adjustmentValue / 100);
    } else if (plan.adjustmentType === 'PERCENTAGE_DISCOUNT') {
      calculatedRate = Math.max(0, params.basePrice * (1 - plan.adjustmentValue / 100));
    }

    return {
      effectiveRate: Math.round(calculatedRate),
      source: 'RATE_PLAN',
      ratePlanName: plan.name,
    };
  }

  // 3. Fallback to base rate
  return {
    effectiveRate: params.basePrice,
    source: 'BASE_RATE',
  };
}

export interface CalculatePricingParams {
  roomTypeId: Types.ObjectId | string;
  hotelAccountId: Types.ObjectId | string;
  checkIn: Date | string;
  checkOut: Date | string;
  rooms?: number;
  promoCode?: string;
  addOns?: Array<{ name: string; price: number }>;
  taxRate?: number;
  rateOverridePerNight?: number; // Optional admin manual override
}

/**
 * Calculates complete stay pricing across all nights.
 */
export async function calculateStayPricing(
  params: CalculatePricingParams
): Promise<IBookingPricing & { nightsBreakdown: Array<{ date: string; rate: number }> }> {
  const roomType = await RoomType.findById(params.roomTypeId).lean();
  if (!roomType) {
    throw new Error('Room type not found');
  }

  const checkIn = normalizeDate(params.checkIn);
  const checkOut = normalizeDate(params.checkOut);

  const diffTime = checkOut.getTime() - checkIn.getTime();
  const nights = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));
  const rooms = params.rooms || 1;

  const now = new Date();
  const bookingLeadDays = Math.max(
    0,
    Math.round((checkIn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  let roomTotal = 0;
  let dominantRatePlan: string | undefined = undefined;
  const nightsBreakdown: Array<{ date: string; rate: number }> = [];

  for (let i = 0; i < nights; i++) {
    const currentDate = new Date(checkIn.getTime() + i * 24 * 60 * 60 * 1000);

    let nightlyRate = roomType.basePricePerNight;
    if (typeof params.rateOverridePerNight === 'number' && params.rateOverridePerNight >= 0) {
      nightlyRate = params.rateOverridePerNight;
    } else {
      const rateRes = await resolveNightRate({
        roomTypeId: roomType._id,
        date: currentDate,
        nightsCount: nights,
        bookingLeadDays,
        basePrice: roomType.basePricePerNight,
      });
      nightlyRate = rateRes.effectiveRate;
      if (rateRes.ratePlanName) {
        dominantRatePlan = rateRes.ratePlanName;
      }
    }

    roomTotal += nightlyRate * rooms;
    nightsBreakdown.push({
      date: currentDate.toISOString().split('T')[0],
      rate: nightlyRate,
    });
  }

  const averageRatePerNight = Math.round(roomTotal / (nights * rooms));

  // Add-ons
  const addOns = params.addOns || [];
  const addOnsTotal = addOns.reduce((acc, curr) => acc + (curr.price || 0), 0);

  // Promo Code Validation & Discount Calculation
  let discount = 0;
  let appliedPromoCode: string | undefined = undefined;

  if (params.promoCode && params.promoCode.trim()) {
    const promo = await PromoCode.findOne({
      hotelAccountId: params.hotelAccountId,
      code: params.promoCode.trim().toUpperCase(),
      isActive: true,
      validFrom: { $lte: checkIn },
      validTo: { $gte: checkOut },
    }).lean();

    if (promo) {
      const meetsMinNights = !promo.minNights || nights >= promo.minNights;
      const meetsMinBooking = !promo.minBookingAmount || roomTotal >= promo.minBookingAmount;
      const meetsMaxUses = !promo.maxUses || promo.currentUses < promo.maxUses;
      const meetsRoomType =
        !promo.applicableRoomTypes ||
        promo.applicableRoomTypes.length === 0 ||
        promo.applicableRoomTypes.some(
          (rtId) => rtId.toString() === roomType._id.toString()
        );

      if (meetsMinNights && meetsMinBooking && meetsMaxUses && meetsRoomType) {
        if (promo.discountType === 'PERCENTAGE') {
          let calculatedDiscount = (roomTotal * promo.discountValue) / 100;
          if (promo.maxDiscountAmount && calculatedDiscount > promo.maxDiscountAmount) {
            calculatedDiscount = promo.maxDiscountAmount;
          }
          discount = Math.round(calculatedDiscount);
        } else if (promo.discountType === 'FIXED_AMOUNT') {
          discount = Math.min(roomTotal, promo.discountValue);
        }
        appliedPromoCode = promo.code;
      }
    }
  }

  // Taxes (Default 16% GST)
  const taxRate = typeof params.taxRate === 'number' ? params.taxRate : 0.16;
  const taxableAmount = Math.max(0, roomTotal - discount + addOnsTotal);
  const taxes = Math.round(taxableAmount * taxRate);

  const totalAmount = taxableAmount + taxes;

  return {
    ratePerNight: averageRatePerNight,
    ratePlanName: dominantRatePlan,
    roomTotal,
    taxes,
    taxRate,
    addOns,
    discount,
    promoCode: appliedPromoCode,
    totalAmount,
    currency: 'PKR',
    nightsBreakdown,
  };
}
