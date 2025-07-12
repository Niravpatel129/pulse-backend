import asyncHandler from '../../middleware/asyncHandler.js';
import { GooglePlacesService } from '../../services/googlePlacesService.js';
import { RecommendationService } from '../../services/recommendationService.js';
import { ReviewSentimentService } from '../../services/reviewSentimentService.js';
import { ScoringService } from '../../services/scoringService.js';
import { SerpAnalysisService } from '../../services/serpAnalysisService.js';
import { WebsiteAnalysisService } from '../../services/websiteAnalysisService.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

/**
 * @desc    Analyze a Google Business listing
 * @route   POST /api/analyze-google-business
 * @access  Public
 */
export const analyzeGoogleBusiness = asyncHandler(async (req, res) => {
  const startTime = Date.now();

  try {
    const { business_name, location, place_id, keywords = [], industry } = req.body;

    console.log('🔍 Starting Google Business analysis:', {
      business_name,
      location,
      place_id,
      keywords,
      industry,
    });

    // Step 1: Resolve Google Business Profile
    let businessProfile;
    let resolvedPlaceId;

    if (place_id) {
      businessProfile = await GooglePlacesService.getBusinessByPlaceId(place_id);
      resolvedPlaceId = place_id;
    } else {
      const searchResult = await GooglePlacesService.searchBusiness(business_name, location);
      businessProfile = searchResult.businessProfile;
      resolvedPlaceId = searchResult.place_id;
    }

    if (!businessProfile) {
      throw new ApiError('Business not found', 404);
    }

    console.log('✅ Business profile resolved:', {
      name: businessProfile.name,
      place_id: resolvedPlaceId,
      website: businessProfile.website,
      rating: businessProfile.rating,
    });

    // Step 2: Parallel analysis execution
    const analysisPromises = [];

    // Website analysis (if website exists)
    let websiteAnalysisPromise = null;
    if (businessProfile.website) {
      websiteAnalysisPromise = WebsiteAnalysisService.analyzeWebsite(businessProfile.website, {
        businessName: businessProfile.name,
        location: businessProfile.formatted_address,
        industry,
      });
      analysisPromises.push(websiteAnalysisPromise);
    }

    // SERP analysis for local rankings
    const serpAnalysisPromise = SerpAnalysisService.analyzeLocalRankings(
      businessProfile.name,
      businessProfile.formatted_address,
      keywords,
      industry,
    );
    analysisPromises.push(serpAnalysisPromise);

    // Review sentiment analysis
    const reviewAnalysisPromise = ReviewSentimentService.analyzeReviews(
      businessProfile.reviews || [],
      resolvedPlaceId,
    );
    analysisPromises.push(reviewAnalysisPromise);

    // Execute all analyses
    const results = await Promise.allSettled(analysisPromises);

    // Process results
    const websiteAnalysis = websiteAnalysisPromise
      ? results[0].status === 'fulfilled'
        ? results[0].value
        : null
      : null;

    const serpAnalysis =
      results[websiteAnalysisPromise ? 1 : 0].status === 'fulfilled'
        ? results[websiteAnalysisPromise ? 1 : 0].value
        : null;

    const reviewAnalysis =
      results[websiteAnalysisPromise ? 2 : 1].status === 'fulfilled'
        ? results[websiteAnalysisPromise ? 2 : 1].value
        : null;

    // Step 3: Calculate scores
    const scoringResult = ScoringService.calculateScores({
      businessProfile,
      websiteAnalysis,
      serpAnalysis,
      reviewAnalysis,
      hasWebsite: !!businessProfile.website,
    });

    // Step 4: Generate recommendations
    const recommendations = RecommendationService.generateRecommendations({
      businessProfile,
      websiteAnalysis,
      serpAnalysis,
      reviewAnalysis,
      scoringResult,
      industry,
    });

    // Step 5: Compile final report
    const analysisReport = {
      // Summary scores
      summary_score: scoringResult.summaryScore,
      seo_score: scoringResult.seoScore,
      ux_score: scoringResult.uxScore,
      local_listing_score: scoringResult.localListingScore,

      // Detailed analysis
      google_business_profile: {
        place_id: resolvedPlaceId,
        name: businessProfile.name,
        address: businessProfile.formatted_address,
        phone: businessProfile.formatted_phone_number,
        website: businessProfile.website,
        rating: businessProfile.rating,
        review_count: businessProfile.user_ratings_total,
        categories: businessProfile.types,
        opening_hours: businessProfile.opening_hours,
        photos: businessProfile.photos?.slice(0, 5).map((photo) => ({
          photo_reference: photo.photo_reference,
          width: photo.width,
          height: photo.height,
          photo_url: GooglePlacesService.getPhotoUrl(photo.photo_reference, 800),
          thumbnail_url: GooglePlacesService.getPhotoUrl(photo.photo_reference, 400),
        })),
        location: businessProfile.geometry?.location,
        price_level: businessProfile.price_level,
        business_status: businessProfile.business_status,
      },

      // Website analysis
      website_analysis: websiteAnalysis,

      // Local SEO analysis
      local_seo_analysis: serpAnalysis,

      // Keyword performance breakdown (How you're doing online)
      keyword_performance: serpAnalysis?.keyword_results
        ? {
            summary: {
              total_keywords_analyzed: serpAnalysis.keyword_results.length,
              ranking_in_map_pack: serpAnalysis.keyword_results.filter((k) => k.in_map_pack).length,
              ranking_in_organic: serpAnalysis.keyword_results.filter(
                (k) => k.organic_position !== null,
              ).length,
              average_map_pack_position: serpAnalysis.rankings_summary?.average_map_pack_position,
              average_organic_position: serpAnalysis.rankings_summary?.average_organic_position,
            },
            detailed_results: serpAnalysis.keyword_results.map((result) => ({
              keyword: result.keyword,
              location: result.location,
              your_business: {
                map_pack_position: result.local_position,
                organic_position: result.organic_position,
                map_pack_status: result.in_map_pack
                  ? `#${result.local_position} map pack`
                  : 'Unranked map pack',
                organic_status: result.organic_position
                  ? `#${result.organic_position} organic`
                  : 'Unranked organic',
                in_top_3_map_pack: result.in_top_3_map_pack,
                in_top_10_organic: result.in_top_10_organic,
              },
              top_competitor:
                result.competitors_in_map_pack?.length > 0
                  ? {
                      name: result.competitors_in_map_pack[0].name,
                      position: result.competitors_in_map_pack[0].position,
                      rating: result.competitors_in_map_pack[0].rating,
                      review_count: result.competitors_in_map_pack[0].reviews,
                    }
                  : null,
              all_competitors_in_map_pack: result.competitors_in_map_pack || [],
              search_volume_estimate: result.search_volume_estimate,
              analyzed_at: result.analyzed_at,
            })),
          }
        : null,

      // Competitors ranking (Who's beating you on Google)
      competitors_ranking: serpAnalysis?.competitors
        ? {
            your_business: {
              name: businessProfile.name,
              rating: businessProfile.rating,
              review_count: businessProfile.user_ratings_total,
              position: serpAnalysis.rankings_summary?.average_map_pack_position || null,
            },
            competitors: serpAnalysis.competitors
              .filter((c) => c.type === 'local')
              .slice(0, 6)
              .map((competitor, index) => ({
                name: competitor.name,
                rating: competitor.rating,
                review_count: competitor.reviews,
                position: competitor.average_position,
                rank: index + 1,
                beating_you:
                  competitor.average_position <
                  (serpAnalysis.rankings_summary?.average_map_pack_position || 999),
              })),
            total_competitors_found: serpAnalysis.competitors.length,
          }
        : null,

      // Review sentiment
      review_sentiment: reviewAnalysis,

      // Issues and recommendations
      seo_issues: scoringResult.seoIssues,
      ux_issues: scoringResult.uxIssues,
      local_listing_issues: scoringResult.localListingIssues,
      recommendations: recommendations,

      // Metadata
      analysis_metadata: {
        analyzed_at: new Date().toISOString(),
        analysis_duration_ms: Date.now() - startTime,
        keywords_analyzed: keywords,
        industry: industry,
      },
    };

    console.log('✅ Analysis completed successfully:', {
      duration_ms: Date.now() - startTime,
      summary_score: scoringResult.summaryScore,
      has_website: !!businessProfile.website,
      recommendations_count: recommendations.length,
    });

    res
      .status(200)
      .json(new ApiResponse(200, analysisReport, 'Business analysis completed successfully'));
  } catch (error) {
    console.error('❌ Business analysis failed:', {
      error: error.message,
      stack: error.stack,
      duration_ms: Date.now() - startTime,
    });

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(`Business analysis failed: ${error.message}`, 500);
  }
});
