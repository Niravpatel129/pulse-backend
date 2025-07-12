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
        photos: businessProfile.photos?.slice(0, 5).map((photo) => photo.photo_reference),
        location: businessProfile.geometry?.location,
        price_level: businessProfile.price_level,
        business_status: businessProfile.business_status,
      },

      // Website analysis
      website_analysis: websiteAnalysis,

      // Local SEO analysis
      local_seo_analysis: serpAnalysis,

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
