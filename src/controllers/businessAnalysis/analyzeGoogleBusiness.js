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

    // Step 5: Calculate summary metrics
    const totalIssues = [
      ...scoringResult.seoIssues,
      ...scoringResult.uxIssues,
      ...scoringResult.localListingIssues,
    ].length;

    const criticalIssues = [
      ...scoringResult.seoIssues,
      ...scoringResult.uxIssues,
      ...scoringResult.localListingIssues,
    ].filter((issue) => issue.severity === 'critical').length;

    // Convert scores to expected format (SEO/40, UX/40, Local/20)
    const seoScoreFormatted = Math.round((scoringResult.seoScore / 100) * 40);
    const uxScoreFormatted = Math.round((scoringResult.uxScore / 100) * 40);
    const localScoreFormatted = Math.round((scoringResult.localListingScore / 100) * 20);

    // Step 6: Compile final report
    const analysisReport = {
      // Summary scores (formatted to match expected output)
      summary_score: scoringResult.summaryScore,
      seo_score: seoScoreFormatted,
      ux_score: uxScoreFormatted,
      local_listing_score: localScoreFormatted,

      // Summary metrics for dashboard
      summary_metrics: {
        total_issues_found: totalIssues,
        critical_issues: criticalIssues,
        total_categories_reviewed: 3,
        categories_needing_work: [
          seoScoreFormatted < 32 ? 'SEO' : null,
          uxScoreFormatted < 32 ? 'UX' : null,
          localScoreFormatted < 16 ? 'Local Listings' : null,
        ].filter(Boolean).length,
        overall_health:
          scoringResult.summaryScore >= 80
            ? 'Excellent'
            : scoringResult.summaryScore >= 60
            ? 'Good'
            : scoringResult.summaryScore >= 40
            ? 'Fair'
            : 'Poor',
      },

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

      // Market share and competitive intelligence (FOMO drivers)
      competitive_intelligence: {
        market_share_analysis: {
          your_market_share: serpAnalysis?.competitors
            ? Math.round(
                (100 / (serpAnalysis.competitors.filter((c) => c.type === 'local').length + 1)) *
                  (serpAnalysis.rankings_summary?.average_map_pack_position
                    ? (4 - serpAnalysis.rankings_summary.average_map_pack_position) / 3
                    : 0.1),
              )
            : 5,
          top_competitor_market_share:
            serpAnalysis?.competitors?.length > 0
              ? Math.round(
                  (100 / (serpAnalysis.competitors.filter((c) => c.type === 'local').length + 1)) *
                    1.5,
                )
              : 25,
          market_leader:
            serpAnalysis?.competitors?.length > 0
              ? serpAnalysis.competitors.filter((c) => c.type === 'local')[0]?.name
              : 'Unknown',
          your_ranking_among_peers: serpAnalysis?.competitors
            ? serpAnalysis.competitors.filter((c) => c.type === 'local').length + 1
            : 'Unknown',
          total_competitors_in_market:
            serpAnalysis?.competitors?.filter((c) => c.type === 'local').length || 0,
        },
        revenue_impact_analysis: {
          estimated_monthly_lost_revenue: serpAnalysis?.rankings_summary
            ? Math.round(
                (serpAnalysis.rankings_summary.map_pack_appearances || 0) *
                  500 *
                  (1 -
                    (serpAnalysis.rankings_summary.average_map_pack_position
                      ? (4 - serpAnalysis.rankings_summary.average_map_pack_position) / 3
                      : 0)),
              )
            : 0,
          potential_monthly_revenue_gain: serpAnalysis?.rankings_summary
            ? Math.round(
                (keywords.length || 3) *
                  800 *
                  (serpAnalysis.rankings_summary.average_map_pack_position
                    ? (serpAnalysis.rankings_summary.average_map_pack_position - 1) / 3
                    : 0.8),
              )
            : 1200,
          ad_spend_needed_to_compete: serpAnalysis?.competitors
            ? Math.round(
                serpAnalysis.competitors.filter((c) => c.type === 'local').length * 300 + 500,
              )
            : 800,
          organic_vs_paid_cost_savings: '$2,400 - $4,800 per month',
        },
        competitor_advantages: serpAnalysis?.competitors
          ? serpAnalysis.competitors
              .filter((c) => c.type === 'local')
              .slice(0, 3)
              .map((competitor) => ({
                name: competitor.name,
                rating_advantage:
                  competitor.rating > businessProfile.rating
                    ? `${(competitor.rating - businessProfile.rating).toFixed(1)} stars higher`
                    : null,
                review_count_advantage:
                  competitor.reviews > businessProfile.user_ratings_total
                    ? `${competitor.reviews - businessProfile.user_ratings_total} more reviews`
                    : null,
                ranking_advantage:
                  competitor.average_position <
                  (serpAnalysis.rankings_summary?.average_map_pack_position || 10)
                    ? `Ranks ${Math.round(
                        (serpAnalysis.rankings_summary?.average_map_pack_position || 10) -
                          competitor.average_position,
                      )} positions higher`
                    : null,
                estimated_monthly_revenue_advantage:
                  competitor.average_position <
                  (serpAnalysis.rankings_summary?.average_map_pack_position || 10)
                    ? `$${Math.round(
                        ((serpAnalysis.rankings_summary?.average_map_pack_position || 10) -
                          competitor.average_position) *
                          400,
                      )} more per month`
                    : null,
              }))
          : [],
        industry_benchmarks: {
          average_rating_in_industry: industry === 'restaurant' ? 4.2 : 4.1,
          your_rating_vs_industry: businessProfile.rating
            ? businessProfile.rating >= 4.2
              ? 'Above average'
              : 'Below average'
            : 'No rating',
          average_reviews_in_industry: industry === 'restaurant' ? 150 : 120,
          your_reviews_vs_industry: businessProfile.user_ratings_total
            ? businessProfile.user_ratings_total >= 150
              ? 'Above average'
              : 'Below average'
            : 'No reviews',
          top_25_percent_rating: industry === 'restaurant' ? 4.5 : 4.4,
          gap_to_top_quartile: businessProfile.rating
            ? Math.max(0, (industry === 'restaurant' ? 4.5 : 4.4) - businessProfile.rating)
            : 0,
          businesses_outperforming_you: serpAnalysis?.competitors
            ? serpAnalysis.competitors.filter(
                (c) => c.type === 'local' && c.rating > businessProfile.rating,
              ).length
            : 0,
        },
        urgent_issues: [
          ...(businessProfile.rating < 4.0
            ? [
                {
                  severity: 'critical',
                  issue: 'Low rating crisis',
                  impact: 'Losing 60% of potential customers',
                  urgency: 'Fix immediately - every day costs $200+ in lost revenue',
                },
              ]
            : []),
          ...(businessProfile.user_ratings_total < 50
            ? [
                {
                  severity: 'high',
                  issue: 'Insufficient social proof',
                  impact: 'Customers choosing competitors with more reviews',
                  urgency: 'Need 20+ reviews this month to stay competitive',
                },
              ]
            : []),
          ...((serpAnalysis?.rankings_summary?.map_pack_appearances || 0) === 0
            ? [
                {
                  severity: 'critical',
                  issue: 'Invisible in local search',
                  impact: 'Missing 100% of local search traffic',
                  urgency: 'Competitors are capturing your customers daily',
                },
              ]
            : []),
          ...(scoringResult.summaryScore < 60
            ? [
                {
                  severity: 'high',
                  issue: 'Poor overall digital presence',
                  impact: 'Losing market share to better-optimized competitors',
                  urgency: 'Every week delayed = more customers lost permanently',
                },
              ]
            : []),
        ],
        growth_opportunities: [
          {
            opportunity: 'Capture competitor traffic',
            potential_impact: serpAnalysis?.competitors
              ? `${Math.round(
                  serpAnalysis.competitors.filter((c) => c.type === 'local').length * 150,
                )} additional monthly customers`
              : '300 additional monthly customers',
            action_needed: 'Improve local SEO rankings',
            timeline: '2-3 months',
            investment_required: '$500-1500/month',
            roi_estimate: '300-500%',
          },
          {
            opportunity: 'Review generation campaign',
            potential_impact: `Increase conversion rate by ${
              businessProfile.user_ratings_total < 100 ? '25-40%' : '15-20%'
            }`,
            action_needed: 'Systematic review collection',
            timeline: '1-2 months',
            investment_required: '$200-400/month',
            roi_estimate: '400-600%',
          },
          {
            opportunity: 'Website optimization',
            potential_impact: websiteAnalysis
              ? `Improve conversion rate by ${scoringResult.uxScore < 70 ? '30-50%' : '15-25%'}`
              : 'Create professional website',
            action_needed: websiteAnalysis ? 'Fix website issues' : 'Build optimized website',
            timeline: '1-3 months',
            investment_required: '$1000-3000',
            roi_estimate: '200-400%',
          },
          {
            opportunity: 'Social media presence',
            potential_impact: 'Increase brand awareness by 40-60%',
            action_needed: 'Active social media management',
            timeline: 'Ongoing',
            investment_required: '$300-600/month',
            roi_estimate: '150-300%',
          },
        ],
      },

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
