/**
 * Scoring Service
 * Calculates overall scores based on analysis results
 */
export class ScoringService {
  // Scoring weights
  static SCORING_WEIGHTS = {
    SEO: {
      website_analysis: 0.6,
      serp_analysis: 0.3,
      business_profile: 0.1,
    },
    UX: {
      website_analysis: 0.8,
      business_profile: 0.2,
    },
    LOCAL_LISTING: {
      business_profile: 0.4,
      serp_analysis: 0.4,
      review_analysis: 0.2,
    },
  };

  /**
   * Calculate overall scores
   * @param {Object} data - All analysis data
   * @returns {Object} Calculated scores and issues
   */
  static calculateScores(data) {
    const { businessProfile, websiteAnalysis, serpAnalysis, reviewAnalysis, hasWebsite } = data;

    console.log('🔍 Calculating scores for business analysis');

    // Calculate individual scores
    const seoScore = this.calculateSeoScore(
      businessProfile,
      websiteAnalysis,
      serpAnalysis,
      hasWebsite,
    );
    const uxScore = this.calculateUxScore(businessProfile, websiteAnalysis, hasWebsite);
    const localListingScore = this.calculateLocalListingScore(
      businessProfile,
      serpAnalysis,
      reviewAnalysis,
    );

    // Calculate summary score (weighted average)
    const summaryScore = Math.round(
      seoScore.score * 0.4 + uxScore.score * 0.4 + localListingScore.score * 0.2,
    );

    console.log('✅ Scores calculated:', {
      seo: seoScore.score,
      ux: uxScore.score,
      local: localListingScore.score,
      summary: summaryScore,
    });

    return {
      summaryScore,
      seoScore: seoScore.score,
      uxScore: uxScore.score,
      localListingScore: localListingScore.score,

      // Detailed issues
      seoIssues: seoScore.issues,
      uxIssues: uxScore.issues,
      localListingIssues: localListingScore.issues,

      // Score breakdowns
      seoBreakdown: seoScore.breakdown,
      uxBreakdown: uxScore.breakdown,
      localListingBreakdown: localListingScore.breakdown,
    };
  }

