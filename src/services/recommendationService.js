/**
 * Recommendation Service
 * Generates actionable recommendations based on analysis results
 */
export class RecommendationService {
  /**
   * Generate recommendations based on analysis results
   * @param {Object} data - All analysis data
   * @returns {Array} Array of recommendations
   */
  static generateRecommendations(data) {
    const {
      businessProfile,
      websiteAnalysis,
      serpAnalysis,
      reviewAnalysis,
      scoringResult,
      industry,
    } = data;

    console.log('🔍 Generating recommendations for business analysis');

    const recommendations = [];

    // Generate recommendations based on scoring issues
    if (scoringResult.seoIssues) {
      recommendations.push(
        ...this.generateSeoRecommendations(
          scoringResult.seoIssues,
          businessProfile,
          websiteAnalysis,
          industry,
        ),
      );
    }

    if (scoringResult.uxIssues) {
      recommendations.push(
        ...this.generateUxRecommendations(
          scoringResult.uxIssues,
          businessProfile,
          websiteAnalysis,
          industry,
        ),
      );
    }

    if (scoringResult.localListingIssues) {
      recommendations.push(
        ...this.generateLocalListingRecommendations(
          scoringResult.localListingIssues,
          businessProfile,
          serpAnalysis,
          reviewAnalysis,
        ),
      );
    }

    // Generate specific recommendations based on analysis results
    recommendations.push(
      ...this.generateWebsiteRecommendations(websiteAnalysis, businessProfile, industry),
    );
    recommendations.push(...this.generateSerpRecommendations(serpAnalysis, businessProfile));
    recommendations.push(...this.generateReviewRecommendations(reviewAnalysis, businessProfile));

    // Remove duplicates and prioritize
    const uniqueRecommendations = this.removeDuplicateRecommendations(recommendations);
    const prioritizedRecommendations = this.prioritizeRecommendations(
      uniqueRecommendations,
      scoringResult,
    );

    console.log('✅ Generated', prioritizedRecommendations.length, 'recommendations');

    return prioritizedRecommendations;
  }

  /**
   * Generate SEO recommendations
   * @param {Array} seoIssues - SEO issues from scoring
   * @param {Object} businessProfile - Business profile data
   * @param {Object} websiteAnalysis - Website analysis data
   * @param {string} industry - Industry type
   * @returns {Array} SEO recommendations
   */
  static generateSeoRecommendations(seoIssues, businessProfile, websiteAnalysis, industry) {
    const recommendations = [];

    seoIssues.forEach((issue) => {
      switch (issue.message) {
        case 'Business website is missing':
          recommendations.push({
            type: 'seo',
            category: 'website',
            priority: 'critical',
            title: 'Create a Business Website',
            description:
              'Having a website is essential for SEO and online visibility. Create a professional website with your business information, services, and contact details.',
            impact: 'high',
            effort: 'high',
            timeframe: '2-4 weeks',
            specific_actions: [
              'Choose a domain name that includes your business name',
              'Select a reliable web hosting provider',
              'Create pages for Home, About, Services, and Contact',
              'Include your business name, address, and phone number on every page',
              'Add a Google My Business link and social media profiles',
            ],
          });
          break;

        case 'Page title is missing':
          recommendations.push({
            type: 'seo',
            category: 'content',
            priority: 'high',
            title: 'Add Page Title Tags',
            description:
              'Add descriptive title tags to all pages. Include your business name and primary keywords.',
            impact: 'high',
            effort: 'low',
            timeframe: '1-2 days',
            specific_actions: [
              `Add title tag like "${businessProfile.name} - ${
                industry || 'Services'
              } in ${this.extractCityFromAddress(businessProfile.formatted_address)}"`,
              'Keep titles between 30-60 characters',
              'Include location and primary service keywords',
              'Make each page title unique',
            ],
          });
          break;

        case 'Meta description is missing':
          recommendations.push({
            type: 'seo',
            category: 'content',
            priority: 'high',
            title: 'Add Meta Descriptions',
            description:
              'Add compelling meta descriptions to improve click-through rates from search results.',
            impact: 'medium',
            effort: 'low',
            timeframe: '1-2 days',
            specific_actions: [
              'Write 120-160 character descriptions for each page',
              'Include your location and primary services',
              'Add a call-to-action like "Call now" or "Get quote"',
              'Make descriptions unique and compelling',
            ],
          });
          break;

        case 'Website is not using HTTPS':
          recommendations.push({
            type: 'seo',
            category: 'technical',
            priority: 'high',
            title: 'Implement HTTPS Security',
            description:
              'Switch to HTTPS to improve security and SEO rankings. Google prioritizes secure websites.',
            impact: 'high',
            effort: 'medium',
            timeframe: '1-3 days',
            specific_actions: [
              'Purchase and install an SSL certificate',
              'Update all internal links to use HTTPS',
              'Set up 301 redirects from HTTP to HTTPS',
              'Update Google My Business and social media profiles with HTTPS URL',
            ],
          });
          break;

        case 'Structured data (Schema markup) is missing':
          recommendations.push({
            type: 'seo',
            category: 'technical',
            priority: 'medium',
            title: 'Add Schema Markup',
            description:
              'Implement structured data to help search engines understand your business information.',
            impact: 'medium',
            effort: 'medium',
            timeframe: '3-5 days',
            specific_actions: [
              'Add LocalBusiness schema markup',
              'Include business name, address, phone, and hours',
              'Add review schema if you display reviews',
              "Use Google's Structured Data Testing Tool to validate",
            ],
          });
          break;

        default:
          if (issue.severity === 'critical' || issue.severity === 'high') {
            recommendations.push({
              type: 'seo',
              category: 'general',
              priority: issue.severity,
              title: 'Fix SEO Issue',
              description: issue.message,
              impact: issue.severity === 'critical' ? 'high' : 'medium',
              effort: 'medium',
              timeframe: '1-2 weeks',
            });
          }
      }
    });

    return recommendations;
  }

