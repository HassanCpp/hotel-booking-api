import { HotelAccount } from '../models/HotelAccount';

export async function generateUniqueHotelSlug(name: string): Promise<string> {
  let baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!baseSlug) {
    baseSlug = 'hotel';
  }

  let slug = baseSlug;
  let counter = 1;

  while (await HotelAccount.findOne({ slug })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}
