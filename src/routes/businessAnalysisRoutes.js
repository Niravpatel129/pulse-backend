import express from 'express';
import { validateAnalyzeGoogleBusiness } from '../config/validators/businessAnalysisValidators.js';
import { analyzeGoogleBusiness } from '../controllers/businessAnalysis/analyzeGoogleBusiness.js';
import { validateRequest } from '../middleware/expressValidatorMiddleware.js';

const router = express.Router();

router.post('/', validateAnalyzeGoogleBusiness, validateRequest, analyzeGoogleBusiness);

export default router;
