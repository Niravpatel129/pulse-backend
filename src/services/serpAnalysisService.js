import { getJson } from 'serpapi';

/**
 * SERP Analysis Service
 * Performs local search ranking analysis and competitor research
 */
export class SerpAnalysisService {
  static API_KEY = process.env.SERPAPI_KEY;

  /**
   * Get business profile data from Google via SerpAPI
   * @param {string} businessName - Business name
   * @param {string} location - Business location
   * @param {string} placeId - Google Place ID (optional)
   * @returns {Promise<Object>} Business profile data from SerpAPI
   */
  static async getBusinessProfileFromSerp(businessName, location, placeId = null) {
    try {
      console.log('🔍 Fetching business profile from SerpAPI:', {
        businessName,
        location,
        placeId,
      });

      if (!this.API_KEY) {
        throw new Error('SerpAPI key is not configured');
      }

      // First try: Search for business name + location to get the business profile card
      const searchQuery = `${businessName} ${location}`;
      const supportedLocation = this.convertToSupportedLocation(location);

      const searchParams = {
        engine: 'google',
        q: searchQuery,
        location: supportedLocation,
        hl: 'en',
        gl: 'us',
        api_key: this.API_KEY,
      };

      console.log('📊 SerpAPI business profile request:', {
        ...searchParams,
        api_key: '***masked***',
      });

      const response = await getJson(searchParams);

      if (!response) {
        throw new Error('No response from SerpAPI');
      }

      if (response.error) {
        throw new Error(`SerpAPI error: ${response.error}`);
      }

      // Extract business profile data from knowledge graph or local results
      const profileData = this.extractBusinessProfileFromSerp(response, businessName);

      console.log('✅ Business profile extracted from SerpAPI:', {
        hasDescription: !!profileData.description,
        hasServiceOptions: !!profileData.service_options,
        hasHours: !!profileData.hours,
        hasSocialLinks: !!profileData.social_links,
      });

      return profileData;
    } catch (error) {
      console.error('❌ Failed to get business profile from SerpAPI:', error.message);
      return null;
    }
  }

  /**
   * Extract business profile data from SerpAPI response
   * @param {Object} response - SerpAPI response
   * @param {string} businessName - Business name to match
   * @returns {Object} Extracted business profile data
   */
  static extractBusinessProfileFromSerp(response, businessName) {
    const profileData = {
      description: null,
      service_options: [],
      social_links: {},
      hours: null,
      attributes: [],
    };

    try {
      // Check knowledge graph (right side panel info)
      if (response.knowledge_graph) {
        const kg = response.knowledge_graph;

        // Extract description
        if (kg.description) {
          profileData.description = kg.description;
        }

        // Extract service options and attributes
        if (kg.service_options) {
          profileData.service_options = kg.service_options;
        }

        // Extract hours
        if (kg.hours) {
          profileData.hours = kg.hours;
        }

        // Extract social links
        if (kg.profiles) {
          kg.profiles.forEach((profile) => {
            if (profile.name && profile.link) {
              profileData.social_links[profile.name.toLowerCase()] = profile.link;
            }
          });
        }
      }

      // Check local results for additional business info
      if (response.local_results && Array.isArray(response.local_results)) {
        const businessMatch = response.local_results.find(
          (result) =>
            result.title && result.title.toLowerCase().includes(businessName.toLowerCase()),
        );

        if (businessMatch) {
          // Extract service options from local result
          if (businessMatch.service_options) {
            profileData.service_options = [
              ...profileData.service_options,
              ...businessMatch.service_options,
            ];
          }

          // Extract hours
          if (businessMatch.hours && !profileData.hours) {
            profileData.hours = businessMatch.hours;
          }

          // Extract description if not already found
          if (businessMatch.description && !profileData.description) {
            profileData.description = businessMatch.description;
          }
        }
      }

      // Check answer box for business description
      if (response.answer_box && response.answer_box.answer && !profileData.description) {
        profileData.description = response.answer_box.answer;
      }

      // Check organic results for business website description
      if (
        response.organic_results &&
        Array.isArray(response.organic_results) &&
        !profileData.description
      ) {
        const businessWebsite = response.organic_results.find(
          (result) =>
            result.title && result.title.toLowerCase().includes(businessName.toLowerCase()),
        );

        if (businessWebsite && businessWebsite.snippet) {
          profileData.description = businessWebsite.snippet;
        }
      }
    } catch (error) {
      console.error('❌ Error extracting business profile from SERP:', error.message);
    }

    return profileData;
  }