  /**
   * Generate UX recommendations
   * @param {Array} uxIssues - UX issues from scoring
   * @param {Object} businessProfile - Business profile data
   * @param {Object} websiteAnalysis - Website analysis data
   * @param {string} industry - Industry type
   * @returns {Array} UX recommendations
   */
  static generateUxRecommendations(uxIssues, businessProfile, websiteAnalysis, industry) {
    const recommendations = [];

    uxIssues.forEach((issue) => {
      switch (issue.message) {
        case 'No website available for enhanced user experience':
          recommendations.push({
            type: 'ux',
            category: 'website',
            priority: 'critical',
            title: 'Create User-Friendly Website',
            description:
              'Build a website focused on user experience with clear navigation and easy contact options.',
            impact: 'high',
            effort: 'high',
            timeframe: '2-4 weeks',
            specific_actions: [
              'Design a clean, mobile-responsive layout',
              'Add prominent contact buttons and phone numbers',
              'Include customer testimonials and reviews',
              'Create clear service descriptions and pricing',
              'Add online booking or inquiry forms',
            ],
          });
          break;

        case 'No contact forms found on website':
          recommendations.push({
            type: 'ux',
            category: 'contact',
            priority: 'high',
            title: 'Add Contact Forms',
            description:
              'Make it easy for customers to reach you by adding contact forms on key pages.',
            impact: 'high',
            effort: 'low',
            timeframe: '1-2 days',
            specific_actions: [
              'Add a contact form to your Contact page',
              'Include forms on service pages for specific inquiries',
              'Request only essential information (name, email, phone, message)',
              'Add a "Get Quote" or "Schedule Consultation" form',
              'Set up automatic email responses to form submissions',
            ],
          });
          break;

        case 'No clear call-to-action buttons found':
          recommendations.push({
            type: 'ux',
            category: 'conversion',
            priority: 'high',
            title: 'Add Clear Call-to-Action Buttons',
            description:
              'Guide visitors to take action with prominent, clear call-to-action buttons.',
            impact: 'high',
            effort: 'low',
            timeframe: '1-2 days',
            specific_actions: [
              'Add "Call Now" buttons with your phone number',
              'Include "Get Quote" or "Schedule Appointment" buttons',
              'Use contrasting colors to make buttons stand out',
              'Place CTAs above the fold and on every page',
              'Use action-oriented text like "Book Now" or "Contact Us Today"',
            ],
          });
          break;

        case 'Website is not mobile-friendly':
          recommendations.push({
            type: 'ux',
            category: 'mobile',
            priority: 'high',
            title: 'Optimize for Mobile Devices',
            description: 'Ensure your website works perfectly on smartphones and tablets.',
            impact: 'high',
            effort: 'medium',
            timeframe: '1-2 weeks',
            specific_actions: [
              'Implement responsive design that adapts to all screen sizes',
              'Make buttons and links easy to tap on mobile',
              'Optimize images for faster loading on mobile',
              'Use readable font sizes without zooming',
              'Test on multiple devices and browsers',
            ],
          });
          break;

        case 'No chat widget for instant customer support':
          recommendations.push({
            type: 'ux',
            category: 'customer_service',
            priority: 'medium',
            title: 'Add Live Chat Support',
            description:
              'Provide instant customer support with a chat widget to capture more leads.',
            impact: 'medium',
            effort: 'low',
            timeframe: '1-2 days',
            specific_actions: [
              'Install a chat widget (like Intercom, Zendesk, or Tawk.to)',
              'Set up automated greetings and common questions',
              'Train staff to respond quickly to chat inquiries',
              'Set business hours for chat availability',
              'Use chat to qualify leads and schedule appointments',
            ],
          });
          break;

        default:
          if (issue.severity === 'critical' || issue.severity === 'high') {
            recommendations.push({
              type: 'ux',
              category: 'general',
              priority: issue.severity,
              title: 'Improve User Experience',
              description: issue.message,
              impact: issue.severity === 'critical' ? 'high' : 'medium',
              effort: 'medium',
              timeframe: '1-2 weeks',
            });
          }
      }
    });

    return recommendations;
  }