  /**
   * Calculate SEO score
   * @param {Object} businessProfile - Business profile data
   * @param {Object} websiteAnalysis - Website analysis data
   * @param {Object} serpAnalysis - SERP analysis data
   * @param {boolean} hasWebsite - Whether business has a website
   * @returns {Object} SEO score and issues
   */
  static calculateSeoScore(businessProfile, websiteAnalysis, serpAnalysis, hasWebsite) {
    const issues = [];
    const breakdown = {};
    let totalScore = 0;

    // Business Profile SEO (10 points)
    let profileScore = 0;

    // Complete business information
    if (businessProfile.formatted_address) profileScore += 2;
    else issues.push({ type: 'seo', severity: 'medium', message: 'Business address is missing' });

    if (businessProfile.formatted_phone_number) profileScore += 2;
    else
      issues.push({ type: 'seo', severity: 'medium', message: 'Business phone number is missing' });

    if (businessProfile.website) profileScore += 2;
    else issues.push({ type: 'seo', severity: 'high', message: 'Business website is missing' });

    if (businessProfile.opening_hours) profileScore += 2;
    else issues.push({ type: 'seo', severity: 'low', message: 'Business hours are not specified' });

    if (businessProfile.photos && businessProfile.photos.length > 0) profileScore += 2;
    else issues.push({ type: 'seo', severity: 'medium', message: 'Business photos are missing' });

    breakdown.business_profile = Math.round(profileScore);
    totalScore += profileScore;

    if (!hasWebsite) {
      // If no website, give partial score and major issues
      issues.push({
        type: 'seo',
        severity: 'critical',
        message: 'No website found for SEO optimization',
      });

      breakdown.website_analysis = 0;
      breakdown.serp_analysis = serpAnalysis ? this.calculateSerpScore(serpAnalysis) : 0;

      totalScore += breakdown.serp_analysis;

      return {
        score: Math.min(40, totalScore), // Max 40 without website
        issues,
        breakdown,
      };
    }

    // Website Analysis SEO (60 points)
    let websiteScore = 0;

    if (websiteAnalysis && !websiteAnalysis.error) {
      const content = websiteAnalysis.page_content || {};
      const technical = websiteAnalysis.technical_seo || {};
      const performance = websiteAnalysis.performance_metrics || {};

      // Content SEO (30 points)
      if (content.title) {
        websiteScore += 5;
        if (content.title.length >= 30 && content.title.length <= 60) websiteScore += 3;
        else
          issues.push({
            type: 'seo',
            severity: 'medium',
            message: 'Page title length is not optimal (30-60 characters)',
          });
      } else {
        issues.push({ type: 'seo', severity: 'high', message: 'Page title is missing' });
      }

      if (content.metaDescription) {
        websiteScore += 5;
        if (content.metaDescription.length >= 120 && content.metaDescription.length <= 160)
          websiteScore += 3;
        else
          issues.push({
            type: 'seo',
            severity: 'medium',
            message: 'Meta description length is not optimal (120-160 characters)',
          });
      } else {
        issues.push({ type: 'seo', severity: 'high', message: 'Meta description is missing' });
      }

      if (content.h1Elements && content.h1Elements.length > 0) {
        websiteScore += 4;
        if (content.h1Elements.length > 1) {
          issues.push({
            type: 'seo',
            severity: 'low',
            message: 'Multiple H1 tags found (should be only one)',
          });
        }
      } else {
        issues.push({ type: 'seo', severity: 'medium', message: 'H1 tag is missing' });
      }

      if (content.images && content.images.length > 0) {
        const imagesWithAlt = content.images.filter((img) => img.hasAlt).length;
        const altRatio = imagesWithAlt / content.images.length;
        websiteScore += Math.round(altRatio * 5);
        if (altRatio < 0.8) {
          issues.push({
            type: 'seo',
            severity: 'medium',
            message: `${Math.round((1 - altRatio) * 100)}% of images missing alt text`,
          });
        }
      }

      if (content.structuredData && content.structuredData.length > 0) {
        websiteScore += 5;
      } else {
        issues.push({
          type: 'seo',
          severity: 'medium',
          message: 'Structured data (Schema markup) is missing',
        });
      }

      if (content.hasFavicon) websiteScore += 2;
      else issues.push({ type: 'seo', severity: 'low', message: 'Favicon is missing' });

      if (content.wordCount >= 300) websiteScore += 3;
      else
        issues.push({
          type: 'seo',
          severity: 'low',
          message: 'Page content is too short (less than 300 words)',
        });

      // Technical SEO (20 points)
      if (technical.is_secure) websiteScore += 5;
      else issues.push({ type: 'seo', severity: 'high', message: 'Website is not using HTTPS' });

      if (technical.hasMetaViewport) websiteScore += 3;
      else
        issues.push({ type: 'seo', severity: 'medium', message: 'Meta viewport tag is missing' });

      if (technical.hasCanonical) websiteScore += 2;
      else issues.push({ type: 'seo', severity: 'low', message: 'Canonical URL is missing' });

      if (technical.robotsContent && !technical.robotsContent.includes('noindex'))
        websiteScore += 2;
      else if (technical.robotsContent && technical.robotsContent.includes('noindex')) {
        issues.push({ type: 'seo', severity: 'critical', message: 'Page is set to noindex' });
      }

      // Performance SEO (10 points)
      if (performance.lighthouse_performance >= 90) websiteScore += 5;
      else if (performance.lighthouse_performance >= 70) websiteScore += 3;
      else if (performance.lighthouse_performance >= 50) websiteScore += 1;
      else
        issues.push({
          type: 'seo',
          severity: 'medium',
          message: 'Page performance is poor (affects SEO)',
        });

      if (performance.lighthouse_seo >= 90) websiteScore += 5;
      else if (performance.lighthouse_seo >= 70) websiteScore += 3;
      else if (performance.lighthouse_seo >= 50) websiteScore += 1;
      else issues.push({ type: 'seo', severity: 'high', message: 'Lighthouse SEO score is poor' });

      // Business context analysis
      if (content.context_analysis) {
        const contextScore = Object.values(content.context_analysis).filter(Boolean).length;
        websiteScore += Math.min(5, contextScore);

        if (!content.context_analysis.business_name_in_title) {
          issues.push({
            type: 'seo',
            severity: 'medium',
            message: 'Business name not found in page title',
          });
        }
        if (!content.context_analysis.location_in_title) {
          issues.push({
            type: 'seo',
            severity: 'medium',
            message: 'Location not found in page title',
          });
        }
      }
    } else {
      issues.push({
        type: 'seo',
        severity: 'critical',
        message: 'Website analysis failed or website is inaccessible',
      });
    }

    breakdown.website_analysis = Math.round(websiteScore);
    totalScore += websiteScore;

    // SERP Analysis SEO (30 points)
    const serpScore = this.calculateSerpScore(serpAnalysis);
    breakdown.serp_analysis = serpScore;
    totalScore += serpScore;

    return {
      score: Math.round(totalScore),
      issues,
      breakdown,
    };
  }

