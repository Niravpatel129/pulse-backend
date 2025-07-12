import OpenAI from 'openai';

/**
 * Review Sentiment Analysis Service
 * Analyzes Google reviews for sentiment and extracts key topics
 */
export class ReviewSentimentService {
  static openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  /**
   * Analyze reviews for sentiment and topics
   * @param {Array} reviews - Array of Google reviews
   * @param {string} placeId - Google Place ID
   * @returns {Promise<Object>} Review analysis results
   */
  static async analyzeReviews(reviews, placeId) {
    const startTime = Date.now();

    try {
      console.log('🔍 Starting review sentiment analysis:', {
        reviewCount: reviews.length,
        placeId,
      });

      if (!reviews || reviews.length === 0) {
        return {
          place_id: placeId,
          total_reviews: 0,
          analysis_duration_ms: Date.now() - startTime,
          sentiment_summary: {
            positive: 0,
            neutral: 0,
            negative: 0,
            average_sentiment: 0,
          },
          topics: [],
          insights: [],
        };
      }

      // Limit to most recent 50 reviews for analysis
      const reviewsToAnalyze = reviews.slice(0, 50);

      // Analyze sentiment for each review
      const sentimentResults = await this.analyzeSentimentBatch(reviewsToAnalyze);

      // Extract topics from reviews
      const topicAnalysis = await this.extractTopics(reviewsToAnalyze);

      // Generate insights
      const insights = await this.generateInsights(
        reviewsToAnalyze,
        sentimentResults,
        topicAnalysis,
      );

      // Calculate sentiment distribution
      const sentimentDistribution = this.calculateSentimentDistribution(sentimentResults);

      // Extract review statistics
      const reviewStats = this.calculateReviewStats(reviews, sentimentResults);

      const analysisResult = {
        place_id: placeId,
        total_reviews: reviews.length,
        analyzed_reviews: reviewsToAnalyze.length,
        analysis_duration_ms: Date.now() - startTime,

        // Sentiment analysis
        sentiment_summary: sentimentDistribution,

        // Review statistics
        review_stats: reviewStats,

        // Topic analysis
        topic_analysis: topicAnalysis,

        // AI-generated insights
        insights,

        // Recent reviews sample (last 5)
        recent_reviews_sample: reviews.slice(0, 5).map((review) => ({
          author: review.author_name,
          rating: review.rating,
          text: review.text?.substring(0, 200) + (review.text?.length > 200 ? '...' : ''),
          date: review.relative_time_description,
          sentiment:
            sentimentResults.find((s) => s.original_text === review.text)?.sentiment || 'unknown',
        })),

        // Analysis metadata
        analysis_metadata: {
          analyzed_at: new Date().toISOString(),
          openai_requests: Math.ceil(reviewsToAnalyze.length / 10) + 2, // Sentiment + topics + insights
          reviews_processed: reviewsToAnalyze.length,
        },
      };

      console.log('✅ Review sentiment analysis completed:', {
        duration_ms: Date.now() - startTime,
        reviews_analyzed: reviewsToAnalyze.length,
        positive_ratio: sentimentDistribution.positive_percentage,
        topics_found: topicAnalysis.topics.length,
      });

      return analysisResult;
    } catch (error) {
      console.error('❌ Review sentiment analysis failed:', {
        error: error.message,
        placeId,
        duration_ms: Date.now() - startTime,
      });

      return {
        place_id: placeId,
        total_reviews: reviews.length,
        error: error.message,
        analysis_duration_ms: Date.now() - startTime,
        sentiment_summary: {
          positive: 0,
          neutral: 0,
          negative: 0,
          average_sentiment: 0,
        },
      };
    }
  }