  /**
   * Analyze local rankings for a business
   * @param {string} businessName - Business name
   * @param {string} location - Business location
   * @param {string[]} keywords - Keywords to analyze
   * @param {string} industry - Industry type
   * @returns {Promise<Object>} SERP analysis results
   */
  static async analyzeLocalRankings(businessName, location, keywords = [], industry) {
    const startTime = Date.now();

    try {
      console.log('🔍 Starting SERP analysis for:', { businessName, location, keywords, industry });

      if (!this.API_KEY) {
        throw new Error('SerpAPI key is not configured');
      }

      // Generate default keywords if none provided
      const analysisKeywords =
        keywords.length > 0
          ? keywords
          : this.generateDefaultKeywords(businessName, location, industry);

      console.log('📊 Analyzing keywords:', analysisKeywords);

      // Analyze each keyword
      const keywordAnalyses = await Promise.allSettled(
        analysisKeywords.map((keyword) => this.analyzeKeyword(keyword, location, businessName)),
      );

      // Process results
      const successfulAnalyses = keywordAnalyses
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value);

      const failedAnalyses = keywordAnalyses
        .filter((result) => result.status === 'rejected')
        .map((result) => result.reason);

      // Aggregate results
      const aggregatedResults = this.aggregateResults(successfulAnalyses, businessName);

      // Find competitors
      const competitors = this.extractCompetitors(successfulAnalyses, businessName);

      // Calculate local SEO metrics
      const localSeoMetrics = this.calculateLocalSeoMetrics(aggregatedResults);

      const analysisResult = {
        business_name: businessName,
        location,
        keywords_analyzed: analysisKeywords,
        industry,
        analysis_duration_ms: Date.now() - startTime,

        // Rankings summary
        rankings_summary: {
          total_keywords: analysisKeywords.length,
          successful_analyses: successfulAnalyses.length,
          failed_analyses: failedAnalyses.length,
          average_map_pack_position: aggregatedResults.averageMapPackPosition,
          average_organic_position: aggregatedResults.averageOrganicPosition,
          map_pack_appearances: aggregatedResults.mapPackAppearances,
          organic_appearances: aggregatedResults.organicAppearances,
          keywords_in_top_3_map_pack: aggregatedResults.topThreeMapPackCount,
          keywords_in_top_10_organic: aggregatedResults.topTenOrganicCount,
        },

        // Detailed keyword results
        keyword_results: successfulAnalyses,

        // Competitor analysis
        competitors,

        // Local SEO metrics
        local_seo_metrics: localSeoMetrics,

        // Analysis metadata
        analysis_metadata: {
          analyzed_at: new Date().toISOString(),
          successful_queries: successfulAnalyses.length,
          failed_queries: failedAnalyses.length,
          api_credits_used: successfulAnalyses.length,
        },
      };

      console.log('✅ SERP analysis completed:', {
        duration_ms: Date.now() - startTime,
        keywords_analyzed: analysisKeywords.length,
        map_pack_appearances: aggregatedResults.mapPackAppearances,
        competitors_found: competitors.length,
      });

      return analysisResult;
    } catch (error) {
      console.error('❌ SERP analysis failed:', {
        error: error.message,
        duration_ms: Date.now() - startTime,
      });

      return {
        business_name: businessName,
        location,
        error: error.message,
        analysis_duration_ms: Date.now() - startTime,
        successful_analyses: 0,
        failed_analyses: keywords.length || 0,
      };
    }
  }

  /**
   * Analyze a single keyword
   * @param {string} keyword - Keyword to analyze
   * @param {string} location - Search location
   * @param {string} businessName - Business name to look for
   * @returns {Promise<Object>} Keyword analysis result
   */
  static async analyzeKeyword(keyword, location, businessName) {
    try {
      console.log(`🔍 Analyzing keyword: "${keyword}" in ${location}`);

      // Convert full address to supported location format
      const supportedLocation = this.convertToSupportedLocation(location);
      console.log(`📍 Converted location: "${location}" -> "${supportedLocation}"`);

      const searchParams = {
        engine: 'google',
        q: keyword,
        location: supportedLocation,
        hl: 'en',
        gl: 'us',
        api_key: this.API_KEY,
      };

      console.log('📊 SerpAPI request params:', {
        ...searchParams,
        api_key: this.API_KEY ? '***masked***' : 'NOT_SET',
      });

      const response = await getJson(searchParams);

      console.log('📊 SerpAPI raw response:', {
        hasResponse: !!response,
        status: response?.search_metadata?.status,
        error: response?.error,
        organic_count: response?.organic_results?.length || 0,
        local_count: response?.local_results?.length || 0,
      });

      if (!response) {
        throw new Error('No response from SerpAPI');
      }

      // Check for SerpAPI errors
      if (response.error) {
        throw new Error(`SerpAPI error: ${response.error}`);
      }

      console.log(`📊 SerpAPI response for "${keyword}":`, {
        status: response.search_metadata?.status,
        organic_results_count: response.organic_results?.length || 0,
        local_results_count: response.local_results?.length || 0,
        error: response.error,
      });

      // Extract organic results
      const organicResults = response.organic_results || [];

      // Extract local results (map pack)
      const localResults = response.local_results || [];

      // Find business in organic results
      const organicPosition = this.findBusinessInResults(organicResults, businessName);

      // Find business in local results
      const localPosition = this.findBusinessInResults(localResults, businessName);

      // Extract competitor information
      const competitors = this.extractCompetitorsFromResults(
        organicResults,
        localResults,
        businessName,
      );

      // Calculate search volume estimation (simplified)
      const searchVolumeEstimate = this.estimateSearchVolume(keyword, response);

      const result = {
        keyword,
        location,
        organic_position: organicPosition,
        local_position: localPosition,
        in_map_pack: localPosition !== null,
        in_top_10_organic: organicPosition !== null && organicPosition <= 10,
        in_top_3_map_pack: localPosition !== null && localPosition <= 3,
        search_volume_estimate: searchVolumeEstimate,
        competitors_in_map_pack: competitors.local.slice(0, 3),
        competitors_in_organic: competitors.organic.slice(0, 10),
        total_organic_results: organicResults.length,
        total_local_results: localResults.length,
        analyzed_at: new Date().toISOString(),
      };

      console.log(`✅ Keyword analysis completed for "${keyword}":`, {
        organic_position: organicPosition,
        local_position: localPosition,
        in_map_pack: result.in_map_pack,
      });

      return result;
    } catch (error) {
      console.log('🚀 serp error:', error);
      console.error(`❌ Keyword analysis failed for "${keyword}":`, error.message);
      throw error;
    }
  }

  /**
   * Find business in search results
   * @param {Array} results - Search results
   * @param {string} businessName - Business name to find
   * @returns {number|null} Position or null if not found
   */
  static findBusinessInResults(results, businessName) {
    if (!results || !Array.isArray(results) || results.length === 0) return null;

    const normalizedBusinessName = businessName.toLowerCase();

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (!result) continue;

      const title = (result.title || '').toLowerCase();
      const snippet = (result.snippet || '').toLowerCase();

      // Check if business name is in title or snippet
      if (title.includes(normalizedBusinessName) || snippet.includes(normalizedBusinessName)) {
        return i + 1; // Return 1-based position
      }
    }

    return null;
  }

  /**
   * Extract competitors from search results
   * @param {Array} organicResults - Organic search results
   * @param {Array} localResults - Local search results
   * @param {string} businessName - Business name to exclude
   * @returns {Object} Competitor data
   */
  static extractCompetitorsFromResults(organicResults, localResults, businessName) {
    const normalizedBusinessName = businessName.toLowerCase();

    // Ensure arrays are properly defined
    const safeLocalResults = Array.isArray(localResults) ? localResults : [];
    const safeOrganicResults = Array.isArray(organicResults) ? organicResults : [];

    // Extract local competitors
    const localCompetitors = safeLocalResults
      .filter((result) => {
        const title = (result.title || '').toLowerCase();
        return !title.includes(normalizedBusinessName);
      })
      .map((result, index) => ({
        name: result.title,
        position: index + 1,
        rating: result.rating,
        reviews: result.reviews,
        address: result.address,
        phone: result.phone,
        website: result.website,
        type: result.type,
      }));

    // Extract organic competitors
    const organicCompetitors = safeOrganicResults
      .filter((result) => {
        const title = (result.title || '').toLowerCase();
        return !title.includes(normalizedBusinessName);
      })
      .map((result, index) => ({
        name: result.title,
        position: index + 1,
        url: result.link,
        snippet: result.snippet,
        displayed_link: result.displayed_link,
      }));

    return {
      local: localCompetitors,
      organic: organicCompetitors,
    };
  }

  /**
   * Generate default keywords for analysis
   * @param {string} businessName - Business name
   * @param {string} location - Location
   * @param {string} industry - Industry
   * @returns {string[]} Default keywords
   */
  static generateDefaultKeywords(businessName, location, industry) {
    const keywords = [`${businessName}`, `${businessName} ${location}`, `${businessName} near me`];

    if (industry) {
      keywords.push(
        `${industry} ${location}`,
        `${industry} near me`,
        `best ${industry} ${location}`,
        `${industry} services ${location}`,
      );
    }

    // Add location-specific keywords
    const locationParts = location.split(',').map((part) => part.trim());
    if (locationParts.length > 1) {
      const city = locationParts[0];
      keywords.push(
        `${businessName} ${city}`,
        industry ? `${industry} ${city}` : `${businessName} ${city}`,
      );
    }

    return keywords;
  }

  /**
   * Aggregate results from multiple keyword analyses
   * @param {Array} analyses - Array of keyword analysis results
   * @param {string} businessName - Business name
   * @returns {Object} Aggregated results
   */
  static aggregateResults(analyses, businessName) {
    if (!analyses || analyses.length === 0) {
      return {
        averageMapPackPosition: null,
        averageOrganicPosition: null,
        mapPackAppearances: 0,
        organicAppearances: 0,
        topThreeMapPackCount: 0,
        topTenOrganicCount: 0,
      };
    }

    const mapPackPositions = analyses
      .filter((analysis) => analysis.local_position !== null)
      .map((analysis) => analysis.local_position);

    const organicPositions = analyses
      .filter((analysis) => analysis.organic_position !== null)
      .map((analysis) => analysis.organic_position);

    const mapPackAppearances = analyses.filter((analysis) => analysis.in_map_pack).length;
    const organicAppearances = analyses.filter(
      (analysis) => analysis.organic_position !== null,
    ).length;
    const topThreeMapPackCount = analyses.filter((analysis) => analysis.in_top_3_map_pack).length;
    const topTenOrganicCount = analyses.filter((analysis) => analysis.in_top_10_organic).length;

    return {
      averageMapPackPosition:
        mapPackPositions.length > 0
          ? mapPackPositions.reduce((sum, pos) => sum + pos, 0) / mapPackPositions.length
          : null,
      averageOrganicPosition:
        organicPositions.length > 0
          ? organicPositions.reduce((sum, pos) => sum + pos, 0) / organicPositions.length
          : null,
      mapPackAppearances,
      organicAppearances,
      topThreeMapPackCount,
      topTenOrganicCount,
    };
  }

  /**
   * Extract competitor information from analyses
   * @param {Array} analyses - Array of keyword analysis results
   * @param {string} businessName - Business name
   * @returns {Array} Competitor data
   */
  static extractCompetitors(analyses, businessName) {
    const competitorMap = new Map();

    analyses.forEach((analysis) => {
      // Process local competitors
      analysis.competitors_in_map_pack.forEach((competitor) => {
        if (!competitorMap.has(competitor.name)) {
          competitorMap.set(competitor.name, {
            name: competitor.name,
            type: 'local',
            appearances: 0,
            average_position: 0,
            positions: [],
            rating: competitor.rating,
            reviews: competitor.reviews,
            address: competitor.address,
            phone: competitor.phone,
            website: competitor.website,
          });
        }

        const comp = competitorMap.get(competitor.name);
        comp.appearances++;
        comp.positions.push(competitor.position);
        comp.average_position =
          comp.positions.reduce((sum, pos) => sum + pos, 0) / comp.positions.length;
      });

      // Process organic competitors
      analysis.competitors_in_organic.forEach((competitor) => {
        const name = competitor.name;
        if (!competitorMap.has(name)) {
          competitorMap.set(name, {
            name: name,
            type: 'organic',
            appearances: 0,
            average_position: 0,
            positions: [],
            url: competitor.url,
            displayed_link: competitor.displayed_link,
          });
        }

        const comp = competitorMap.get(name);
        comp.appearances++;
        comp.positions.push(competitor.position);
        comp.average_position =
          comp.positions.reduce((sum, pos) => sum + pos, 0) / comp.positions.length;
      });
    });

    // Convert to array and sort by appearances
    return Array.from(competitorMap.values())
      .sort((a, b) => b.appearances - a.appearances)
      .slice(0, 10); // Top 10 competitors
  }

  /**
   * Calculate local SEO metrics
   * @param {Object} aggregatedResults - Aggregated results
   * @returns {Object} Local SEO metrics
   */
  static calculateLocalSeoMetrics(aggregatedResults) {
    const {
      mapPackAppearances,
      organicAppearances,
      topThreeMapPackCount,
      topTenOrganicCount,
      averageMapPackPosition,
      averageOrganicPosition,
    } = aggregatedResults;

    // Calculate visibility scores
    const mapPackVisibility =
      mapPackAppearances > 0 ? (topThreeMapPackCount / mapPackAppearances) * 100 : 0;
    const organicVisibility =
      organicAppearances > 0 ? (topTenOrganicCount / organicAppearances) * 100 : 0;

    // Calculate overall local SEO score
    let localSeoScore = 0;

    // Map pack performance (60% weight)
    if (mapPackAppearances > 0) {
      localSeoScore += mapPackVisibility * 0.6;
    }

    // Organic performance (40% weight)
    if (organicAppearances > 0) {
      localSeoScore += organicVisibility * 0.4;
    }

    return {
      map_pack_visibility: Math.round(mapPackVisibility),
      organic_visibility: Math.round(organicVisibility),
      local_seo_score: Math.round(localSeoScore),
      average_map_pack_position: averageMapPackPosition
        ? Math.round(averageMapPackPosition * 10) / 10
        : null,
      average_organic_position: averageOrganicPosition
        ? Math.round(averageOrganicPosition * 10) / 10
        : null,
      map_pack_appearance_rate: mapPackAppearances,
      organic_appearance_rate: organicAppearances,
    };
  }

  /**
   * Convert full address to SerpAPI supported location format
   * @param {string} location - Full address
   * @returns {string} Supported location format
   */
  static convertToSupportedLocation(location) {
    // Extract city and state from full address
    // Example: "5337 US-321, Gaston, SC 29053, United States" -> "Gaston,South Carolina,United States"

    try {
      // Common state abbreviations to full names
      const stateAbbreviations = {
        AL: 'Alabama',
        AK: 'Alaska',
        AZ: 'Arizona',
        AR: 'Arkansas',
        CA: 'California',
        CO: 'Colorado',
        CT: 'Connecticut',
        DE: 'Delaware',
        FL: 'Florida',
        GA: 'Georgia',
        HI: 'Hawaii',
        ID: 'Idaho',
        IL: 'Illinois',
        IN: 'Indiana',
        IA: 'Iowa',
        KS: 'Kansas',
        KY: 'Kentucky',
        LA: 'Louisiana',
        ME: 'Maine',
        MD: 'Maryland',
        MA: 'Massachusetts',
        MI: 'Michigan',
        MN: 'Minnesota',
        MS: 'Mississippi',
        MO: 'Missouri',
        MT: 'Montana',
        NE: 'Nebraska',
        NV: 'Nevada',
        NH: 'New Hampshire',
        NJ: 'New Jersey',
        NM: 'New Mexico',
        NY: 'New York',
        NC: 'North Carolina',
        ND: 'North Dakota',
        OH: 'Ohio',
        OK: 'Oklahoma',
        OR: 'Oregon',
        PA: 'Pennsylvania',
        RI: 'Rhode Island',
        SC: 'South Carolina',
        SD: 'South Dakota',
        TN: 'Tennessee',
        TX: 'Texas',
        UT: 'Utah',
        VT: 'Vermont',
        VA: 'Virginia',
        WA: 'Washington',
        WV: 'West Virginia',
        WI: 'Wisconsin',
        WY: 'Wyoming',
      };

      // Parse the location string
      const parts = location.split(',').map((part) => part.trim());

      if (parts.length >= 2) {
        // Look for city and state
        let city = null;
        let state = null;

        // Try to find state abbreviation in each part
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i].trim();

          // Check if this part contains a state abbreviation
          // Handle cases like "Gaston, SC 29053" where state and zip are together
          const words = part.split(' ');
          for (let j = 0; j < words.length; j++) {
            const word = words[j].trim();
            if (stateAbbreviations[word]) {
              state = stateAbbreviations[word];
              // City is usually the part before the state
              if (i > 0) {
                city = parts[i - 1].trim();
              }
              break;
            }
          }

          if (state) break;
        }

        if (city && state) {
          return `${city},${state},United States`;
        }

        // Fallback: try to use the state only
        if (state) {
          return `${state},United States`;
        }
      }

      // If parsing fails, return a general location
      return 'United States';
    } catch (error) {
      console.warn('⚠️ Failed to parse location, using fallback:', error.message);
      return 'United States';
    }
  }

  /**
   * Estimate search volume (simplified)
   * @param {string} keyword - Keyword
   * @param {Object} response - SerpAPI response
   * @returns {string} Search volume estimate
   */
  static estimateSearchVolume(keyword, response) {
    // This is a simplified estimation based on keyword characteristics
    // In a real implementation, you would use Google Keyword Planner API or similar

    const keywordLength = keyword.length;
    const hasLocation = keyword.toLowerCase().includes('near me') || keyword.includes(',');
    const isSpecific = keyword.split(' ').length > 3;

    if (hasLocation && isSpecific) {
      return 'Low (100-500)';
    } else if (hasLocation) {
      return 'Medium (500-2000)';
    } else if (keywordLength < 15) {
      return 'High (2000+)';
    } else {
      return 'Low (100-500)';
    }
  }
}
