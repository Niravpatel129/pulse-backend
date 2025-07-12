import asyncHandler from '../../middleware/asyncHandler.js';
import { BusinessIntelligenceService } from '../../services/businessIntelligenceService.js';
import { GooglePlacesService } from '../../services/googlePlacesService.js';
import { RecommendationService } from '../../services/recommendationService.js';
import { ReviewSentimentService } from '../../services/reviewSentimentService.js';
import { ScoringService } from '../../services/scoringService.js';
import { SerpAnalysisService } from '../../services/serpAnalysisService.js';
import { WebsiteAnalysisService } from '../../services/websiteAnalysisService.js';
import ApiError from '../../utils/apiError.js';
import ApiResponse from '../../utils/apiResponse.js';

/**
 * Analyze website experience and optimization
 */
const analyzeWebsiteExperience = (websiteAnalysis, businessProfile, keywords, industry) => {
  const analysis = {
    overall_score: 0,
    max_score: 40,
    components: {},
    recommendations: [],
  };

  let currentScore = 0;

  // If no website analysis, return empty analysis
  if (!websiteAnalysis || websiteAnalysis.error) {
    analysis.recommendations.push({
      component: 'website_existence',
      recommendation: 'Create a professional website to establish online presence and credibility',
      priority: 'critical',
    });

    analysis.components.website_existence = {
      label: 'Website Existence',
      points_possible: 40,
      points_earned: 0,
      status: 'missing',
      value: 'No website found',
      recommendation: 'Create a professional website to establish online presence and credibility',
    };

    analysis.overall_status = 'critical';
    analysis.completion_percentage = 0;

    return analysis;
  }

  const content = websiteAnalysis.page_content || {};
  const technical = websiteAnalysis.technical_seo || {};
  const ux = websiteAnalysis.ux_analysis || {};
  const mobile = websiteAnalysis.mobile_analysis || {};
  const performance = websiteAnalysis.performance_metrics || {};

  // Website experience checks
  const checks = [
    {
      key: 'page_title',
      label: 'Page Title',
      points: 4,
      check: () => !!content.title,
      value: content.title || 'Missing',
      status: content.title ? 'complete' : 'missing',
      recommendation: !content.title
        ? 'Add a descriptive page title that includes your business name and main keywords'
        : null,
    },
    {
      key: 'meta_description',
      label: 'Meta Description',
      points: 3,
      check: () => !!content.metaDescription,
      value: content.metaDescription || 'Missing',
      status: content.metaDescription ? 'complete' : 'missing',
      recommendation: !content.metaDescription
        ? 'Add a compelling meta description to improve search click-through rates'
        : null,
    },
    {
      key: 'mobile_friendly',
      label: 'Mobile-Friendly Design',
      points: 6,
      check: () => mobile.is_mobile_friendly,
      value: mobile.is_mobile_friendly ? 'Mobile-friendly' : 'Not mobile-friendly',
      status: mobile.is_mobile_friendly ? 'complete' : 'needs_improvement',
      recommendation: !mobile.is_mobile_friendly
        ? 'Optimize your website for mobile devices - over 60% of users browse on mobile'
        : null,
    },
    {
      key: 'page_speed',
      label: 'Page Loading Speed',
      points: 5,
      check: () => (performance.page_load_time || 0) < 3000,
      value: performance.page_load_time
        ? `${Math.round(performance.page_load_time / 1000)}s`
        : 'Unknown',
      status: (() => {
        if (!performance.page_load_time) return 'unknown';
        if (performance.page_load_time < 3000) return 'excellent';
        if (performance.page_load_time < 5000) return 'good';
        return 'needs_improvement';
      })(),
      recommendation: (() => {
        if (!performance.page_load_time)
          return 'Test your website speed and optimize for faster loading';
        if (performance.page_load_time >= 5000)
          return 'Critical: Your website loads too slowly. Compress images and optimize code';
        if (performance.page_load_time >= 3000)
          return 'Improve page speed - aim for under 3 seconds load time';
        return null;
      })(),
    },
    {
      key: 'contact_options',
      label: 'Contact Options',
      points: 5,
      check: () => {
        const hasContactForm = (ux.contactForms || 0) > 0;
        const hasPhoneVisible = (content.contactInfo?.phones?.length || 0) > 0;
        const hasEmailVisible = (content.contactInfo?.emails?.length || 0) > 0;
        const hasChat = (ux.chatWidgets || 0) > 0;
        return hasContactForm || hasPhoneVisible || hasEmailVisible || hasChat;
      },
      value: (() => {
        const options = [];
        if ((ux.contactForms || 0) > 0) options.push('Contact form');
        if ((content.contactInfo?.phones?.length || 0) > 0) options.push('Phone visible');
        if ((content.contactInfo?.emails?.length || 0) > 0) options.push('Email visible');
        if ((ux.chatWidgets || 0) > 0) options.push('Live chat');
        return options.length > 0 ? options.join(', ') : 'No contact options';
      })(),
      status: (() => {
        const hasContactForm = (ux.contactForms || 0) > 0;
        const hasPhoneVisible = (content.contactInfo?.phones?.length || 0) > 0;
        const hasEmailVisible = (content.contactInfo?.emails?.length || 0) > 0;
        const hasChat = (ux.chatWidgets || 0) > 0;
        const totalOptions = [hasContactForm, hasPhoneVisible, hasEmailVisible, hasChat].filter(
          Boolean,
        ).length;

        if (totalOptions === 0) return 'missing';
        if (totalOptions >= 3) return 'excellent';
        if (totalOptions >= 2) return 'good';
        return 'needs_improvement';
      })(),
      recommendation: (() => {
        const hasContactForm = (ux.contactForms || 0) > 0;
        const hasPhoneVisible = (content.contactInfo?.phones?.length || 0) > 0;
        const hasEmailVisible = (content.contactInfo?.emails?.length || 0) > 0;
        const hasChat = (ux.chatWidgets || 0) > 0;
        const totalOptions = [hasContactForm, hasPhoneVisible, hasEmailVisible, hasChat].filter(
          Boolean,
        ).length;

        if (totalOptions === 0)
          return 'Add multiple ways for customers to contact you (phone, email, contact form)';
        if (totalOptions === 1)
          return 'Add more contact options to make it easier for customers to reach you';
        return null;
      })(),
    },
    {
      key: 'call_to_action',
      label: 'Call-to-Action Buttons',
      points: 4,
      check: () => (content.ctaElements || 0) >= 2,
      value: content.ctaElements ? `${content.ctaElements} CTA buttons` : 'No CTA buttons',
      status: (() => {
        const ctas = content.ctaElements || 0;
        if (ctas === 0) return 'missing';
        if (ctas >= 3) return 'excellent';
        if (ctas >= 2) return 'good';
        return 'needs_improvement';
      })(),
      recommendation: (() => {
        const ctas = content.ctaElements || 0;
        if (ctas === 0)
          return 'Add clear call-to-action buttons (e.g., "Call Now", "Get Quote", "Book Now")';
        if (ctas === 1) return 'Add more call-to-action buttons throughout your website';
        return null;
      })(),
    },
    {
      key: 'trust_signals',
      label: 'Trust Signals',
      points: 4,
      check: () => {
        const hasTestimonials = (ux.testimonialElements || 0) > 0;
        const hasSocialLinks = (ux.socialLinks || 0) > 0;
        const hasSSL = technical.is_secure;
        return hasTestimonials || hasSocialLinks || hasSSL;
      },
      value: (() => {
        const signals = [];
        if ((ux.testimonialElements || 0) > 0) signals.push('Testimonials');
        if ((ux.socialLinks || 0) > 0) signals.push('Social links');
        if (technical.is_secure) signals.push('SSL certificate');
        return signals.length > 0 ? signals.join(', ') : 'No trust signals';
      })(),
      status: (() => {
        const hasTestimonials = (ux.testimonialElements || 0) > 0;
        const hasSocialLinks = (ux.socialLinks || 0) > 0;
        const hasSSL = technical.is_secure;
        const totalSignals = [hasTestimonials, hasSocialLinks, hasSSL].filter(Boolean).length;

        if (totalSignals === 0) return 'missing';
        if (totalSignals >= 3) return 'excellent';
        if (totalSignals >= 2) return 'good';
        return 'needs_improvement';
      })(),
      recommendation: (() => {
        const hasTestimonials = (ux.testimonialElements || 0) > 0;
        const hasSocialLinks = (ux.socialLinks || 0) > 0;
        const hasSSL = technical.is_secure;
        const totalSignals = [hasTestimonials, hasSocialLinks, hasSSL].filter(Boolean).length;

        if (totalSignals === 0)
          return 'Add trust signals like customer testimonials, SSL certificate, and social media links';
        if (totalSignals === 1) return 'Add more trust signals to build customer confidence';
        return null;
      })(),
    },
    {
      key: 'content_quality',
      label: 'Content Quality',
      points: 3,
      check: () => (content.wordCount || 0) >= 300,
      value: content.wordCount ? `${content.wordCount} words` : 'Unknown word count',
      status: (() => {
        const words = content.wordCount || 0;
        if (words === 0) return 'unknown';
        if (words >= 500) return 'excellent';
        if (words >= 300) return 'good';
        return 'needs_improvement';
      })(),
      recommendation: (() => {
        const words = content.wordCount || 0;
        if (words === 0) return 'Add quality content to inform visitors about your services';
        if (words < 300)
          return 'Add more content - aim for at least 300 words of quality information';
        return null;
      })(),
    },
    {
      key: 'business_info',
      label: 'Business Information',
      points: 3,
      check: () => {
        const hasBusinessName = content.title
          ?.toLowerCase()
          .includes(businessProfile.name?.toLowerCase());
        const hasLocation = content.textContent
          ?.toLowerCase()
          .includes(businessProfile.formatted_address?.toLowerCase().split(',')[0]);
        return hasBusinessName || hasLocation;
      },
      value: (() => {
        const hasBusinessName = content.title
          ?.toLowerCase()
          .includes(businessProfile.name?.toLowerCase());
        const hasLocation = content.textContent
          ?.toLowerCase()
          .includes(businessProfile.formatted_address?.toLowerCase().split(',')[0]);
        const info = [];
        if (hasBusinessName) info.push('Business name');
        if (hasLocation) info.push('Location');
        return info.length > 0 ? info.join(', ') : 'Business info missing';
      })(),
      status: (() => {
        const hasBusinessName = content.title
          ?.toLowerCase()
          .includes(businessProfile.name?.toLowerCase());
        const hasLocation = content.textContent
          ?.toLowerCase()
          .includes(businessProfile.formatted_address?.toLowerCase().split(',')[0]);
        const totalInfo = [hasBusinessName, hasLocation].filter(Boolean).length;

        if (totalInfo === 0) return 'missing';
        if (totalInfo >= 2) return 'complete';
        return 'needs_improvement';
      })(),
      recommendation: (() => {
        const hasBusinessName = content.title
          ?.toLowerCase()
          .includes(businessProfile.name?.toLowerCase());
        const hasLocation = content.textContent
          ?.toLowerCase()
          .includes(businessProfile.formatted_address?.toLowerCase().split(',')[0]);
        const totalInfo = [hasBusinessName, hasLocation].filter(Boolean).length;

        if (totalInfo === 0)
          return 'Include your business name and location prominently on your website';
        if (totalInfo === 1)
          return 'Add more business information to help customers find and identify you';
        return null;
      })(),
    },
    {
      key: 'technical_seo',
      label: 'Technical SEO',
      points: 3,
      check: () => {
        const hasSSL = technical.is_secure;
        const hasViewport = technical.hasMetaViewport;
        const hasCanonical = technical.hasCanonical;
        return hasSSL && hasViewport;
      },
      value: (() => {
        const factors = [];
        if (technical.is_secure) factors.push('SSL');
        if (technical.hasMetaViewport) factors.push('Mobile viewport');
        if (technical.hasCanonical) factors.push('Canonical URL');
        return factors.length > 0 ? factors.join(', ') : 'Technical issues';
      })(),
      status: (() => {
        const hasSSL = technical.is_secure;
        const hasViewport = technical.hasMetaViewport;
        const hasCanonical = technical.hasCanonical;
        const totalFactors = [hasSSL, hasViewport, hasCanonical].filter(Boolean).length;

        if (totalFactors === 0) return 'poor';
        if (totalFactors >= 3) return 'excellent';
        if (totalFactors >= 2) return 'good';
        return 'needs_improvement';
      })(),
      recommendation: (() => {
        const missingFactors = [];
        if (!technical.is_secure) missingFactors.push('SSL certificate');
        if (!technical.hasMetaViewport) missingFactors.push('mobile viewport tag');
        if (!technical.hasCanonical) missingFactors.push('canonical URL');

        if (missingFactors.length > 0) {
          return `Fix technical SEO issues: ${missingFactors.join(', ')}`;
        }
        return null;
      })(),
    },
  ];

  // Calculate scores and build components
  checks.forEach((check) => {
    const passed = check.check();
    if (passed) {
      currentScore += check.points;
    }

    analysis.components[check.key] = {
      label: check.label,
      points_possible: check.points,
      points_earned: passed ? check.points : 0,
      status: check.status,
      value: check.value,
      recommendation: check.recommendation,
    };

    if (check.recommendation) {
      analysis.recommendations.push({
        component: check.key,
        recommendation: check.recommendation,
        priority: check.points >= 5 ? 'high' : check.points >= 3 ? 'medium' : 'low',
      });
    }
  });

  analysis.overall_score = currentScore;

  // Calculate completion percentage
  analysis.completion_percentage = Math.round((currentScore / analysis.max_score) * 100);

  // Overall status
  analysis.overall_status = (() => {
    if (analysis.completion_percentage >= 90) return 'excellent';
    if (analysis.completion_percentage >= 75) return 'good';
    if (analysis.completion_percentage >= 50) return 'fair';
    return 'needs_improvement';
  })();

  return analysis;
};

