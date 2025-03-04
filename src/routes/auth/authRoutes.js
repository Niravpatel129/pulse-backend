const express = require('express');
const { authenticate } = require('../../middlewares/auth');
const { getAuthenticatedUser } = require('../../controllers/auth');

const router = express.Router();

router.get('/me', authenticate, getAuthenticatedUser);

module.exports = router;
