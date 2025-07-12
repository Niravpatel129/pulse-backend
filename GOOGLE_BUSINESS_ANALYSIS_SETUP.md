# Google Business Analysis Feature Setup

This feature provides comprehensive analysis of Google Business listings including SEO, UX, and local search performance.

## Required API Keys

Add these environment variables to your `.env` file:

```bash
# Google Places API Key (required)
GOOGLE_PLACES_API_KEY=your_google_places_api_key_here

# SerpAPI Key (required for competitor analysis)
SERPAPI_KEY=your_serpapi_key_here

# OpenAI API Key (required for sentiment analysis)
OPENAI_API_KEY=your_openai_api_key_here
```

## API Key Setup Instructions

### 1. Google Places API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Places API
   - Places API (New)
4. Create credentials (API Key)
5. Restrict the API key to your server IP addresses

### 2. SerpAPI Key

1. Sign up at [SerpAPI](https://serpapi.com/)
2. Get your API key from the dashboard
3. Choose a plan based on your usage needs

### 3. OpenAI API Key

1. Sign up at [OpenAI](https://platform.openai.com/)
2. Generate an API key
3. Set up billing for API usage

## Usage

### Endpoint

```
POST /api/analyze-google-business
```

### Request Body Options

**Option 1: Using Business Name and Location**

```json
{
  "business_name": "Blaze Pizza",
  "location": "Gainesville, Florida",
  "keywords": ["pizza", "fast food", "italian restaurant"],
  "industry": "restaurant"
}
```

**Option 2: Using Google Place ID**

```json
{
  "place_id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
  "keywords": ["pizza", "fast food"],
  "industry": "restaurant"
}
```

### Response Structure

```json
{
  "status": 200,
  "data": {
    "summary_score": 67,
    "seo_score": 32,
    "ux_score": 17,
    "local_listing_score": 18,
    "google_business_profile": {
      "place_id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
      "name": "Blaze Pizza",
      "address": "1234 Main St, Gainesville, FL",
      "phone": "(555) 123-4567",
      "website": "https://blazepizza.com",
      "rating": 4.2,
      "review_count": 127
    },
    "website_analysis": {
      "url": "https://blazepizza.com",
      "page_content": { ... },
      "technical_seo": { ... },
      "performance_metrics": { ... }
    },
    "local_seo_analysis": {
      "rankings_summary": { ... },
      "competitors": [ ... ],
      "local_seo_metrics": { ... }
    },
    "review_sentiment": {
      "sentiment_summary": { ... },
      "topic_analysis": { ... },
      "insights": [ ... ]
    },
    "recommendations": [
      {
        "type": "seo",
        "priority": "high",
        "title": "Add Meta Descriptions",
        "description": "Add compelling meta descriptions to improve click-through rates",
        "specific_actions": [
          "Write 120-160 character descriptions",
          "Include location and services",
          "Add call-to-action phrases"
        ]
      }
    ]
  }
}
```

## Features

### 1. Google Business Profile Analysis

- Complete business information validation
- Photo and review analysis
- Business hours and contact verification
- Category and location accuracy

### 2. Website Analysis (if available)

- SEO audit using Lighthouse
- Technical SEO factors
- Content optimization opportunities
- Mobile-friendliness assessment
- User experience evaluation

### 3. Local Search Performance

- Keyword ranking analysis
- Map pack appearances
- Competitor identification
- Local SEO metrics

### 4. Review Sentiment Analysis

- AI-powered sentiment analysis
- Topic extraction from reviews
- Customer insight generation
- Reputation management recommendations

### 5. Scoring System

- SEO Score (0-100)
- UX Score (0-100)
- Local Listing Score (0-100)
- Overall Summary Score (0-100)

### 6. Actionable Recommendations

- Prioritized improvement suggestions
- Specific action items
- Time and effort estimates
- Impact assessments

## Error Handling

The API gracefully handles various error conditions:

- Invalid or missing API keys
- Business not found
- Website unavailable
- API rate limits exceeded

## Rate Limits

Be aware of rate limits for each API:

- Google Places API: 100 requests/day (free tier)
- SerpAPI: Varies by plan
- OpenAI API: Based on usage and billing

## Testing

Use the provided test endpoint to verify setup:

```bash
curl -X POST http://localhost:5000/api/analyze-google-business \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "business_name": "Test Business",
    "location": "Test City, State"
  }'
```

## Troubleshooting

### Common Issues

1. **"Google Places API key not configured"**

   - Ensure GOOGLE_PLACES_API_KEY is set in your .env file
   - Verify the API key has proper permissions

2. **"SerpAPI key not configured"**

   - Add SERPAPI_KEY to your .env file
   - Check your SerpAPI account for remaining credits

3. **"OpenAI client not initialized"**

   - Verify OPENAI_API_KEY is correctly set
   - Ensure your OpenAI account has available credits

4. **"Business not found"**
   - Try more specific business names
   - Include more location details
   - Use Google Place ID if available

## Dependencies

The feature uses these npm packages:

- `puppeteer` - Web scraping and analysis
- `lighthouse` - SEO and performance auditing
- `serpapi` - Search engine results analysis
- `openai` - AI-powered text analysis
- `node-html-parser` - HTML parsing utilities

All dependencies are automatically installed when you run `npm install`.