  /**
   * Generate Local Listing recommendations
   * @param {Array} localIssues - Local listing issues from scoring
   * @param {Object} businessProfile - Business profile data
   * @param {Object} serpAnalysis - SERP analysis data
   * @param {Object} reviewAnalysis - Review analysis data
   * @returns {Array} Local listing recommendations
   */
  static generateLocalListingRecommendations(
    localIssues,
    businessProfile,
    serpAnalysis,
    reviewAnalysis,
  ) {
    const recommendations = [];

    localIssues.forEach((issue) => {
      switch (issue.message) {
        case 'Business needs more customer reviews':
          recommendations.push({
            type: 'local',
            category: 'reviews',
            priority: 'high',
            title: 'Increase Customer Reviews',
            description:
              'Actively encourage satisfied customers to leave reviews on Google and other platforms.',
            impact: 'high',
            effort: 'medium',
            timeframe: '2-4 weeks',
            specific_actions: [
              'Ask satisfied customers to leave reviews after service completion',
              'Send follow-up emails with direct links to your Google review page',
              'Create review request cards to hand out to customers',
              'Train staff to mention reviews during customer interactions',
              'Offer small incentives for honest reviews (where permitted)',
            ],
          });
          break;

        case 'Business photos are missing':
        case 'Business needs more photos (recommended: 5 or more)':
          recommendations.push({
            type: 'local',
            category: 'photos',
            priority: 'medium',
            title: 'Add High-Quality Business Photos',
            description:
              'Upload professional photos of your business, products, and services to attract customers.',
            impact: 'medium',
            effort: 'low',
            timeframe: '1-2 days',
            specific_actions: [
              'Take photos of your storefront, interior, and work areas',
              'Include photos of your products or services in action',
              'Add photos of your team and staff',
              'Use high-resolution images with good lighting',
              'Upload at least 5-10 photos to your Google My Business profile',
            ],
          });
          break;

        case 'Business hours are not specified':
          recommendations.push({
            type: 'local',
            category: 'information',
            priority: 'medium',
            title: 'Add Complete Business Hours',
            description: "Provide accurate business hours so customers know when you're available.",
            impact: 'medium',
            effort: 'low',
            timeframe: '1 day',
            specific_actions: [
              'Update your Google My Business profile with complete hours',
              'Include special hours for holidays',
              'Add hours to your website contact page',
              'Keep hours updated during seasonal changes',
              'Consider adding "24/7 emergency service" if applicable',
            ],
          });
          break;

        case 'Low average rating needs improvement':
          recommendations.push({
            type: 'local',
            category: 'reputation',
            priority: 'high',
            title: 'Improve Customer Satisfaction',
            description:
              'Focus on improving service quality and addressing customer concerns to boost ratings.',
            impact: 'high',
            effort: 'high',
            timeframe: '1-3 months',
            specific_actions: [
              'Respond to all negative reviews professionally and promptly',
              'Identify common complaints and address root causes',
              'Implement quality control measures',
              'Train staff on customer service best practices',
              'Follow up with customers to ensure satisfaction',
            ],
          });
          break;

        default:
          if (issue.severity === 'critical' || issue.severity === 'high') {
            recommendations.push({
              type: 'local',
              category: 'general',
              priority: issue.severity,
              title: 'Fix Local Listing Issue',
              description: issue.message,
              impact: issue.severity === 'critical' ? 'high' : 'medium',
              effort: 'medium',
              timeframe: '1-2 weeks',
            });
          }
      }
    });

    return recommendations;
  }

