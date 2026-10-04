import { Types } from 'mongoose';
import { Review } from '../models/Review';
import { Property } from '../models/Property';

/**
 * Re-aggregates all published reviews for a property and updates Property rating metrics.
 */
export async function recalculatePropertyRatings(
  propertyId: Types.ObjectId | string
): Promise<void> {
  const reviews = await Review.find({
    propertyId,
    status: 'PUBLISHED',
  }).lean();

  if (reviews.length === 0) {
    await Property.findByIdAndUpdate(propertyId, {
      averageRating: 0,
      reviewCount: 0,
      categoryRatings: {
        cleanliness: 0,
        accuracy: 0,
        checkIn: 0,
        communication: 0,
        location: 0,
        value: 0,
      },
      isGuestFavorite: false,
    });
    return;
  }

  const reviewCount = reviews.length;
  let totalOverall = 0;
  let totalCleanliness = 0;
  let totalAccuracy = 0;
  let totalCheckIn = 0;
  let totalCommunication = 0;
  let totalLocation = 0;
  let totalValue = 0;

  for (const r of reviews) {
    totalOverall += r.overallRating || 5;
    totalCleanliness += r.categories?.cleanliness || 5;
    totalAccuracy += r.categories?.accuracy || 5;
    totalCheckIn += r.categories?.checkIn || 5;
    totalCommunication += r.categories?.communication || 5;
    totalLocation += r.categories?.location || 5;
    totalValue += r.categories?.value || 5;
  }

  const round1 = (val: number) => Math.round((val / reviewCount) * 10) / 10;
  const round2 = (val: number) => Math.round((val / reviewCount) * 100) / 100;

  const averageRating = round2(totalOverall);
  const cleanliness = round1(totalCleanliness);
  const accuracy = round1(totalAccuracy);
  const checkIn = round1(totalCheckIn);
  const communication = round1(totalCommunication);
  const location = round1(totalLocation);
  const value = round1(totalValue);

  const isGuestFavorite = averageRating >= 4.8 && reviewCount >= 5;

  await Property.findByIdAndUpdate(propertyId, {
    averageRating,
    reviewCount,
    categoryRatings: {
      cleanliness,
      accuracy,
      checkIn,
      communication,
      location,
      value,
    },
    isGuestFavorite,
  });
}
