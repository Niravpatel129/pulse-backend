import axios from 'axios';

/**
 * Google Places API Service
 * Handles business lookup and details retrieval
 */
export class GooglePlacesService {
  static BASE_URL = 'https://maps.googleapis.com/maps/api/place';
  static API_KEY = process.env.GOOGLE_PLACES_API_KEY;

  /**
   * Search for a business by name and location
   * @param {string} businessName - The business name to search for
   * @param {string} location - The location to search in
   * @returns {Promise<{businessProfile: Object, place_id: string}>}
   */
  static async searchBusiness(businessName, location) {
    try {
      if (!this.API_KEY) {
        throw new Error('Google Places API key is not configured');
      }

      const searchQuery = `${businessName} ${location}`;

      console.log('🔍 Searching for business:', { businessName, location, searchQuery });

      // Use Text Search API to find the business
      const searchResponse = await axios.get(`${this.BASE_URL}/textsearch/json`, {
        params: {
          query: searchQuery,
          key: this.API_KEY,
          fields: 'place_id,name,formatted_address,rating,user_ratings_total,types,geometry',
          type: 'establishment',
        },
      });

      if (searchResponse.data.status !== 'OK') {
        throw new Error(`Google Places API error: ${searchResponse.data.status}`);
      }

      if (!searchResponse.data.results || searchResponse.data.results.length === 0) {
        throw new Error('No businesses found matching the search criteria');
      }

      // Get the first result (most relevant)
      const candidate = searchResponse.data.results[0];
      const placeId = candidate.place_id;

      console.log('✅ Found business candidate:', {
        name: candidate.name,
        place_id: placeId,
        address: candidate.formatted_address,
      });

      // Get detailed information using Place Details API
      const businessProfile = await this.getBusinessByPlaceId(placeId);

      return {
        businessProfile,
        place_id: placeId,
      };
    } catch (error) {
      console.error('❌ Error searching for business:', error.message);
      throw error;
    }
  }

  /**
   * Get business details by Place ID
   * @param {string} placeId - The Google Places ID
   * @returns {Promise<Object>} Business profile details
   */
  static async getBusinessByPlaceId(placeId) {
    try {
      if (!this.API_KEY) {
        throw new Error('Google Places API key is not configured');
      }

      console.log('🔍 Fetching business details for place_id:', placeId);

      // Define the fields we want to retrieve
      const fields = [
        'place_id',
        'name',
        'formatted_address',
        'formatted_phone_number',
        'international_phone_number',
        'website',
        'rating',
        'user_ratings_total',
        'price_level',
        'types',
        'geometry',
        'opening_hours',
        'photos',
        'reviews',
        'business_status',
        'vicinity',
        'url',
      ].join(',');

      const response = await axios.get(`${this.BASE_URL}/details/json`, {
        params: {
          place_id: placeId,
          fields: fields,
          key: this.API_KEY,
          reviews_sort: 'newest',
        },
      });

      if (response.data.status !== 'OK') {
        throw new Error(`Google Places API error: ${response.data.status}`);
      }

      if (!response.data.result) {
        throw new Error('No business details found for the given place ID');
      }

      const businessProfile = response.data.result;

      // Process and enhance the business profile
      const processedProfile = this.processBusinessProfile(businessProfile);

      console.log('✅ Business details retrieved:', {
        name: processedProfile.name,
        website: processedProfile.website,
        rating: processedProfile.rating,
        review_count: processedProfile.user_ratings_total,
        has_photos: !!processedProfile.photos?.length,
        has_reviews: !!processedProfile.reviews?.length,
      });

      return processedProfile;
    } catch (error) {
      console.error('❌ Error fetching business details:', error.message);
      throw error;
    }
  }

  /**
   * Process and enhance business profile data
   * @param {Object} rawProfile - Raw business profile from Google Places API
   * @returns {Object} Processed business profile
   */
  static processBusinessProfile(rawProfile) {
    try {
      // Clean and normalize website URL
      let website = rawProfile.website;
      if (website && !website.startsWith('http')) {
        website = `https://${website}`;
      }

      // Extract location coordinates
      const location = rawProfile.geometry?.location;
      const coordinates = location
        ? {
            lat: location.lat,
            lng: location.lng,
          }
        : null;

      // Process opening hours
      const openingHours = rawProfile.opening_hours
        ? {
            open_now: rawProfile.opening_hours.open_now,
            periods: rawProfile.opening_hours.periods,
            weekday_text: rawProfile.opening_hours.weekday_text,
          }
        : null;

      // Process photos
      const photos = rawProfile.photos
        ? rawProfile.photos.map((photo) => ({
            photo_reference: photo.photo_reference,
            width: photo.width,
            height: photo.height,
            html_attributions: photo.html_attributions,
          }))
        : [];

      // Process reviews
      const reviews = rawProfile.reviews
        ? rawProfile.reviews.map((review) => ({
            author_name: review.author_name,
            author_url: review.author_url,
            profile_photo_url: review.profile_photo_url,
            rating: review.rating,
            relative_time_description: review.relative_time_description,
            text: review.text,
            time: review.time,
          }))
        : [];

      // Determine primary category
      const primaryCategory =
        rawProfile.types && rawProfile.types.length > 0 ? rawProfile.types[0] : 'establishment';

      return {
        ...rawProfile,
        website,
        coordinates,
        opening_hours: openingHours,
        photos,
        reviews,
        primary_category: primaryCategory,
        // Add computed fields
        has_website: !!website,
        has_phone: !!rawProfile.formatted_phone_number,
        has_opening_hours: !!openingHours,
        photo_count: photos.length,
        review_count: reviews.length,
        average_rating: rawProfile.rating || 0,
        is_verified: rawProfile.business_status === 'OPERATIONAL',
      };
    } catch (error) {
      console.error('❌ Error processing business profile:', error.message);
      // Return the raw profile if processing fails
      return rawProfile;
    }
  }

  /**
   * Get photo URL from photo reference
   * @param {string} photoReference - Google Places photo reference
   * @param {number} maxWidth - Maximum width for the photo (default: 400)
   * @returns {string} Photo URL
   */
  static getPhotoUrl(photoReference, maxWidth = 400) {
    if (!photoReference || !this.API_KEY) {
      return null;
    }

    return `${this.BASE_URL}/photo?photoreference=${photoReference}&maxwidth=${maxWidth}&key=${this.API_KEY}`;
  }

  /**
   * Validate place ID format
   * @param {string} placeId - The place ID to validate
   * @returns {boolean} Whether the place ID is valid
   */
  static isValidPlaceId(placeId) {
    if (!placeId || typeof placeId !== 'string') {
      return false;
    }

    // Google Place IDs typically start with 'ChIJ' and contain base64-like characters
    return /^ChIJ[A-Za-z0-9_-]+$/.test(placeId);
  }
}
