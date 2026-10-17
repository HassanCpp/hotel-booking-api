import { Request } from 'express';

export interface DetectedLocation {
  countryCode: string;
  countryName: string;
  source: 'QUERY' | 'HEADER' | 'TIMEZONE' | 'DEFAULT';
  timezone?: string;
}

const COUNTRY_NAMES: Record<string, string> = {
  PK: 'Pakistan',
  AE: 'United Arab Emirates',
  SA: 'Saudi Arabia',
  QA: 'Qatar',
  BH: 'Bahrain',
  OM: 'Oman',
  KW: 'Kuwait',
  TR: 'Turkey',
  GB: 'United Kingdom',
  US: 'United States',
  CA: 'Canada',
  DE: 'Germany',
  FR: 'France',
  ES: 'Spain',
  IT: 'Italy',
  CH: 'Switzerland',
  MY: 'Malaysia',
  TH: 'Thailand',
  SG: 'Singapore',
  AU: 'Australia',
  JP: 'Japan',
  ID: 'Indonesia',
  GR: 'Greece',
};

// Common timezones to ISO 2-letter Country Codes mapping
const TIMEZONE_TO_COUNTRY: Record<string, { code: string; name: string }> = {
  'Asia/Karachi': { code: 'PK', name: 'Pakistan' },
  'Asia/Dubai': { code: 'AE', name: 'United Arab Emirates' },
  'Asia/Muscat': { code: 'OM', name: 'Oman' },
  'Asia/Riyadh': { code: 'SA', name: 'Saudi Arabia' },
  'Asia/Qatar': { code: 'QA', name: 'Qatar' },
  'Asia/Bahrain': { code: 'BH', name: 'Bahrain' },
  'Asia/Kuwait': { code: 'KW', name: 'Kuwait' },
  'Europe/London': { code: 'GB', name: 'United Kingdom' },
  'America/New_York': { code: 'US', name: 'United States' },
  'America/Chicago': { code: 'US', name: 'United States' },
  'America/Denver': { code: 'US', name: 'United States' },
  'America/Los_Angeles': { code: 'US', name: 'United States' },
  'America/Phoenix': { code: 'US', name: 'United States' },
  'America/Toronto': { code: 'CA', name: 'Canada' },
  'America/Vancouver': { code: 'CA', name: 'Canada' },
  'Europe/Paris': { code: 'FR', name: 'France' },
  'Europe/Berlin': { code: 'DE', name: 'Germany' },
  'Europe/Rome': { code: 'IT', name: 'Italy' },
  'Europe/Madrid': { code: 'ES', name: 'Spain' },
  'Europe/Zurich': { code: 'CH', name: 'Switzerland' },
  'Europe/Istanbul': { code: 'TR', name: 'Turkey' },
  'Asia/Tokyo': { code: 'JP', name: 'Japan' },
  'Asia/Makassar': { code: 'ID', name: 'Indonesia' },
  'Asia/Jakarta': { code: 'ID', name: 'Indonesia' },
  'Europe/Athens': { code: 'GR', name: 'Greece' },
  'Asia/Kuala_Lumpur': { code: 'MY', name: 'Malaysia' },
  'Asia/Bangkok': { code: 'TH', name: 'Thailand' },
  'Asia/Singapore': { code: 'SG', name: 'Singapore' },
  'Australia/Sydney': { code: 'AU', name: 'Australia' },
  'Australia/Melbourne': { code: 'AU', name: 'Australia' },
};

/**
 * Resolves visitor's country using multi-layer resolution:
 * 1. Explicit query parameter `?country=PK` (for user country switcher)
 * 2. Reverse proxy / CDN edge headers (Cloudflare, AWS CloudFront, Vercel)
 * 3. Client timezone header `x-client-timezone` (from browser Intl API)
 * 4. Default platform fallback: 'PK' (Pakistan)
 */
export function resolveVisitorLocation(req: Request): DetectedLocation {
  // 1. Explicit query parameter
  const queryCountry = typeof req.query.country === 'string' ? req.query.country.trim().toUpperCase() : null;
  if (queryCountry && queryCountry.length === 2) {
    return {
      countryCode: queryCountry,
      countryName: COUNTRY_NAMES[queryCountry] || queryCountry,
      source: 'QUERY',
    };
  }

  // 2. Edge CDN / Ingress Proxy Headers
  const headerCountry = (
    req.headers['cf-ipcountry'] ||
    req.headers['x-country-code'] ||
    req.headers['x-vercel-ip-country'] ||
    req.headers['cloudfront-viewer-country']
  ) as string | undefined;

  if (headerCountry && typeof headerCountry === 'string' && headerCountry.length === 2 && headerCountry !== 'XX') {
    const code = headerCountry.toUpperCase();
    return {
      countryCode: code,
      countryName: COUNTRY_NAMES[code] || code,
      source: 'HEADER',
    };
  }

  // 3. Client Timezone header
  const clientTimezone = (req.headers['x-client-timezone'] || req.query.timezone) as string | undefined;
  if (clientTimezone && typeof clientTimezone === 'string' && TIMEZONE_TO_COUNTRY[clientTimezone]) {
    const mapped = TIMEZONE_TO_COUNTRY[clientTimezone];
    return {
      countryCode: mapped.code,
      countryName: mapped.name,
      timezone: clientTimezone,
      source: 'TIMEZONE',
    };
  }

  // 4. Default Platform Fallback
  return {
    countryCode: 'PK',
    countryName: 'Pakistan',
    source: 'DEFAULT',
  };
}
