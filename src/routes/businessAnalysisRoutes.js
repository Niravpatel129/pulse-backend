import express from 'express';
import { validateAnalyzeGoogleBusiness } from '../config/validators/businessAnalysisValidators.js';
import { analyzeGoogleBusiness } from '../controllers/businessAnalysis/analyzeGoogleBusiness.js';
import { validateRequest } from '../middleware/expressValidatorMiddleware.js';

const router = express.Router();

// Test endpoint to verify routing
router.get('/test', (req, res) => {
  res.json({ message: 'Business analysis routes working!', timestamp: new Date().toISOString() });
});

router.post(
  '/analyze-google-business',
  validateAnalyzeGoogleBusiness,
  validateRequest,
  analyzeGoogleBusiness,
);

export default router;
