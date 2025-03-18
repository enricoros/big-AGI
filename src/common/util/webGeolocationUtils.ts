import { Release } from '../app.release';

import { frontendSideFetch } from './clientFetchers';
import { isBrowser } from './pwaUtils';


export const isWebGeolocationSupported = isBrowser && !!navigator.geolocation;


export interface WebGeolocation {

  // approximate geolocation
  city?: string;
  region?: string;
  country?: string;
  timezone: string;

  // other geolocation data, for future use
  coords?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };

  // when it was measured
  timestamp: number;
}


// in-mem cache
let _cache: WebGeolocation | undefined = undefined;


/**
 * Gets cached geolocation data without requesting permissions
 */
export function webGeolocationCached(): WebGeolocation | undefined {
  return _cache;
}


/**
 * Get current geolocation permission state
 */
export async function webGeolocationPermissionState(): Promise<
  | 'granted' | 'denied' | 'prompt' // from the API
  | 'unsupported' // if there's no API
> {
  if (!isWebGeolocationSupported) return 'unsupported';

  if (navigator.permissions) {
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return permissionStatus.state;
    } catch (e) {
      console.warn('Failed to query geolocation permission:', e);
    }
  }

  // if we have cached data, we had permission at some point
  return _cache ? 'granted' : 'prompt';
}


/**
 * Request geolocation permission and retrieve location data
 */
export async function webGeolocationRequest(): Promise<WebGeolocation | null> {

  // return cached data if available and recent (last 60 minutes)
  if (_cache && (Date.now() - _cache.timestamp < 60 * 60 * 1000))
    return _cache;

  if (!isWebGeolocationSupported) {
    console.warn('Geolocation is not supported in this environment');
    return null;
  }

  try {

    // request position with a reasonable timeout
    const position = await _getCurrentPositionAsync({
      // don't need high accuracy for this
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 10 * 60 * 1000, // Accept a position up to 10 minutes old
    });

    // create basic geolocation data
    const data: WebGeolocation = {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      coords: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      },
      timestamp: Date.now(),
    };

    // try to enhance with reverse geocoding (for city, region, country)
    try {
      return _cache = await _enhanceWithLocationData(data);
    } catch (error) {
      // if reverse geocoding fails, still return and cache basic data
      _cache = data;
      return data;
    }
  } catch (error) {
    console.log('[DEV] Geolocation request failed:', error);
    return null;
  }
}


// Private helper functions

function _getCurrentPositionAsync(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

async function _enhanceWithLocationData(data: WebGeolocation): Promise<WebGeolocation> {
  if (!data.coords) return data;

  try {
    const { latitude, longitude } = data.coords;

    // For now, use Nominatim (OpenStreetMap) for reverse geocoding
    // TODO: use a robust geocoding service
    const response = await frontendSideFetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&accept-language=${navigator.language || 'en'}`, {
      headers: {
        // required by Nominatim
        'User-Agent': `Big-AGI/${Release.App.versionCode}`,
      },
    });

    if (!response.ok) {
      console.warn('Reverse geocoding failed:', response.statusText);
      return data; // Return the original data without enhancement
    }

    const result = await response.json();
    if (result.address) {
      // Format data according to OpenAI expectations
      return {
        ...data,
        city: result.address.city || result.address.town || result.address.village || undefined,
        region: result.address.state || result.address.county || undefined,
        country: result.address.country_code?.toUpperCase(),
      };
    }

    return data;
  } catch (error) {
    console.warn('Reverse geocoding failed:', error);
    return data; // Return the original data without enhancement
  }
}
