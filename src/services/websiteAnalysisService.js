import lighthouse from 'lighthouse';
import puppeteer from 'puppeteer';

/**
 * Website Analysis Service
 * Performs comprehensive SEO and UX analysis using Puppeteer and Lighthouse
 */
export class WebsiteAnalysisService {
  /**
   * Analyze website for SEO and UX metrics
   * @param {string} url - Website URL to analyze
   * @param {Object} context - Business context for analysis
   * @returns {Promise<Object>} Analysis results
   */
  static async analyzeWebsite(url, context = {}) {
    const startTime = Date.now();
    let browser = null;

    try {
      console.log('🔍 Starting website analysis for:', url);

      // Normalize URL
      const normalizedUrl = this.normalizeUrl(url);

      // Launch browser
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
        ],
      });

      const page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      );
      await page.setViewport({ width: 1366, height: 768 });

      // Set timeout and handle errors
      await page.setDefaultTimeout(30000);
      await page.setDefaultNavigationTimeout(30000);

      // Navigate to website
      const navigationStart = Date.now();
      const response = await page.goto(normalizedUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });
      const navigationEnd = Date.now();

      if (!response) {
        throw new Error('Failed to load website');
      }

      const statusCode = response.status();
      if (statusCode >= 400) {
        throw new Error(`Website returned status code: ${statusCode}`);
      }

      // Extract page content and metadata
      const pageAnalysis = await this.extractPageContent(page, context);

      // Run Lighthouse audit
      const lighthouseResults = await this.runLighthouseAudit(normalizedUrl, page);

      // Analyze technical SEO
      const technicalSeo = await this.analyzeTechnicalSeo(page, normalizedUrl);

      // Analyze UX elements
      const uxAnalysis = await this.analyzeUXElements(page, context);

      // Check mobile friendliness
      const mobileAnalysis = await this.analyzeMobileFriendliness(page);

      // Performance metrics
      const performanceMetrics = {
        page_load_time: navigationEnd - navigationStart,
        lighthouse_performance: lighthouseResults.performance,
        lighthouse_seo: lighthouseResults.seo,
        lighthouse_accessibility: lighthouseResults.accessibility,
        lighthouse_best_practices: lighthouseResults.bestPractices,
        lighthouse_pwa: lighthouseResults.pwa,
      };

      const analysisResult = {
        url: normalizedUrl,
        status_code: statusCode,
        analysis_duration_ms: Date.now() - startTime,

        // Page content analysis
        page_content: pageAnalysis,

        // Technical SEO
        technical_seo: technicalSeo,

        // UX analysis
        ux_analysis: uxAnalysis,

        // Mobile analysis
        mobile_analysis: mobileAnalysis,

        // Performance metrics
        performance_metrics: performanceMetrics,

        // Lighthouse detailed results
        lighthouse_results: lighthouseResults,
      };

      console.log('✅ Website analysis completed:', {
        url: normalizedUrl,
        duration_ms: Date.now() - startTime,
        status: statusCode,
        has_title: !!pageAnalysis.title,
        has_meta_description: !!pageAnalysis.meta_description,
        performance_score: lighthouseResults.performance,
      });

      return analysisResult;
    } catch (error) {
      console.error('❌ Website analysis failed:', {
        url,
        error: error.message,
        duration_ms: Date.now() - startTime,
      });

      // Return partial analysis with error
      return {
        url,
        error: error.message,
        analysis_duration_ms: Date.now() - startTime,
        status_code: null,
        accessible: false,
      };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Extract page content and metadata
   * @param {Object} page - Puppeteer page object
   * @param {Object} context - Business context
   * @returns {Promise<Object>} Page content analysis
   */
  static async extractPageContent(page, context) {
    try {
      const content = await page.evaluate((ctx) => {
        // Extract basic SEO elements
        const title = document.querySelector('title')?.textContent || '';
        const metaDescription =
          document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
        const h1Elements = Array.from(document.querySelectorAll('h1')).map((el) =>
          el.textContent.trim(),
        );
        const h2Elements = Array.from(document.querySelectorAll('h2')).map((el) =>
          el.textContent.trim(),
        );

        // Extract images and check alt attributes
        const images = Array.from(document.querySelectorAll('img')).map((img) => ({
          src: img.src,
          alt: img.alt || '',
          hasAlt: !!img.alt,
        }));

        // Extract links
        const links = Array.from(document.querySelectorAll('a')).map((link) => ({
          href: link.href,
          text: link.textContent.trim(),
          isInternal: link.href.includes(window.location.hostname),
        }));

        // Check for favicon
        const favicon = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
        const hasFavicon = !!favicon;

        // Extract structured data
        const structuredData = Array.from(
          document.querySelectorAll('script[type="application/ld+json"]'),
        )
          .map((script) => {
            try {
              return JSON.parse(script.textContent);
            } catch (e) {
              return null;
            }
          })
          .filter((data) => data !== null);

        // Extract page text content
        const textContent = document.body.textContent || '';

        // Look for contact information
        const phoneRegex = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const phones = textContent.match(phoneRegex) || [];
        const emails = textContent.match(emailRegex) || [];

        // Look for call-to-action elements
        const ctaSelectors = [
          'button:contains("order")',
          'button:contains("call")',
          'button:contains("contact")',
          'button:contains("book")',
          'button:contains("schedule")',
          'button:contains("buy")',
          'a:contains("order")',
          'a:contains("call")',
          'a:contains("contact")',
          'a:contains("book")',
          'a:contains("schedule")',
          'a:contains("buy")',
        ];

        const ctaElements = Array.from(document.querySelectorAll('button, a')).filter((el) => {
          const text = el.textContent.toLowerCase();
          return [
            'order',
            'call',
            'contact',
            'book',
            'schedule',
            'buy',
            'get quote',
            'learn more',
          ].some((keyword) => text.includes(keyword));
        });

        return {
          title,
          metaDescription,
          h1Elements,
          h2Elements,
          images,
          links,
          hasFavicon,
          structuredData,
          textContent: textContent.substring(0, 1000), // Limit text content
          contactInfo: {
            phones: Array.from(new Set(phones)),
            emails: Array.from(new Set(emails)),
          },
          ctaElements: ctaElements.length,
          wordCount: textContent.split(/\s+/).length,
        };
      }, context);

      // Analyze content for business context
      const contextAnalysis = this.analyzeBusinessContext(content, context);

      return {
        ...content,
        context_analysis: contextAnalysis,
        seo_score: this.calculateContentSeoScore(content, context),
      };
    } catch (error) {
      console.error('❌ Error extracting page content:', error.message);
      return {
        error: error.message,
        title: '',
        meta_description: '',
        h1Elements: [],
        images: [],
        links: [],
      };
    }
  }

  /**
   * Run Lighthouse audit
   * @param {string} url - URL to audit
   * @param {Object} page - Puppeteer page object
   * @returns {Promise<Object>} Lighthouse results
   */
  static async runLighthouseAudit(url, page) {
    try {
      console.log('🔍 Running Lighthouse audit...');

      // Get the port from the browser's WebSocket URL
      const browser = page.browser();
      const browserWSEndpoint = browser.wsEndpoint();
      const port = browserWSEndpoint.split(':')[2].split('/')[0];

      const options = {
        logLevel: 'silent',
        output: 'json',
        port: parseInt(port),
        disableDeviceEmulation: true,
        chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'],
      };

      const runnerResult = await lighthouse(url, options);

      if (!runnerResult || !runnerResult.report) {
        throw new Error('Lighthouse audit failed');
      }

      const report = JSON.parse(runnerResult.report);
      const categories = report.categories;

      return {
        performance: Math.round(categories.performance.score * 100),
        accessibility: Math.round(categories.accessibility.score * 100),
        bestPractices: Math.round(categories['best-practices'].score * 100),
        seo: Math.round(categories.seo.score * 100),
        pwa: categories.pwa ? Math.round(categories.pwa.score * 100) : 0,
        metrics: {
          first_contentful_paint: report.audits['first-contentful-paint']?.numericValue,
          largest_contentful_paint: report.audits['largest-contentful-paint']?.numericValue,
          cumulative_layout_shift: report.audits['cumulative-layout-shift']?.numericValue,
          total_blocking_time: report.audits['total-blocking-time']?.numericValue,
        },
      };
    } catch (error) {
      console.error('❌ Lighthouse audit failed:', error.message);
      return {
        performance: 0,
        accessibility: 0,
        bestPractices: 0,
        seo: 0,
        pwa: 0,
        error: error.message,
      };
    }
  }

  /**
   * Analyze technical SEO factors
   * @param {Object} page - Puppeteer page object
   * @param {string} url - Website URL
   * @returns {Promise<Object>} Technical SEO analysis
   */
  static async analyzeTechnicalSeo(page, url) {
    try {
      const technicalFactors = await page.evaluate(() => {
        // Check for meta viewport tag
        const metaViewport = document.querySelector('meta[name="viewport"]');
        const hasMetaViewport = !!metaViewport;

        // Check for canonical URL
        const canonicalLink = document.querySelector('link[rel="canonical"]');
        const hasCanonical = !!canonicalLink;

        // Check for robots meta tag
        const robotsMeta = document.querySelector('meta[name="robots"]');
        const robotsContent = robotsMeta?.getAttribute('content') || '';

        // Check for SSL (this will be handled by the URL)
        const isHttps = window.location.protocol === 'https:';

        // Check for sitemap reference
        const sitemapLink = document.querySelector('link[rel="sitemap"]');
        const hasSitemap = !!sitemapLink;

        return {
          hasMetaViewport,
          hasCanonical,
          robotsContent,
          isHttps,
          hasSitemap,
          canonicalUrl: canonicalLink?.href,
        };
      });

      // Check if URL is HTTPS
      const isSecure = url.startsWith('https://');

      return {
        ...technicalFactors,
        is_secure: isSecure,
        has_ssl: isSecure,
        technical_score: this.calculateTechnicalScore(technicalFactors, isSecure),
      };
    } catch (error) {
      console.error('❌ Technical SEO analysis failed:', error.message);
      return {
        error: error.message,
        technical_score: 0,
      };
    }
  }

  /**
   * Analyze UX elements
   * @param {Object} page - Puppeteer page object
   * @param {Object} context - Business context
   * @returns {Promise<Object>} UX analysis
   */
  static async analyzeUXElements(page, context) {
    try {
      const uxFactors = await page.evaluate(() => {
        // Check for forms
        const forms = document.querySelectorAll('form').length;
        const contactForms = Array.from(document.querySelectorAll('form')).filter((form) => {
          const formText = form.textContent.toLowerCase();
          return (
            formText.includes('contact') ||
            formText.includes('message') ||
            formText.includes('inquiry')
          );
        }).length;

        // Check for chat widgets
        const chatWidgets = document.querySelectorAll(
          '[id*="chat"], [class*="chat"], [id*="messenger"], [class*="messenger"]',
        ).length;

        // Check for social media links
        const socialLinks = Array.from(document.querySelectorAll('a')).filter((link) => {
          const href = link.href.toLowerCase();
          return ['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok'].some(
            (social) => href.includes(social),
          );
        }).length;

        // Check for testimonials or reviews
        const testimonialElements = Array.from(document.querySelectorAll('*')).filter((el) => {
          const text = el.textContent.toLowerCase();
          const className = el.className.toLowerCase();
          return (
            text.includes('testimonial') ||
            text.includes('review') ||
            className.includes('testimonial') ||
            className.includes('review')
          );
        }).length;

        // Check for FAQ sections
        const faqElements = Array.from(document.querySelectorAll('*')).filter((el) => {
          const text = el.textContent.toLowerCase();
          const className = el.className.toLowerCase();
          return (
            text.includes('faq') ||
            text.includes('frequently asked') ||
            className.includes('faq') ||
            className.includes('accordion')
          );
        }).length;

        return {
          forms,
          contactForms,
          chatWidgets,
          socialLinks,
          testimonialElements,
          faqElements,
        };
      });

      return {
        ...uxFactors,
        ux_score: this.calculateUXScore(uxFactors),
        has_contact_options: uxFactors.contactForms > 0 || uxFactors.chatWidgets > 0,
        has_social_presence: uxFactors.socialLinks > 0,
        has_testimonials: uxFactors.testimonialElements > 0,
        has_faq: uxFactors.faqElements > 0,
      };
    } catch (error) {
      console.error('❌ UX analysis failed:', error.message);
      return {
        error: error.message,
        ux_score: 0,
      };
    }
  }

  /**
   * Analyze mobile friendliness
   * @param {Object} page - Puppeteer page object
   * @returns {Promise<Object>} Mobile analysis
   */
  static async analyzeMobileFriendliness(page) {
    try {
      // Set mobile viewport
      await page.setViewport({ width: 375, height: 667 });

      const mobileAnalysis = await page.evaluate(() => {
        // Check for viewport meta tag
        const metaViewport = document.querySelector('meta[name="viewport"]');
        const hasViewport = !!metaViewport;

        // Check if content fits in viewport
        const bodyWidth = document.body.scrollWidth;
        const viewportWidth = window.innerWidth;
        const fitsInViewport = bodyWidth <= viewportWidth;

        // Check for responsive images
        const responsiveImages = Array.from(document.querySelectorAll('img')).filter((img) => {
          return (
            img.style.maxWidth === '100%' ||
            img.style.width === '100%' ||
            img.hasAttribute('srcset') ||
            img.hasAttribute('sizes')
          );
        }).length;

        const totalImages = document.querySelectorAll('img').length;

        return {
          hasViewport,
          fitsInViewport,
          responsiveImages,
          totalImages,
          viewportWidth,
          bodyWidth,
        };
      });

      return {
        ...mobileAnalysis,
        mobile_score: this.calculateMobileScore(mobileAnalysis),
        is_mobile_friendly: mobileAnalysis.hasViewport && mobileAnalysis.fitsInViewport,
      };
    } catch (error) {
      console.error('❌ Mobile analysis failed:', error.message);
      return {
        error: error.message,
        mobile_score: 0,
        is_mobile_friendly: false,
      };
    }
  }

  /**
   * Analyze business context in content
   * @param {Object} content - Page content
   * @param {Object} context - Business context
   * @returns {Object} Context analysis
   */
  static analyzeBusinessContext(content, context) {
    const { businessName, location, industry } = context;
    const text = (content.textContent || '').toLowerCase();
    const title = (content.title || '').toLowerCase();
    const metaDescription = (content.metaDescription || '').toLowerCase();

    return {
      business_name_in_title: businessName ? title.includes(businessName.toLowerCase()) : false,
      location_in_title: location ? title.includes(location.toLowerCase()) : false,
      business_name_in_meta: businessName
        ? metaDescription.includes(businessName.toLowerCase())
        : false,
      location_in_meta: location ? metaDescription.includes(location.toLowerCase()) : false,
      industry_keywords_found: industry ? text.includes(industry.toLowerCase()) : false,
      local_keywords_found: location ? text.includes(location.toLowerCase()) : false,
    };
  }

  /**
   * Calculate content SEO score
   * @param {Object} content - Page content
   * @param {Object} context - Business context
   * @returns {number} SEO score
   */
  static calculateContentSeoScore(content, context) {
    let score = 0;

    // Title tag (15 points)
    if (content.title) {
      score += 10;
      if (content.title.length >= 30 && content.title.length <= 60) score += 5;
    }

    // Meta description (15 points)
    if (content.metaDescription) {
      score += 10;
      if (content.metaDescription.length >= 120 && content.metaDescription.length <= 160)
        score += 5;
    }

    // H1 tags (10 points)
    if (content.h1Elements && content.h1Elements.length > 0) {
      score += 10;
    }

    // Images with alt text (10 points)
    if (content.images && content.images.length > 0) {
      const imagesWithAlt = content.images.filter((img) => img.hasAlt).length;
      score += Math.min(10, (imagesWithAlt / content.images.length) * 10);
    }

    // Favicon (5 points)
    if (content.hasFavicon) score += 5;

    // Structured data (10 points)
    if (content.structuredData && content.structuredData.length > 0) score += 10;

    // Content length (5 points)
    if (content.wordCount >= 300) score += 5;

    // Business context (30 points)
    if (content.context_analysis) {
      const contextScore = Object.values(content.context_analysis).filter(Boolean).length * 5;
      score += Math.min(30, contextScore);
    }

    return Math.min(100, score);
  }

  /**
   * Calculate technical SEO score
   * @param {Object} factors - Technical factors
   * @param {boolean} isSecure - Whether site is HTTPS
   * @returns {number} Technical score
   */
  static calculateTechnicalScore(factors, isSecure) {
    let score = 0;

    if (factors.hasMetaViewport) score += 20;
    if (factors.hasCanonical) score += 15;
    if (isSecure) score += 25;
    if (factors.hasSitemap) score += 10;
    if (factors.robotsContent && !factors.robotsContent.includes('noindex')) score += 15;

    return Math.min(100, score);
  }

  /**
   * Calculate UX score
   * @param {Object} factors - UX factors
   * @returns {number} UX score
   */
  static calculateUXScore(factors) {
    let score = 0;

    if (factors.contactForms > 0) score += 25;
    if (factors.chatWidgets > 0) score += 20;
    if (factors.socialLinks > 0) score += 15;
    if (factors.testimonialElements > 0) score += 20;
    if (factors.faqElements > 0) score += 20;

    return Math.min(100, score);
  }

  /**
   * Calculate mobile score
   * @param {Object} analysis - Mobile analysis
   * @returns {number} Mobile score
   */
  static calculateMobileScore(analysis) {
    let score = 0;

    if (analysis.hasViewport) score += 40;
    if (analysis.fitsInViewport) score += 30;
    if (analysis.totalImages > 0) {
      const responsiveImageRatio = analysis.responsiveImages / analysis.totalImages;
      score += responsiveImageRatio * 30;
    }

    return Math.min(100, score);
  }

  /**
   * Normalize URL
   * @param {string} url - URL to normalize
   * @returns {string} Normalized URL
   */
  static normalizeUrl(url) {
    if (!url) return '';

    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    // Remove trailing slash
    url = url.replace(/\/$/, '');

    return url;
  }
}