  /**
   * Generate website-specific recommendations
   * @param {Object} websiteAnalysis - Website analysis data
   * @param {Object} businessProfile - Business profile data
   * @param {string} industry - Industry type
   * @returns {Array} Website recommendations
   */
  static generateWebsiteRecommendations(websiteAnalysis, businessProfile, industry) {
    const recommendations = [];

    if (!websiteAnalysis || websiteAnalysis.error) {
      return recommendations;
    }

    const performance = websiteAnalysis.performance_metrics || {};
    const content = websiteAnalysis.page_content || {};

    // Performance recommendations
    if (performance.lighthouse_performance < 70) {
      recommendations.push({
        type: 'website',
        category: 'performance',
        priority: 'medium',
        title: 'Improve Website Performance',
        description: 'Optimize your website speed for better user experience and SEO.',
        impact: 'medium',
        effort: 'medium',
        timeframe: '1-2 weeks',
        specific_actions: [
          'Compress and optimize images',
          'Enable browser caching',
          'Minify CSS and JavaScript files',
          'Use a content delivery network (CDN)',
          'Optimize server response times',
        ],
      });
    }

    // Content recommendations
    if (content.wordCount < 300) {
      recommendations.push({
        type: 'website',
        category: 'content',
        priority: 'medium',
        title: 'Add More Content',
        description:
          'Expand your website content to provide more value to visitors and improve SEO.',
        impact: 'medium',
        effort: 'medium',
        timeframe: '1-2 weeks',
        specific_actions: [
          'Write detailed service descriptions',
          'Add frequently asked questions',
          'Create blog posts about your industry',
          'Include customer success stories',
          'Add location-specific content',
        ],
      });
    }

    return recommendations;
  }

  /**
   * Generate SERP-specific recommendations
   * @param {Object} serpAnalysis - SERP analysis data
   * @param {Object} businessProfile - Business profile data
   * @returns {Array} SERP recommendations
   */
  static generateSerpRecommendations(serpAnalysis, businessProfile) {
    const recommendations = [];

    if (!serpAnalysis || serpAnalysis.error) {
      return recommendations;
    }

    const summary = serpAnalysis.rankings_summary || {};

    if (summary.map_pack_appearances === 0) {
      recommendations.push({
        type: 'serp',
        category: 'local_seo',
        priority: 'high',
        title: 'Improve Local Search Rankings',
        description:
          'Your business is not appearing in local search results. Focus on local SEO optimization.',
        impact: 'high',
        effort: 'high',
        timeframe: '1-2 months',
        specific_actions: [
          'Optimize Google My Business profile completely',
          'Build local citations and directory listings',
          'Get reviews from local customers',
          'Create location-specific content on your website',
          'Build local backlinks from community websites',
        ],
      });
    }

    return recommendations;
  }

  /**
   * Generate review-specific recommendations
   * @param {Object} reviewAnalysis - Review analysis data
   * @param {Object} businessProfile - Business profile data
   * @returns {Array} Review recommendations
   */
  static generateReviewRecommendations(reviewAnalysis, businessProfile) {
    const recommendations = [];

    if (!reviewAnalysis || reviewAnalysis.error) {
      return recommendations;
    }

    const sentiment = reviewAnalysis.sentiment_summary || {};
    const insights = reviewAnalysis.insights || [];

    // Add recommendations based on AI-generated insights
    insights.forEach((insight) => {
      if (insight.type === 'concern') {
        recommendations.push({
          type: 'reviews',
          category: 'reputation',
          priority: insight.impact === 'high' ? 'high' : 'medium',
          title: `Address Customer Concern: ${insight.title}`,
          description: insight.description,
          impact: insight.impact,
          effort: 'medium',
          timeframe: '2-4 weeks',
          specific_actions: [
            'Respond to relevant reviews mentioning this issue',
            'Implement process improvements to address the concern',
            'Train staff on handling this specific issue',
            'Follow up with customers to ensure resolution',
          ],
        });
      }
    });

    return recommendations;
  }

  /**
   * Remove duplicate recommendations
   * @param {Array} recommendations - Array of recommendations
   * @returns {Array} Unique recommendations
   */
  static removeDuplicateRecommendations(recommendations) {
    const seen = new Set();
    return recommendations.filter((rec) => {
      const key = `${rec.type}-${rec.category}-${rec.title}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Prioritize recommendations based on scoring results
   * @param {Array} recommendations - Array of recommendations
   * @param {Object} scoringResult - Scoring results
   * @returns {Array} Prioritized recommendations
   */
  static prioritizeRecommendations(recommendations, scoringResult) {
    const priorityOrder = {
      critical: 1,
      high: 2,
      medium: 3,
      low: 4,
    };

    const impactOrder = {
      high: 1,
      medium: 2,
      low: 3,
    };

    return recommendations
      .sort((a, b) => {
        // Sort by priority first, then by impact
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;

        return impactOrder[a.impact] - impactOrder[b.impact];
      })
      .slice(0, 15); // Limit to top 15 recommendations
  }

  /**
   * Extract city from address
   * @param {string} address - Full address
   * @returns {string} City name
   */
  static extractCityFromAddress(address) {
    if (!address) return '';

    const parts = address.split(',');
    if (parts.length >= 2) {
      return parts[parts.length - 2].trim();
    }

    return address.split(' ')[0] || '';
  }
}
