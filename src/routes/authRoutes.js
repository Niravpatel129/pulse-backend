const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/auth');
const { protect } = require('../config/middleware/auth');
const validateRequest = require('../config/middleware/validateRequest');
const { createUser: createUserSchema } = require('../config/validators/userValidators');

router.post('/register', validateRequest(createUserSchema), register);
router.post('/login', login);
router.get('/me', protect, getMe);

module.exports = router;