  /**
   * Calculate UX score
   * @param {Object} businessProfile - Business profile data
   * @param {Object} websiteAnalysis - Website analysis data
   * @param {boolean} hasWebsite - Whether business has a website
   * @returns {Object} UX score and issues
   */
  static calculateUxScore(businessProfile, websiteAnalysis, hasWebsite) {
    const issues = [];
    const breakdown = {};
    let totalScore = 0;

    // Business Profile UX (20 points)
    let profileScore = 0;

    if (businessProfile.formatted_phone_number) profileScore += 5;
    else
      issues.push({
        type: 'ux',
        severity: 'medium',
        message: 'Phone number missing for customer contact',
      });

    if (businessProfile.opening_hours) profileScore += 5;
    else
      issues.push({
        type: 'ux',
        severity: 'medium',
        message: 'Business hours missing for customer information',
      });

    if (businessProfile.photos && businessProfile.photos.length >= 3) profileScore += 5;
    else
      issues.push({
        type: 'ux',
        severity: 'low',
        message: 'Insufficient photos (recommended: 3 or more)',
      });

    if (businessProfile.rating >= 4.0) profileScore += 5;
    else if (businessProfile.rating >= 3.0) profileScore += 2;
    else
      issues.push({
        type: 'ux',
        severity: 'medium',
        message: 'Low customer rating affects user trust',
      });

    breakdown.business_profile = Math.round(profileScore);
    totalScore += profileScore;

    if (!hasWebsite) {
      issues.push({
        type: 'ux',
        severity: 'critical',
        message: 'No website available for enhanced user experience',
      });

      breakdown.website_analysis = 0;

      return {
        score: Math.min(30, totalScore), // Max 30 without website
        issues,
        breakdown,
      };
    }

    // Website Analysis UX (80 points)
    let websiteScore = 0;

    if (websiteAnalysis && !websiteAnalysis.error) {
      const content = websiteAnalysis.page_content || {};
      const ux = websiteAnalysis.ux_analysis || {};
      const mobile = websiteAnalysis.mobile_analysis || {};
      const performance = websiteAnalysis.performance_metrics || {};

      // Contact Options (25 points)
      if (ux.contactForms > 0) websiteScore += 10;
      else
        issues.push({ type: 'ux', severity: 'high', message: 'No contact forms found on website' });

      if (ux.chatWidgets > 0) websiteScore += 8;
      else
        issues.push({
          type: 'ux',
          severity: 'medium',
          message: 'No chat widget for instant customer support',
        });

      if (content.contactInfo && content.contactInfo.phones.length > 0) websiteScore += 4;
      else
        issues.push({
          type: 'ux',
          severity: 'medium',
          message: 'Phone number not visible on website',
        });

      if (content.contactInfo && content.contactInfo.emails.length > 0) websiteScore += 3;
      else
        issues.push({
          type: 'ux',
          severity: 'low',
          message: 'Email address not visible on website',
        });

      // Call-to-Actions (15 points)
      if (content.ctaElements >= 3) websiteScore += 15;
      else if (content.ctaElements >= 1) websiteScore += 8;
      else
        issues.push({
          type: 'ux',
          severity: 'high',
          message: 'No clear call-to-action buttons found',
        });

      // Trust Signals (20 points)
      if (ux.testimonialElements > 0) websiteScore += 10;
      else
        issues.push({
          type: 'ux',
          severity: 'medium',
          message: 'No testimonials or reviews displayed on website',
        });

      if (ux.socialLinks > 0) websiteScore += 5;
      else issues.push({ type: 'ux', severity: 'low', message: 'No social media links found' });

      if (ux.faqElements > 0) websiteScore += 5;
      else issues.push({ type: 'ux', severity: 'low', message: 'No FAQ section found' });

      // Mobile Experience (10 points)
      if (mobile.is_mobile_friendly) websiteScore += 10;
      else issues.push({ type: 'ux', severity: 'high', message: 'Website is not mobile-friendly' });

      // Performance UX (10 points)
      if (performance.page_load_time < 3000) websiteScore += 5;
      else if (performance.page_load_time < 5000) websiteScore += 2;
      else
        issues.push({
          type: 'ux',
          severity: 'medium',
          message: 'Page load time is too slow (affects user experience)',
        });

      if (performance.lighthouse_accessibility >= 90) websiteScore += 5;
      else if (performance.lighthouse_accessibility >= 70) websiteScore += 3;
      else
        issues.push({
          type: 'ux',
          severity: 'medium',
          message: 'Poor accessibility score affects user experience',
        });
    } else {
      issues.push({
        type: 'ux',
        severity: 'critical',
        message: 'Website analysis failed or website is inaccessible',
      });
    }

    breakdown.website_analysis = Math.round(websiteScore);
    totalScore += websiteScore;

    return {
      score: Math.round(totalScore),
      issues,
      breakdown,
    };
  }

