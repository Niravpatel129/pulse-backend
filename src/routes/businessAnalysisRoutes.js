import express from 'express';
import { validateAnalyzeGoogleBusiness } from '../config/validators/businessAnalysisValidators.js';
import { analyzeGoogleBusiness } from '../controllers/businessAnalysis/analyzeGoogleBusiness.js';
import { validateRequest } from '../middleware/expressValidatorMiddleware.js';

const router = express.Router();

/**
 * @route   POST /api/analyze-google-business
 * @desc    Analyze a Google Business listing with comprehensive SEO, UX, and local listing report
 * @access  Public
 * @body    {string} [business_name] - Business name (required if place_id not provided)
 * @body    {string} [location] - Business location (required if place_id not provided)
 * @body    {string} [place_id] - Google Places ID (required if business_name/location not provided)
 * @body    {string[]} [keywords] - Custom keywords to analyze (optional)
 * @body    {string} [industry] - Industry type for better analysis (optional)
 * @example POST /api/analyze-google-business
 * {
 *   "business_name": "Blaze Pizza",
 *   "location": "Gainesville, Florida"
 * }
 * @example POST /api/analyze-google-business
 * {
 *   "place_id": "ChIJN1t_tDeuEmsRUsoyG83frY4"
 * }
 */
router.post('/', validateAnalyzeGoogleBusiness, validateRequest, analyzeGoogleBusiness);

export default router;