  /**
   * Analyze sentiment for a batch of reviews
   * @param {Array} reviews - Reviews to analyze
   * @returns {Promise<Array>} Sentiment analysis results
   */
  static async analyzeSentimentBatch(reviews) {
    try {
      console.log('🔍 Analyzing sentiment for', reviews.length, 'reviews');

      if (!this.openai) {
        throw new Error('OpenAI client not initialized');
      }

      // Process reviews in batches of 10
      const batchSize = 10;
      const results = [];

      for (let i = 0; i < reviews.length; i += batchSize) {
        const batch = reviews.slice(i, i + batchSize);

        const reviewTexts = batch.map((review, index) => ({
          id: i + index,
          text: review.text || '',
          rating: review.rating,
        }));

        const prompt = `Analyze the sentiment of these Google business reviews. For each review, provide:
1. Sentiment (positive/negative/neutral)
2. Confidence (0-1)
3. Key emotion (happy/frustrated/disappointed/satisfied/angry/etc.)
4. Main topic mentioned (food/service/price/location/quality/etc.)

Reviews to analyze:
${reviewTexts.map((r) => `Review ${r.id}: "${r.text}" (Rating: ${r.rating}/5)`).join('\n\n')}

Respond with JSON format:
{
  "reviews": [
    {
      "id": 0,
      "sentiment": "positive",
      "confidence": 0.85,
      "emotion": "satisfied",
      "topic": "food quality"
    }
  ]
}`;

        const response = await this.openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content:
                'You are an expert sentiment analyst. Analyze customer reviews and provide accurate sentiment analysis in JSON format.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        });

        const batchResults = JSON.parse(response.choices[0].message.content);

        // Add original text and merge with batch
        batchResults.reviews.forEach((result, index) => {
          if (batch[index]) {
            results.push({
              ...result,
              original_text: batch[index].text,
              original_rating: batch[index].rating,
            });
          }
        });

        // Rate limiting - wait 1 second between batches
        if (i + batchSize < reviews.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      return results;
    } catch (error) {
      console.error('❌ Sentiment analysis batch failed:', error.message);
      // Return basic sentiment based on ratings
      return reviews.map((review, index) => ({
        id: index,
        sentiment: review.rating >= 4 ? 'positive' : review.rating >= 3 ? 'neutral' : 'negative',
        confidence: 0.5,
        emotion: review.rating >= 4 ? 'satisfied' : review.rating >= 3 ? 'neutral' : 'disappointed',
        topic: 'general',
        original_text: review.text,
        original_rating: review.rating,
      }));
    }
  }

  /**
   * Extract topics from reviews
   * @param {Array} reviews - Reviews to analyze
   * @returns {Promise<Object>} Topic analysis results
   */
  static async extractTopics(reviews) {
    try {
      console.log('🔍 Extracting topics from reviews');

      if (!this.openai) {
        throw new Error('OpenAI client not initialized');
      }

      const reviewTexts = reviews.map((r) => r.text || '').filter((text) => text.length > 0);

      if (reviewTexts.length === 0) {
        return {
          topics: [],
          positive_topics: [],
          negative_topics: [],
          topic_summary: 'No review text available for analysis',
        };
      }

      // Combine all review texts for topic analysis
      const combinedText = reviewTexts.join('\n\n');

      const prompt = `Analyze these customer reviews and identify the main topics discussed. Focus on:
1. Most frequently mentioned topics
2. Topics with positive sentiment
3. Topics with negative sentiment
4. Overall themes

Reviews:
${combinedText}

Provide a JSON response with:
{
  "topics": [
    {
      "topic": "food quality",
      "frequency": 15,
      "sentiment": "positive",
      "keywords": ["delicious", "fresh", "tasty"],
      "percentage": 30
    }
  ],
  "positive_topics": ["food quality", "service"],
  "negative_topics": ["wait time", "price"],
  "topic_summary": "Overall summary of main themes"
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert in analyzing customer feedback. Extract meaningful topics and themes from reviews.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const topicAnalysis = JSON.parse(response.choices[0].message.content);

      return {
        ...topicAnalysis,
        total_reviews_analyzed: reviewTexts.length,
        analysis_method: 'openai_gpt',
      };
    } catch (error) {
      console.error('❌ Topic extraction failed:', error.message);
      return {
        topics: [],
        positive_topics: [],
        negative_topics: [],
        topic_summary: 'Topic analysis failed',
        error: error.message,
      };
    }
  }

  /**
   * Generate insights from review analysis
   * @param {Array} reviews - Original reviews
   * @param {Array} sentimentResults - Sentiment analysis results
   * @param {Object} topicAnalysis - Topic analysis results
   * @returns {Promise<Array>} Generated insights
   */
  static async generateInsights(reviews, sentimentResults, topicAnalysis) {
    try {
      console.log('🔍 Generating insights from review analysis');

      if (!this.openai) {
        throw new Error('OpenAI client not initialized');
      }

      // Calculate basic statistics
      const totalReviews = reviews.length;
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;
      const sentimentCounts = sentimentResults.reduce((acc, s) => {
        acc[s.sentiment] = (acc[s.sentiment] || 0) + 1;
        return acc;
      }, {});

      const analysisData = {
        totalReviews,
        avgRating: Math.round(avgRating * 10) / 10,
        sentimentDistribution: sentimentCounts,
        topTopics: topicAnalysis.topics?.slice(0, 5) || [],
        positiveTopics: topicAnalysis.positive_topics || [],
        negativeTopics: topicAnalysis.negative_topics || [],
      };

      const prompt = `Based on this customer review analysis, provide actionable business insights and recommendations:

Data:
- Total Reviews: ${analysisData.totalReviews}
- Average Rating: ${analysisData.avgRating}/5
- Sentiment Distribution: ${JSON.stringify(analysisData.sentimentDistribution)}
- Top Topics: ${JSON.stringify(analysisData.topTopics)}
- Positive Topics: ${JSON.stringify(analysisData.positiveTopics)}
- Negative Topics: ${JSON.stringify(analysisData.negativeTopics)}

Provide insights in JSON format:
{
  "insights": [
    {
      "type": "strength",
      "title": "Strong Food Quality",
      "description": "Customers consistently praise the quality of food",
      "impact": "high",
      "supporting_data": "85% of reviews mention food quality positively"
    },
    {
      "type": "concern",
      "title": "Long Wait Times",
      "description": "Multiple reviews mention slow service",
      "impact": "medium",
      "supporting_data": "Wait time mentioned in 30% of negative reviews"
    },
    {
      "type": "opportunity", 
      "title": "Improve Online Presence",
      "description": "Respond to reviews to show customer care",
      "impact": "medium",
      "supporting_data": "Only 20% of reviews have owner responses"
    }
  ],
  "overall_summary": "Brief summary of the business's review performance"
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are a business consultant analyzing customer reviews. Provide actionable insights and recommendations.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4,
      });

      const insightData = JSON.parse(response.choices[0].message.content);

      return insightData.insights || [];
    } catch (error) {
      console.error('❌ Insight generation failed:', error.message);
      return [
        {
          type: 'info',
          title: 'Analysis Available',
          description:
            'Review data collected successfully but detailed insights could not be generated',
          impact: 'low',
          supporting_data: `${reviews.length} reviews analyzed`,
        },
      ];
    }
  }

  /**
   * Calculate sentiment distribution
   * @param {Array} sentimentResults - Sentiment analysis results
   * @returns {Object} Sentiment distribution
   */
  static calculateSentimentDistribution(sentimentResults) {
    const total = sentimentResults.length;

    if (total === 0) {
      return {
        positive: 0,
        neutral: 0,
        negative: 0,
        positive_percentage: 0,
        neutral_percentage: 0,
        negative_percentage: 0,
        average_sentiment: 0,
      };
    }

    const counts = sentimentResults.reduce((acc, result) => {
      acc[result.sentiment] = (acc[result.sentiment] || 0) + 1;
      return acc;
    }, {});

    const positive = counts.positive || 0;
    const neutral = counts.neutral || 0;
    const negative = counts.negative || 0;

    // Calculate average sentiment score (positive=1, neutral=0, negative=-1)
    const sentimentScore = sentimentResults.reduce((sum, result) => {
      const score = result.sentiment === 'positive' ? 1 : result.sentiment === 'negative' ? -1 : 0;
      return sum + score;
    }, 0);

    const averageSentiment = sentimentScore / total;

    return {
      positive,
      neutral,
      negative,
      positive_percentage: Math.round((positive / total) * 100),
      neutral_percentage: Math.round((neutral / total) * 100),
      negative_percentage: Math.round((negative / total) * 100),
      average_sentiment: Math.round(averageSentiment * 100) / 100,
    };
  }

  /**
   * Calculate review statistics
   * @param {Array} allReviews - All reviews
   * @param {Array} sentimentResults - Sentiment analysis results
   * @returns {Object} Review statistics
   */
  static calculateReviewStats(allReviews, sentimentResults) {
    if (!allReviews || allReviews.length === 0) {
      return {
        total_reviews: 0,
        average_rating: 0,
        rating_distribution: {},
        review_frequency: 'unknown',
      };
    }

    const totalReviews = allReviews.length;
    const avgRating = allReviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews;

    // Calculate rating distribution
    const ratingDistribution = allReviews.reduce((acc, review) => {
      acc[review.rating] = (acc[review.rating] || 0) + 1;
      return acc;
    }, {});

    // Calculate review frequency (simplified)
    const reviewFrequency = totalReviews > 50 ? 'high' : totalReviews > 20 ? 'medium' : 'low';

    // Calculate confidence score based on number of reviews
    const confidenceScore = Math.min(100, (totalReviews / 50) * 100);

    return {
      total_reviews: totalReviews,
      average_rating: Math.round(avgRating * 10) / 10,
      rating_distribution: ratingDistribution,
      review_frequency: reviewFrequency,
      confidence_score: Math.round(confidenceScore),
      reviews_analyzed_for_sentiment: sentimentResults.length,
    };
  }
}