  /**
   * Calculate Local Listing score
   * @param {Object} businessProfile - Business profile data
   * @param {Object} serpAnalysis - SERP analysis data
   * @param {Object} reviewAnalysis - Review analysis data
   * @returns {Object} Local Listing score and issues
   */
  static calculateLocalListingScore(businessProfile, serpAnalysis, reviewAnalysis) {
    const issues = [];
    const breakdown = {};
    let totalScore = 0;

    // Business Profile Completeness (40 points)
    let profileScore = 0;

    if (businessProfile.name) profileScore += 5;
    if (businessProfile.formatted_address) profileScore += 8;
    else
      issues.push({ type: 'local', severity: 'high', message: 'Business address is incomplete' });

    if (businessProfile.formatted_phone_number) profileScore += 5;
    else
      issues.push({
        type: 'local',
        severity: 'medium',
        message: 'Business phone number is missing',
      });

    if (businessProfile.website) profileScore += 5;
    else issues.push({ type: 'local', severity: 'medium', message: 'Business website is missing' });

    if (businessProfile.opening_hours) profileScore += 5;
    else
      issues.push({
        type: 'local',
        severity: 'medium',
        message: 'Business hours are not specified',
      });

    if (businessProfile.photos && businessProfile.photos.length >= 5) profileScore += 5;
    else if (businessProfile.photos && businessProfile.photos.length >= 1) profileScore += 3;
    else
      issues.push({
        type: 'local',
        severity: 'medium',
        message: 'Business needs more photos (recommended: 5 or more)',
      });

    if (businessProfile.types && businessProfile.types.length > 0) profileScore += 4;
    else
      issues.push({ type: 'local', severity: 'low', message: 'Business categories are missing' });

    if (businessProfile.business_status === 'OPERATIONAL') profileScore += 3;
    else
      issues.push({
        type: 'local',
        severity: 'high',
        message: 'Business status is not operational',
      });

    breakdown.business_profile = Math.round(profileScore);
    totalScore += profileScore;

    // SERP Performance (40 points)
    const serpScore = this.calculateSerpScore(serpAnalysis);
    breakdown.serp_analysis = serpScore;
    totalScore += serpScore;

    // Review Management (20 points)
    let reviewScore = 0;

    if (reviewAnalysis && !reviewAnalysis.error) {
      const stats = reviewAnalysis.review_stats || {};
      const sentiment = reviewAnalysis.sentiment_summary || {};

      if (stats.total_reviews >= 20) reviewScore += 8;
      else if (stats.total_reviews >= 10) reviewScore += 5;
      else if (stats.total_reviews >= 5) reviewScore += 3;
      else
        issues.push({
          type: 'local',
          severity: 'medium',
          message: 'Business needs more customer reviews',
        });

      if (stats.average_rating >= 4.0) reviewScore += 6;
      else if (stats.average_rating >= 3.5) reviewScore += 4;
      else if (stats.average_rating >= 3.0) reviewScore += 2;
      else
        issues.push({
          type: 'local',
          severity: 'high',
          message: 'Low average rating needs improvement',
        });

      if (sentiment.positive_percentage >= 70) reviewScore += 4;
      else if (sentiment.positive_percentage >= 50) reviewScore += 2;
      else
        issues.push({
          type: 'local',
          severity: 'medium',
          message: 'Customer sentiment is not positive enough',
        });

      if (stats.review_frequency === 'high') reviewScore += 2;
      else if (stats.review_frequency === 'medium') reviewScore += 1;
      else issues.push({ type: 'local', severity: 'low', message: 'Review frequency is low' });
    } else {
      issues.push({ type: 'local', severity: 'medium', message: 'Review analysis unavailable' });
    }

    breakdown.review_analysis = Math.round(reviewScore);
    totalScore += reviewScore;

    return {
      score: Math.round(totalScore),
      issues,
      breakdown,
    };
  }