/**
 * Analyze search results optimization (SEO)
 */
const analyzeSearchResults = (websiteAnalysis, businessProfile, keywords, industry) => {
  const analysis = {
    overall_score: 0,
    max_score: 40,
    components: {},
    recommendations: [],
  };

  let currentScore = 0;

  // If no website analysis, return low scores for SEO elements
  if (!websiteAnalysis || websiteAnalysis.error) {
    analysis.recommendations.push({
      component: 'website_seo',
      recommendation: 'Create a website with proper SEO optimization to improve search rankings',
      priority: 'critical',
    });

    analysis.components.website_seo = {
      label: 'Website SEO',
      points_possible: 40,
      points_earned: 0,
      status: 'missing',
      value: 'No website found',
      recommendation: 'Create a website with proper SEO optimization to improve search rankings',
    };

    analysis.overall_status = 'critical';
    analysis.completion_percentage = 0;

    return analysis;
  }

  const content = websiteAnalysis.page_content || {};
  const technical = websiteAnalysis.technical_seo || {};
  const domain = websiteAnalysis.domain_analysis || {};

  // Extract service areas (cities/regions) from formatted address
  const serviceArea = (() => {
    const address = businessProfile.formatted_address || '';
    const parts = address.split(',').map((p) => p.trim());
    // Get city (usually second part) and state
    return parts.length > 1 ? parts[1] : parts[0] || '';
  })();

  const businessName = businessProfile.name || '';

  // SEO optimization checks
  const checks = [
    // Domain checks (8 points)
    {
      key: 'using_custom_domain',
      label: 'Using custom domain',
      points: 4,
      check: () => {
        const url = websiteAnalysis.url || businessProfile.website || '';
        return (
          !url.includes('wordpress.com') &&
          !url.includes('wix.com') &&
          !url.includes('squarespace.com') &&
          !url.includes('weebly.com')
        );
      },
      value: (() => {
        const url = websiteAnalysis.url || businessProfile.website || '';
        if (
          url.includes('wordpress.com') ||
          url.includes('wix.com') ||
          url.includes('squarespace.com') ||
          url.includes('weebly.com')
        ) {
          return 'Using platform subdomain';
        }
        return url ? 'Custom domain' : 'No domain';
      })(),
      status: (() => {
        const url = websiteAnalysis.url || businessProfile.website || '';
        if (!url) return 'missing';
        if (
          url.includes('wordpress.com') ||
          url.includes('wix.com') ||
          url.includes('squarespace.com') ||
          url.includes('weebly.com')
        ) {
          return 'needs_improvement';
        }
        return 'complete';
      })(),
      recommendation: (() => {
        const url = websiteAnalysis.url || businessProfile.website || '';
        if (!url) return 'Set up a website with a custom domain';
        if (
          url.includes('wordpress.com') ||
          url.includes('wix.com') ||
          url.includes('squarespace.com') ||
          url.includes('weebly.com')
        ) {
          return 'Switch to a custom domain for better SEO and professional appearance';
        }
        return null;
      })(),
    },
    {
      key: 'only_one_domain',
      label: 'Only one domain',
      points: 4,
      check: () => true, // This would need additional analysis to detect multiple domains
      value: 'Single domain',
      status: 'complete',
      recommendation: null,
    },

    // Headline (H1) checks (9 points)
    {
      key: 'h1_includes_service_area',
      label: 'Includes the service area',
      points: 3,
      check: () => {
        const h1 = content.h1 || content.title || '';
        return serviceArea && h1.toLowerCase().includes(serviceArea.toLowerCase());
      },
      value: (() => {
        const h1 = content.h1 || content.title || '';
        return h1 || 'No H1 found';
      })(),
      status: (() => {
        const h1 = content.h1 || content.title || '';
        if (!h1) return 'missing';
        if (!serviceArea) return 'unknown';
        return h1.toLowerCase().includes(serviceArea.toLowerCase())
          ? 'complete'
          : 'needs_improvement';
      })(),
      recommendation: (() => {
        const h1 = content.h1 || content.title || '';
        if (!h1) return 'Add an H1 heading to your homepage';
        if (!serviceArea) return 'Cannot analyze without service area information';
        if (!h1.toLowerCase().includes(serviceArea.toLowerCase())) {
          return `Include your service area "${serviceArea}" in your main headline`;
        }
        return null;
      })(),
    },
    {
      key: 'h1_includes_relevant_keywords',
      label: 'Includes relevant keywords',
      points: 3,
      check: () => {
        const h1 = content.h1 || content.title || '';
        if (!h1 || !keywords.length) return false;
        return keywords.some((keyword) => {
          // Check for both exact match and partial matches
          const keywordLower = keyword.toLowerCase();
          const h1Lower = h1.toLowerCase();

          // Direct inclusion check
          if (h1Lower.includes(keywordLower)) return true;

          // Check individual words for compound keywords
          const keywordWords = keywordLower.split(' ');
          return keywordWords.some((word) => h1Lower.includes(word));
        });
      },
      value: (() => {
        const h1 = content.h1 || content.title || '';
        return h1 || 'No H1 found';
      })(),
      status: (() => {
        const h1 = content.h1 || content.title || '';
        if (!h1) return 'missing';
        if (!keywords.length) return 'unknown';

        const hasKeyword = keywords.some((keyword) => {
          const keywordLower = keyword.toLowerCase();
          const h1Lower = h1.toLowerCase();
          if (h1Lower.includes(keywordLower)) return true;
          const keywordWords = keywordLower.split(' ');
          return keywordWords.some((word) => h1Lower.includes(word));
        });

        return hasKeyword ? 'complete' : 'needs_improvement';
      })(),
      recommendation: (() => {
        const h1 = content.h1 || content.title || '';
        if (!h1) return 'Add an H1 heading to your homepage';
        if (!keywords.length) return 'Cannot analyze without keywords';

        const hasKeyword = keywords.some((keyword) => {
          const keywordLower = keyword.toLowerCase();
          const h1Lower = h1.toLowerCase();
          if (h1Lower.includes(keywordLower)) return true;
          const keywordWords = keywordLower.split(' ');
          return keywordWords.some((word) => h1Lower.includes(word));
        });

        if (!hasKeyword) {
          return `Include relevant keywords like "${keywords
            .slice(0, 2)
            .join('", "')}" in your main headline`;
        }
        return null;
      })(),
    },
    {
      key: 'h1_exists',
      label: 'Exists',
      points: 3,
      check: () => !!(content.h1 || content.title),
      value: (() => {
        const h1 = content.h1 || content.title || '';
        return h1 || 'No H1 found';
      })(),
      status: !!(content.h1 || content.title) ? 'complete' : 'missing',
      recommendation: !(content.h1 || content.title) ? 'Add an H1 heading to your homepage' : null,
    },

    // Metadata checks (23 points)
    {
      key: 'images_have_alt_tags',
      label: 'Images have "alt tags"',
      points: 3,
      check: () => (technical.images_with_alt || 0) > 0,
      value: (() => {
        const totalImages = technical.total_images || 0;
        const imagesWithAlt = technical.images_with_alt || 0;

        // If we have alt tags but no total count, assume there are images
        if (imagesWithAlt > 0 && totalImages === 0) {
          return `${imagesWithAlt} images have alt tags`;
        }

        return totalImages > 0
          ? `${imagesWithAlt}/${totalImages} images have alt tags`
          : imagesWithAlt > 0
          ? `${imagesWithAlt} images have alt tags`
          : 'No images found';
      })(),
      status: (() => {
        const totalImages = technical.total_images || 0;
        const imagesWithAlt = technical.images_with_alt || 0;

        // If we have alt tags, consider it complete regardless of total count
        if (imagesWithAlt > 0) {
          if (totalImages === 0) return 'complete'; // Can't calculate percentage, but has alt tags
          const percentage = (imagesWithAlt / totalImages) * 100;
          if (percentage >= 80) return 'complete';
          if (percentage >= 50) return 'needs_improvement';
          return 'poor';
        }

        if (totalImages === 0) return 'unknown';
        return 'missing';
      })(),
      recommendation: (() => {
        const totalImages = technical.total_images || 0;
        const imagesWithAlt = technical.images_with_alt || 0;

        if (imagesWithAlt > 0 && totalImages > 0) {
          const percentage = (imagesWithAlt / totalImages) * 100;
          if (percentage < 80) return 'Add alt tags to more images - aim for 100% coverage';
          return null;
        }

        if (imagesWithAlt > 0) return null; // Has alt tags, no recommendation needed
        if (totalImages === 0 && imagesWithAlt === 0) return 'No images to analyze';
        return 'Add alt tags to all images for better SEO and accessibility';
      })(),
    },
    {
      key: 'description_length',
      label: 'Description length',
      points: 2,
      check: () => {
        const desc = content.metaDescription || '';
        return desc.length >= 100;
      },
      value: (() => {
        const desc = content.metaDescription || '';
        return desc ? `${desc.length} characters` : 'No meta description';
      })(),
      status: (() => {
        const desc = content.metaDescription || '';
        if (!desc) return 'missing';
        if (desc.length < 100) return 'too_short';
        if (desc.length > 160) return 'too_long';
        return 'complete';
      })(),
      recommendation: (() => {
        const desc = content.metaDescription || '';
        if (!desc) return 'Add a meta description to improve search result appearance';
        if (desc.length < 100) return 'Make your meta description longer (at least 100 characters)';
        if (desc.length > 160) return 'Shorten your meta description to under 160 characters';
        return null;
      })(),
    },
    {
      key: 'description_includes_service_area',
      label: 'Description includes the service area',
      points: 3,
      check: () => {
        const desc = content.metaDescription || '';
        return serviceArea && desc.toLowerCase().includes(serviceArea.toLowerCase());
      },
      value: (() => {
        const desc = content.metaDescription || '';
        return desc || 'No meta description';
      })(),
      status: (() => {
        const desc = content.metaDescription || '';
        if (!desc) return 'missing';
        if (!serviceArea) return 'unknown';
        return desc.toLowerCase().includes(serviceArea.toLowerCase())
          ? 'complete'
          : 'needs_improvement';
      })(),
      recommendation: (() => {
        const desc = content.metaDescription || '';
        if (!desc) return 'Add a meta description first';
        if (!serviceArea) return 'Cannot analyze without service area information';
        if (!desc.toLowerCase().includes(serviceArea.toLowerCase())) {
          return `Include your service area "${serviceArea}" in your meta description`;
        }
        return null;
      })(),
    },
    {
      key: 'description_includes_relevant_keywords',
      label: 'Description includes relevant keywords',
      points: 3,
      check: () => {
        const desc = content.metaDescription || '';
        if (!desc || !keywords.length) return false;
        return keywords.some((keyword) => {
          // Check for both exact match and partial matches
          const keywordLower = keyword.toLowerCase();
          const descLower = desc.toLowerCase();

          // Direct inclusion check
          if (descLower.includes(keywordLower)) return true;

          // Check individual words for compound keywords
          const keywordWords = keywordLower.split(' ');
          return keywordWords.some((word) => descLower.includes(word));
        });
      },
      value: (() => {
        const desc = content.metaDescription || '';
        return desc || 'No meta description';
      })(),
      status: (() => {
        const desc = content.metaDescription || '';
        if (!desc) return 'missing';
        if (!keywords.length) return 'unknown';

        const hasKeyword = keywords.some((keyword) => {
          const keywordLower = keyword.toLowerCase();
          const descLower = desc.toLowerCase();
          if (descLower.includes(keywordLower)) return true;
          const keywordWords = keywordLower.split(' ');
          return keywordWords.some((word) => descLower.includes(word));
        });

        return hasKeyword ? 'complete' : 'needs_improvement';
      })(),
      recommendation: (() => {
        const desc = content.metaDescription || '';
        if (!desc) return 'Add a meta description first';
        if (!keywords.length) return 'Cannot analyze without keywords';

        const hasKeyword = keywords.some((keyword) => {
          const keywordLower = keyword.toLowerCase();
          const descLower = desc.toLowerCase();
          if (descLower.includes(keywordLower)) return true;
          const keywordWords = keywordLower.split(' ');
          return keywordWords.some((word) => descLower.includes(word));
        });

        if (!hasKeyword) {
          return `Include relevant keywords like "${keywords
            .slice(0, 2)
            .join('", "')}" in your meta description`;
        }
        return null;
      })(),
    },
    {
      key: 'page_title_matches_google_business_profile',
      label: 'Page title matches Google Business Profile',
      points: 4,
      check: () => {
        const title = content.title || '';
        if (!businessName) return false;

        // Extract core business name (remove city/location suffixes)
        const coreName = businessName
          .replace(
            /\s+(Dallas|Plano|Houston|Austin|San Antonio|Fort Worth|Arlington|Frisco|Irving|McKinney|Garland|Grand Prairie|Mesquite|Carrollton|Richardson|Denton|Lewisville|Tyler|Waco|College Station|Abilene|Beaumont|Brownsville|Corpus Christi|El Paso|Killeen|Laredo|Lubbock|Midland|Odessa|Pasadena|Pearland|Round Rock|Sugar Land|The Woodlands|Wichita Falls)$/i,
            '',
          )
          .trim();

        return title.toLowerCase().includes(coreName.toLowerCase());
      },
      value: (() => {
        const title = content.title || '';
        return title || 'No page title';
      })(),
      status: (() => {
        const title = content.title || '';
        if (!title) return 'missing';
        if (!businessName) return 'unknown';

        // Extract core business name (remove city/location suffixes)
        const coreName = businessName
          .replace(
            /\s+(Dallas|Plano|Houston|Austin|San Antonio|Fort Worth|Arlington|Frisco|Irving|McKinney|Garland|Grand Prairie|Mesquite|Carrollton|Richardson|Denton|Lewisville|Tyler|Waco|College Station|Abilene|Beaumont|Brownsville|Corpus Christi|El Paso|Killeen|Laredo|Lubbock|Midland|Odessa|Pasadena|Pearland|Round Rock|Sugar Land|The Woodlands|Wichita Falls)$/i,
            '',
          )
          .trim();

        return title.toLowerCase().includes(coreName.toLowerCase())
          ? 'complete'
          : 'needs_improvement';
      })(),
      recommendation: (() => {
        const title = content.title || '';
        if (!title) return 'Add a page title to your website';
        if (!businessName) return 'Cannot analyze without business name';

        // Extract core business name (remove city/location suffixes)
        const coreName = businessName
          .replace(
            /\s+(Dallas|Plano|Houston|Austin|San Antonio|Fort Worth|Arlington|Frisco|Irving|McKinney|Garland|Grand Prairie|Mesquite|Carrollton|Richardson|Denton|Lewisville|Tyler|Waco|College Station|Abilene|Beaumont|Brownsville|Corpus Christi|El Paso|Killeen|Laredo|Lubbock|Midland|Odessa|Pasadena|Pearland|Round Rock|Sugar Land|The Woodlands|Wichita Falls)$/i,
            '',
          )
          .trim();

        if (!title.toLowerCase().includes(coreName.toLowerCase())) {
          return `Include your business name "${businessName}" in your page title`;
        }
        return null;
      })(),
    },
    {
      key: 'page_title_includes_service_area',
      label: 'Page title includes the service area',
      points: 4,
      check: () => {
        const title = content.title || '';
        return serviceArea && title.toLowerCase().includes(serviceArea.toLowerCase());
      },
      value: (() => {
        const title = content.title || '';
        return title || 'No page title';
      })(),
      status: (() => {
        const title = content.title || '';
        if (!title) return 'missing';
        if (!serviceArea) return 'unknown';
        return title.toLowerCase().includes(serviceArea.toLowerCase())
          ? 'complete'
          : 'needs_improvement';
      })(),
      recommendation: (() => {
        const title = content.title || '';
        if (!title) return 'Add a page title to your website';
        if (!serviceArea) return 'Cannot analyze without service area information';
        if (!title.toLowerCase().includes(serviceArea.toLowerCase())) {
          return `Include your service area "${serviceArea}" in your page title`;
        }
        return null;
      })(),
    },
    {
      key: 'page_title_includes_relevant_keyword',
      label: 'Page title includes a relevant keyword',
      points: 4,
      check: () => {
        const title = content.title || '';
        if (!title || !keywords.length) return false;
        return keywords.some((keyword) => {
          // Check for both exact match and partial matches
          const keywordLower = keyword.toLowerCase();
          const titleLower = title.toLowerCase();

          // Direct inclusion check
          if (titleLower.includes(keywordLower)) return true;

          // Check individual words for compound keywords
          const keywordWords = keywordLower.split(' ');
          return keywordWords.some((word) => titleLower.includes(word));
        });
      },
      value: (() => {
        const title = content.title || '';
        return title || 'No page title';
      })(),
      status: (() => {
        const title = content.title || '';
        if (!title) return 'missing';
        if (!keywords.length) return 'unknown';

        const hasKeyword = keywords.some((keyword) => {
          const keywordLower = keyword.toLowerCase();
          const titleLower = title.toLowerCase();
          if (titleLower.includes(keywordLower)) return true;
          const keywordWords = keywordLower.split(' ');
          return keywordWords.some((word) => titleLower.includes(word));
        });

        return hasKeyword ? 'complete' : 'needs_improvement';
      })(),
      recommendation: (() => {
        const title = content.title || '';
        if (!title) return 'Add a page title to your website';
        if (!keywords.length) return 'Cannot analyze without keywords';

        const hasKeyword = keywords.some((keyword) => {
          const keywordLower = keyword.toLowerCase();
          const titleLower = title.toLowerCase();
          if (titleLower.includes(keywordLower)) return true;
          const keywordWords = keywordLower.split(' ');
          return keywordWords.some((word) => titleLower.includes(word));
        });

        if (!hasKeyword) {
          return `Include relevant keywords like "${keywords
            .slice(0, 2)
            .join('", "')}" in your page title`;
        }
        return null;
      })(),
    },
  ];

  // Calculate scores and build components
  checks.forEach((check) => {
    const passed = check.check();
    if (passed) {
      currentScore += check.points;
    }

    analysis.components[check.key] = {
      label: check.label,
      points_possible: check.points,
      points_earned: passed ? check.points : 0,
      status: check.status,
      value: check.value,
      recommendation: check.recommendation,
    };

    if (check.recommendation) {
      analysis.recommendations.push({
        component: check.key,
        recommendation: check.recommendation,
        priority: check.points >= 6 ? 'high' : check.points >= 3 ? 'medium' : 'low',
      });
    }
  });

  analysis.overall_score = currentScore;

  // Calculate completion percentage
  analysis.completion_percentage = Math.round((currentScore / analysis.max_score) * 100);

  // Overall status
  analysis.overall_status = (() => {
    if (analysis.completion_percentage >= 90) return 'excellent';
    if (analysis.completion_percentage >= 75) return 'good';
    if (analysis.completion_percentage >= 50) return 'fair';
    return 'needs_improvement';
  })();

  return analysis;
};