  /**
   * Calculate SERP score component
   * @param {Object} serpAnalysis - SERP analysis data
   * @returns {number} SERP score
   */
  static calculateSerpScore(serpAnalysis) {
    if (!serpAnalysis || serpAnalysis.error) return 0;

    const summary = serpAnalysis.rankings_summary || {};
    const metrics = serpAnalysis.local_seo_metrics || {};

    let serpScore = 0;

    // Map pack performance (20 points)
    if (summary.keywords_in_top_3_map_pack >= 3) serpScore += 20;
    else if (summary.keywords_in_top_3_map_pack >= 2) serpScore += 15;
    else if (summary.keywords_in_top_3_map_pack >= 1) serpScore += 10;
    else if (summary.map_pack_appearances > 0) serpScore += 5;

    // Organic performance (10 points)
    if (summary.keywords_in_top_10_organic >= 3) serpScore += 10;
    else if (summary.keywords_in_top_10_organic >= 2) serpScore += 7;
    else if (summary.keywords_in_top_10_organic >= 1) serpScore += 5;
    else if (summary.organic_appearances > 0) serpScore += 2;

    return Math.round(serpScore);
  }

  /**
   * Get score category
   * @param {number} score - Score value
   * @returns {string} Score category
   */
  static getScoreCategory(score) {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 70) return 'Fair';
    if (score >= 60) return 'Poor';
    return 'Critical';
  }

  /**
   * Get score color
   * @param {number} score - Score value
   * @returns {string} Score color
   */
  static getScoreColor(score) {
    if (score >= 90) return 'green';
    if (score >= 80) return 'lightgreen';
    if (score >= 70) return 'yellow';
    if (score >= 60) return 'orange';
    return 'red';
  }
}