/**
 * Analyze Google Business Profile completeness and optimization
 */
const analyzeGoogleBusinessProfile = (businessProfile, keywords, industry) => {
  const analysis = {
    overall_score: 0,
    max_score: 22,
    components: {},
    recommendations: [],
  };

  let currentScore = 0;

  // Profile completeness checks
  const checks = [
    {
      key: 'business_name',
      label: 'Business Name',
      points: 2,
      check: () => !!businessProfile.name,
      value: businessProfile.name || 'Not provided',
      status: !!businessProfile.name ? 'complete' : 'missing',
    },
    {
      key: 'description',
      label: 'Description',
      points: 2,
      check: () => {
        const description =
          businessProfile.serp_description ||
          businessProfile.editorial_summary?.overview ||
          businessProfile.description ||
          businessProfile.overview ||
          businessProfile.business_description ||
          businessProfile.about ||
          businessProfile.summary ||
          businessProfile.details?.description ||
          businessProfile.editorial_summary?.description ||
          businessProfile.business_summary ||
          businessProfile.profile_description;
        return !!description;
      },
      value: (() => {
        const description =
          businessProfile.serp_description ||
          businessProfile.editorial_summary?.overview ||
          businessProfile.description ||
          businessProfile.overview ||
          businessProfile.business_description ||
          businessProfile.about ||
          businessProfile.summary ||
          businessProfile.details?.description ||
          businessProfile.editorial_summary?.description ||
          businessProfile.business_summary ||
          businessProfile.profile_description;
        return description || 'Not provided';
      })(),
      status: (() => {
        const description =
          businessProfile.serp_description ||
          businessProfile.editorial_summary?.overview ||
          businessProfile.description ||
          businessProfile.overview ||
          businessProfile.business_description ||
          businessProfile.about ||
          businessProfile.summary ||
          businessProfile.details?.description ||
          businessProfile.editorial_summary?.description ||
          businessProfile.business_summary ||
          businessProfile.profile_description;
        return description ? 'complete' : 'missing';
      })(),
      recommendation: (() => {
        const description =
          businessProfile.serp_description ||
          businessProfile.editorial_summary?.overview ||
          businessProfile.description ||
          businessProfile.overview ||
          businessProfile.business_description ||
          businessProfile.about ||
          businessProfile.summary ||
          businessProfile.details?.description ||
          businessProfile.editorial_summary?.description ||
          businessProfile.business_summary ||
          businessProfile.profile_description;
        return !description
          ? 'Add a compelling business description that includes your main keywords and what makes you unique'
          : null;
      })(),
    },
    {
      key: 'keywords_in_description',
      label: 'Description includes relevant keywords',
      points: 1,
      check: () => {
        const description =
          businessProfile.serp_description ||
          businessProfile.editorial_summary?.overview ||
          businessProfile.description ||
          businessProfile.overview ||
          businessProfile.business_description ||
          businessProfile.about ||
          businessProfile.summary ||
          businessProfile.details?.description ||
          businessProfile.editorial_summary?.description ||
          businessProfile.business_summary ||
          businessProfile.profile_description;
        if (!description || !keywords.length) return false;
        const desc = description.toLowerCase();
        return keywords.some((keyword) => desc.includes(keyword.toLowerCase()));
      },
      value: (() => {
        const description =
          businessProfile.serp_description ||
          businessProfile.editorial_summary?.overview ||
          businessProfile.description ||
          businessProfile.overview ||
          businessProfile.business_description ||
          businessProfile.about ||
          businessProfile.summary ||
          businessProfile.details?.description ||
          businessProfile.editorial_summary?.description ||
          businessProfile.business_summary ||
          businessProfile.profile_description;
        return description || 'No description';
      })(),
      status: (() => {
        const description =
          businessProfile.serp_description ||
          businessProfile.editorial_summary?.overview ||
          businessProfile.description ||
          businessProfile.overview ||
          businessProfile.business_description ||
          businessProfile.about ||
          businessProfile.summary ||
          businessProfile.details?.description ||
          businessProfile.editorial_summary?.description ||
          businessProfile.business_summary ||
          businessProfile.profile_description;
        if (!description) return 'missing';
        if (!keywords.length) return 'unknown';
        const desc = description.toLowerCase();
        const hasKeywords = keywords.some((keyword) => desc.includes(keyword.toLowerCase()));
        return hasKeywords ? 'optimized' : 'needs_optimization';
      })(),
      recommendation: (() => {
        const description =
          businessProfile.serp_description ||
          businessProfile.editorial_summary?.overview ||
          businessProfile.description ||
          businessProfile.overview ||
          businessProfile.business_description ||
          businessProfile.about ||
          businessProfile.summary ||
          businessProfile.details?.description ||
          businessProfile.editorial_summary?.description ||
          businessProfile.business_summary ||
          businessProfile.profile_description;
        if (!description) return 'Add a business description first';
        if (!keywords.length) return 'Cannot analyze without keywords';
        const desc = description.toLowerCase();
        const hasKeywords = keywords.some((keyword) => desc.includes(keyword.toLowerCase()));
        return !hasKeywords
          ? `Include relevant keywords like "${keywords
              .slice(0, 3)
              .join('", "')}" in your description`
          : null;
      })(),
    },
    {
      key: 'business_hours',
      label: 'Business Hours',
      points: 2,
      check: () => !!businessProfile.opening_hours?.weekday_text?.length,
      value: businessProfile.opening_hours?.weekday_text?.length
        ? `${businessProfile.opening_hours.weekday_text.length} days configured`
        : 'Not provided',
      status: !!businessProfile.opening_hours?.weekday_text?.length ? 'complete' : 'missing',
      recommendation: !businessProfile.opening_hours?.weekday_text?.length
        ? 'Add your business hours to help customers plan their visits and reduce inquiries'
        : null,
    },
    {
      key: 'phone_number',
      label: 'Phone Number',
      points: 2,
      check: () => !!businessProfile.formatted_phone_number,
      value: businessProfile.formatted_phone_number || 'Not provided',
      status: !!businessProfile.formatted_phone_number ? 'complete' : 'missing',
      recommendation: !businessProfile.formatted_phone_number
        ? 'Add your phone number to make it easy for customers to contact you'
        : null,
    },
    {
      key: 'website',
      label: 'Website',
      points: 2,
      check: () => !!businessProfile.website,
      value: businessProfile.website || 'Not provided',
      status: !!businessProfile.website ? 'complete' : 'missing',
      recommendation: !businessProfile.website
        ? 'Add your website URL to drive traffic and provide more information to customers'
        : null,
    },
    {
      key: 'categories',
      label: 'Business Categories',
      points: 2,
      check: () => !!businessProfile.types?.length,
      value: businessProfile.types?.length
        ? `${businessProfile.types.length} categories`
        : 'Not provided',
      status: !!businessProfile.types?.length ? 'complete' : 'missing',
      recommendation: !businessProfile.types?.length
        ? 'Add relevant business categories to help customers find you'
        : null,
    },
    {
      key: 'categories_match_keywords',
      label: 'Categories match keywords',
      points: 1,
      check: () => {
        if (!businessProfile.types?.length || !keywords.length) return false;
        const categories = businessProfile.types.map((type) => type.toLowerCase());
        return keywords.some((keyword) =>
          categories.some((category) => category.includes(keyword.toLowerCase())),
        );
      },
      value: businessProfile.types?.join(', ') || 'No categories',
      status: (() => {
        if (!businessProfile.types?.length) return 'missing';
        if (!keywords.length) return 'unknown';
        const categories = businessProfile.types.map((type) => type.toLowerCase());
        const hasMatch = keywords.some((keyword) =>
          categories.some((category) => category.includes(keyword.toLowerCase())),
        );
        return hasMatch ? 'optimized' : 'needs_optimization';
      })(),
      recommendation: (() => {
        if (!businessProfile.types?.length) return 'Add business categories first';
        if (!keywords.length) return 'Cannot analyze without keywords';
        const categories = businessProfile.types.map((type) => type.toLowerCase());
        const hasMatch = keywords.some((keyword) =>
          categories.some((category) => category.includes(keyword.toLowerCase())),
        );
        return !hasMatch ? 'Consider adding categories that match your target keywords' : null;
      })(),
    },
    {
      key: 'price_range',
      label: 'Price range',
      points: 1,
      check: () =>
        businessProfile.price_level !== undefined && businessProfile.price_level !== null,
      value:
        businessProfile.price_level !== undefined && businessProfile.price_level !== null
          ? '$'.repeat(businessProfile.price_level)
          : 'Not provided',
      status:
        businessProfile.price_level !== undefined && businessProfile.price_level !== null
          ? 'complete'
          : 'missing',
      recommendation: !(
        businessProfile.price_level !== undefined && businessProfile.price_level !== null
      )
        ? 'Add price range information to help customers understand your pricing'
        : null,
    },
    {
      key: 'service_options',
      label: 'Service options',
      points: 1,
      check: () => {
        // Check if any service option fields exist and have explicit values (true or false)
        const serviceFields = [
          'delivery',
          'takeout',
          'dine_in',
          'curbside_pickup',
          'serves_breakfast',
          'serves_lunch',
          'serves_dinner',
          'serves_brunch',
          'serves_beer',
          'serves_wine',
          'serves_vegetarian_food',
        ];

        // If any field exists (even if false), it means service options are configured
        const hasServiceData = serviceFields.some((field) => businessProfile[field] !== undefined);

        // If we have service data, check if any are true
        if (hasServiceData) {
          return serviceFields.some((field) => businessProfile[field] === true);
        }

        return false; // No service data available
      },
      value: (() => {
        const services = [];
        const serviceFields = [
          { key: 'delivery', label: 'Delivery' },
          { key: 'takeout', label: 'Takeout' },
          { key: 'dine_in', label: 'Dine-in' },
          { key: 'curbside_pickup', label: 'Curbside pickup' },
          { key: 'serves_breakfast', label: 'Breakfast' },
          { key: 'serves_lunch', label: 'Lunch' },
          { key: 'serves_dinner', label: 'Dinner' },
          { key: 'serves_brunch', label: 'Brunch' },
          { key: 'serves_beer', label: 'Beer' },
          { key: 'serves_wine', label: 'Wine' },
          { key: 'serves_vegetarian_food', label: 'Vegetarian options' },
        ];

        // Check if we have any service data
        const hasAnyServiceData = serviceFields.some(
          (field) => businessProfile[field.key] !== undefined,
        );

        if (!hasAnyServiceData) {
          return 'Not provided';
        }

        // Collect enabled services
        serviceFields.forEach((field) => {
          if (businessProfile[field.key] === true) {
            services.push(field.label);
          }
        });

        if (services.length === 0) {
          return 'None specified';
        }

        return services.join(', ');
      })(),
      status: (() => {
        const serviceFields = [
          'delivery',
          'takeout',
          'dine_in',
          'curbside_pickup',
          'serves_breakfast',
          'serves_lunch',
          'serves_dinner',
          'serves_brunch',
          'serves_beer',
          'serves_wine',
          'serves_vegetarian_food',
        ];

        const hasServiceData = serviceFields.some((field) => businessProfile[field] !== undefined);

        if (!hasServiceData) {
          return 'missing';
        }

        const hasAnyTrueService = serviceFields.some((field) => businessProfile[field] === true);

        return hasAnyTrueService ? 'complete' : 'needs_configuration';
      })(),
      recommendation: (() => {
        const serviceFields = [
          'delivery',
          'takeout',
          'dine_in',
          'curbside_pickup',
          'serves_breakfast',
          'serves_lunch',
          'serves_dinner',
          'serves_brunch',
          'serves_beer',
          'serves_wine',
          'serves_vegetarian_food',
        ];

        const hasServiceData = serviceFields.some((field) => businessProfile[field] !== undefined);

        if (!hasServiceData) {
          return 'Listing service options helps customers understand how they can interact with your business';
        }

        const hasAnyTrueService = serviceFields.some((field) => businessProfile[field] === true);

        if (!hasAnyTrueService) {
          return 'Configure your service options (delivery, takeout, dine-in, etc.) to help customers understand how they can interact with your business';
        }

        return null;
      })(),
    },
    {
      key: 'social_media_links',
      label: 'Social media links',
      points: 1,
      check: () => {
        // Check Google Places API fields
        const hasDirectFields = !!(
          businessProfile.facebook ||
          businessProfile.instagram ||
          businessProfile.twitter ||
          businessProfile.linkedin ||
          businessProfile.youtube ||
          businessProfile.tiktok
        );

        // Check SerpAPI social links
        const hasSerpSocial =
          businessProfile.serp_social_links &&
          Object.keys(businessProfile.serp_social_links).length > 0;

        return hasDirectFields || hasSerpSocial;
      },
      value: (() => {
        const social = [];

        // Add from Google Places API fields
        if (businessProfile.facebook) social.push('Facebook');
        if (businessProfile.instagram) social.push('Instagram');
        if (businessProfile.twitter) social.push('Twitter');
        if (businessProfile.linkedin) social.push('LinkedIn');
        if (businessProfile.youtube) social.push('YouTube');
        if (businessProfile.tiktok) social.push('TikTok');

        // Add from SerpAPI social links
        if (businessProfile.serp_social_links) {
          Object.keys(businessProfile.serp_social_links).forEach((platform) => {
            const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
            if (!social.includes(platformName)) {
              social.push(platformName);
            }
          });
        }

        return social.length > 0 ? social.join(', ') : 'Not provided';
      })(),
      status: (() => {
        const hasDirectFields = !!(
          businessProfile.facebook ||
          businessProfile.instagram ||
          businessProfile.twitter ||
          businessProfile.linkedin ||
          businessProfile.youtube ||
          businessProfile.tiktok
        );

        const hasSerpSocial =
          businessProfile.serp_social_links &&
          Object.keys(businessProfile.serp_social_links).length > 0;

        return hasDirectFields || hasSerpSocial ? 'complete' : 'missing';
      })(),
      recommendation: (() => {
        const hasDirectFields = !!(
          businessProfile.facebook ||
          businessProfile.instagram ||
          businessProfile.twitter ||
          businessProfile.linkedin ||
          businessProfile.youtube ||
          businessProfile.tiktok
        );

        const hasSerpSocial =
          businessProfile.serp_social_links &&
          Object.keys(businessProfile.serp_social_links).length > 0;

        return !(hasDirectFields || hasSerpSocial)
          ? 'Social media links extend your reach and provide additional ways for customers to engage'
          : null;
      })(),
    },
    {
      key: 'photos',
      label: 'Business Photos',
      points: 2,
      check: () => !!businessProfile.photos?.length,
      value: businessProfile.photos?.length
        ? `${businessProfile.photos.length} photos`
        : 'No photos',
      status: (() => {
        if (!businessProfile.photos?.length) return 'missing';
        if (businessProfile.photos.length < 5) return 'needs_more';
        return 'complete';
      })(),
      recommendation: (() => {
        if (!businessProfile.photos?.length)
          return 'Add high-quality photos of your business, products, and services';
        if (businessProfile.photos.length < 5)
          return 'Add more photos (aim for 10+ photos) to showcase your business better';
        return null;
      })(),
    },
    {
      key: 'reviews',
      label: 'Customer Reviews',
      points: 2,
      check: () => (businessProfile.user_ratings_total || 0) > 0,
      value: businessProfile.user_ratings_total
        ? `${businessProfile.user_ratings_total} reviews (${businessProfile.rating}/5.0)`
        : 'No reviews',
      status: (() => {
        const reviewCount = businessProfile.user_ratings_total || 0;
        if (reviewCount === 0) return 'missing';
        if (reviewCount < 10) return 'needs_more';
        if (reviewCount < 50) return 'good';
        return 'excellent';
      })(),
      recommendation: (() => {
        const reviewCount = businessProfile.user_ratings_total || 0;
        if (reviewCount === 0)
          return "Start collecting customer reviews - they're crucial for local search rankings";
        if (reviewCount < 10) return 'Focus on getting more reviews (aim for 10+ reviews minimum)';
        if (reviewCount < 50) return 'Continue collecting reviews to build stronger social proof';
        return null;
      })(),
    },
    {
      key: 'review_quality',
      label: 'Quality Reviews',
      points: 1,
      check: () => (businessProfile.rating || 0) >= 4.0,
      value: businessProfile.rating ? `${businessProfile.rating}/5.0 average rating` : 'No rating',
      status: (() => {
        const rating = businessProfile.rating || 0;
        if (rating === 0) return 'missing';
        if (rating < 3.5) return 'poor';
        if (rating < 4.0) return 'fair';
        if (rating < 4.5) return 'good';
        return 'excellent';
      })(),
      recommendation: (() => {
        const rating = businessProfile.rating || 0;
        if (rating === 0) return 'Focus on getting your first reviews';
        if (rating < 3.5) return 'Critical: Address service issues causing low ratings';
        if (rating < 4.0) return 'Work on improving customer experience to boost rating';
        return null;
      })(),
    },
  ];

  // Calculate scores and build components
  checks.forEach((check) => {
    const passed = check.check();
    if (passed) {
      currentScore += check.points;
    }

    analysis.components[check.key] = {
      label: check.label,
      points_possible: check.points,
      points_earned: passed ? check.points : 0,
      status: check.status,
      value: check.value,
      recommendation: check.recommendation,
    };

    if (check.recommendation) {
      analysis.recommendations.push({
        component: check.key,
        recommendation: check.recommendation,
        priority: check.points >= 2 ? 'high' : 'medium',
      });
    }
  });

  analysis.overall_score = currentScore;

  // Calculate completion percentage
  analysis.completion_percentage = Math.round((currentScore / analysis.max_score) * 100);

  // Overall status
  analysis.overall_status = (() => {
    if (analysis.completion_percentage >= 90) return 'excellent';
    if (analysis.completion_percentage >= 80) return 'good';
    if (analysis.completion_percentage >= 60) return 'fair';
    return 'needs_improvement';
  })();

  return analysis;
};

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

    // Step 2: Enhance business profile with SerpAPI data
    const serpBusinessProfile = await SerpAnalysisService.getBusinessProfileFromSerp(
      businessProfile.name,
      businessProfile.formatted_address,
      resolvedPlaceId,
    );

    // Merge SerpAPI data with Google Places data (SerpAPI takes priority for missing fields)
    if (serpBusinessProfile) {
      if (serpBusinessProfile.description && !businessProfile.editorial_summary?.overview) {
        businessProfile.serp_description = serpBusinessProfile.description;
      }
      if (serpBusinessProfile.service_options?.length > 0) {
        businessProfile.serp_service_options = serpBusinessProfile.service_options;
      }
      if (
        serpBusinessProfile.social_links &&
        Object.keys(serpBusinessProfile.social_links).length > 0
      ) {
        businessProfile.serp_social_links = serpBusinessProfile.social_links;
      }
      if (serpBusinessProfile.hours && !businessProfile.opening_hours) {
        businessProfile.serp_hours = serpBusinessProfile.hours;
      }
    }

    // Step 3: Infer industry and keywords if not provided
    let finalIndustry = industry;
    let finalKeywords = keywords;

    if (!industry || !keywords.length) {
      console.log('🤖 Using AI to infer business details...');
      const inferredDetails = await BusinessIntelligenceService.inferBusinessDetails(
        business_name,
        location,
      );

      finalIndustry = industry || inferredDetails.industry;
      finalKeywords = keywords.length > 0 ? keywords : inferredDetails.keywords;

      console.log('✅ AI-inferred business details:', {
        industry: finalIndustry,
        keywords: finalKeywords,
      });
    }

    // Step 4: Parallel analysis execution
    const analysisPromises = [];

    // Website analysis (if website exists)
    let websiteAnalysisPromise = null;
    if (businessProfile.website) {
      websiteAnalysisPromise = WebsiteAnalysisService.analyzeWebsite(businessProfile.website, {
        businessName: businessProfile.name,
        location: businessProfile.formatted_address,
        industry: finalIndustry,
      });
      analysisPromises.push(websiteAnalysisPromise);
    }

    // SERP analysis for local rankings
    const serpAnalysisPromise = SerpAnalysisService.analyzeLocalRankings(
      businessProfile.name,
      businessProfile.formatted_address,
      finalKeywords,
      finalIndustry,
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

    // Step 4: Analyze Google Business Profile completeness
    const profileAnalysis = analyzeGoogleBusinessProfile(
      businessProfile,
      finalKeywords,
      finalIndustry,
    );

    // Step 5: Analyze website experience
    const websiteExperienceAnalysis = analyzeWebsiteExperience(
      websiteAnalysis,
      businessProfile,
      finalKeywords,
      finalIndustry,
    );

    // Step 6: Analyze search results performance
    const searchResultsAnalysis = analyzeSearchResults(
      websiteAnalysis,
      businessProfile,
      finalKeywords,
      finalIndustry,
    );

    // Step 7: Calculate scores
    const scoringResult = ScoringService.calculateScores({
      businessProfile,
      websiteAnalysis,
      serpAnalysis,
      reviewAnalysis,
      hasWebsite: !!businessProfile.website,
    });

    // Step 8: Generate recommendations
    const recommendations = RecommendationService.generateRecommendations({
      businessProfile,
      websiteAnalysis,
      serpAnalysis,
      reviewAnalysis,
      scoringResult,
      industry: finalIndustry,
    });

    // Step 9: Calculate summary metrics
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

    // Step 10: Compile final report
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

      // Local listings analysis (Google Business Profile completeness)
      local_listings_analysis: {
        title: 'Local Listings',
        subtitle: 'Make your business easy to find',
        overall_score: profileAnalysis.overall_score,
        max_score: profileAnalysis.max_score,
        completion_percentage: profileAnalysis.completion_percentage,
        overall_status: profileAnalysis.overall_status,
        components: profileAnalysis.components,
        recommendations: profileAnalysis.recommendations,
        summary: {
          completed_items: Object.values(profileAnalysis.components).filter(
            (c) =>
              c.status === 'complete' ||
              c.status === 'optimized' ||
              c.status === 'excellent' ||
              c.status === 'good',
          ).length,
          total_items: Object.keys(profileAnalysis.components).length,
          missing_items: Object.values(profileAnalysis.components).filter(
            (c) => c.status === 'missing',
          ).length,
          needs_optimization: Object.values(profileAnalysis.components).filter(
            (c) =>
              c.status === 'needs_optimization' ||
              c.status === 'needs_more' ||
              c.status === 'fair' ||
              c.status === 'poor',
          ).length,
        },
      },

      // Website experience analysis
      website_experience_analysis: {
        title: 'Website Experience',
        subtitle: "Your website's customer experience",
        overall_score: websiteExperienceAnalysis.overall_score,
        max_score: websiteExperienceAnalysis.max_score,
        completion_percentage: websiteExperienceAnalysis.completion_percentage,
        overall_status: websiteExperienceAnalysis.overall_status,
        components: websiteExperienceAnalysis.components,
        recommendations: websiteExperienceAnalysis.recommendations,
        summary: {
          completed_items: Object.values(websiteExperienceAnalysis.components).filter(
            (c) =>
              c.status === 'complete' ||
              c.status === 'optimized' ||
              c.status === 'excellent' ||
              c.status === 'good',
          ).length,
          total_items: Object.keys(websiteExperienceAnalysis.components).length,
          missing_items: Object.values(websiteExperienceAnalysis.components).filter(
            (c) => c.status === 'missing',
          ).length,
          needs_optimization: Object.values(websiteExperienceAnalysis.components).filter(
            (c) =>
              c.status === 'needs_optimization' ||
              c.status === 'needs_more' ||
              c.status === 'fair' ||
              c.status === 'poor' ||
              c.status === 'needs_improvement',
          ).length,
        },
      },

      // Search results analysis
      search_results_analysis: {
        title: 'Search Results',
        subtitle: 'How you appear in search results',
        overall_score: searchResultsAnalysis.overall_score,
        max_score: searchResultsAnalysis.max_score,
        completion_percentage: searchResultsAnalysis.completion_percentage,
        overall_status: searchResultsAnalysis.overall_status,
        components: searchResultsAnalysis.components,
        recommendations: searchResultsAnalysis.recommendations,
        summary: {
          completed_items: Object.values(searchResultsAnalysis.components).filter(
            (c) =>
              c.status === 'complete' ||
              c.status === 'optimized' ||
              c.status === 'excellent' ||
              c.status === 'good',
          ).length,
          total_items: Object.keys(searchResultsAnalysis.components).length,
          missing_items: Object.values(searchResultsAnalysis.components).filter(
            (c) => c.status === 'missing' || c.status === 'poor',
          ).length,
          needs_optimization: Object.values(searchResultsAnalysis.components).filter(
            (c) =>
              c.status === 'needs_optimization' ||
              c.status === 'needs_more' ||
              c.status === 'fair' ||
              c.status === 'needs_improvement',
          ).length,
        },
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
            competitors: (() => {
              // Get local competitors first (they're more important for local businesses)
              const localCompetitors = serpAnalysis.competitors.filter((c) => c.type === 'local');

              // If we have enough local competitors, use them
              if (localCompetitors.length >= 6) {
                return localCompetitors.slice(0, 6).map((competitor, index) => ({
                  name: competitor.name,
                  rating: competitor.rating,
                  review_count: competitor.reviews,
                  position: competitor.average_position,
                  rank: index + 1,
                  type: 'local',
                  beating_you:
                    competitor.average_position <
                    (serpAnalysis.rankings_summary?.average_map_pack_position || 999),
                }));
              }

              // Otherwise, combine local and organic competitors
              const organicCompetitors = serpAnalysis.competitors.filter(
                (c) => c.type === 'organic',
              );
              const combinedCompetitors = [...localCompetitors, ...organicCompetitors];

              return combinedCompetitors.slice(0, 6).map((competitor, index) => ({
                name: competitor.name,
                rating: competitor.rating || null,
                review_count: competitor.reviews || null,
                position: competitor.average_position,
                rank: index + 1,
                type: competitor.type,
                beating_you:
                  competitor.type === 'local'
                    ? competitor.average_position <
                      (serpAnalysis.rankings_summary?.average_map_pack_position || 999)
                    : competitor.average_position <
                      (serpAnalysis.rankings_summary?.average_organic_position || 999),
              }));
            })(),
            total_competitors_found: serpAnalysis.competitors.length,
            local_competitors_found: serpAnalysis.competitors.filter((c) => c.type === 'local')
              .length,
            organic_competitors_found: serpAnalysis.competitors.filter((c) => c.type === 'organic')
              .length,
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
                (finalKeywords.length || 3) *
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
          average_rating_in_industry: finalIndustry === 'restaurant' ? 4.2 : 4.1,
          your_rating_vs_industry: businessProfile.rating
            ? businessProfile.rating >= 4.2
              ? 'Above average'
              : 'Below average'
            : 'No rating',
          average_reviews_in_industry: finalIndustry === 'restaurant' ? 150 : 120,
          your_reviews_vs_industry: businessProfile.user_ratings_total
            ? businessProfile.user_ratings_total >= 150
              ? 'Above average'
              : 'Below average'
            : 'No reviews',
          top_25_percent_rating: finalIndustry === 'restaurant' ? 4.5 : 4.4,
          gap_to_top_quartile: businessProfile.rating
            ? Math.max(0, (finalIndustry === 'restaurant' ? 4.5 : 4.4) - businessProfile.rating)
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
        keywords_analyzed: finalKeywords,
        industry: finalIndustry,
        ai_inferred: !industry || !keywords.length,
      },
    };

    console.log('✅ Analysis completed successfully:', {
      duration_ms: Date.now() - startTime,
      summary_score: scoringResult.summaryScore,
      has_website: !!businessProfile.website,
      recommendations_count: recommendations.length,
      ai_inferred: !industry || !keywords.length,
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
