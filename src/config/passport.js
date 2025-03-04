import passport from 'passport';
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt';
import { Strategy as LocalStrategy } from 'passport-local';
import User from '../models/User.js';

// Local Strategy
passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
    },
    async (email, password, done) => {
      try {
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
          return done(null, false, { message: 'Invalid credentials' });
        }

        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
          return done(null, false, { message: 'Invalid credentials' });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    },
  ),
);

// JWT Strategy
const options = {
  jwtFromRequest: ExtractJwt.fromExtractors([
    ExtractJwt.fromAuthHeaderAsBearerToken(),
    (req) => {
      let token = null;
      if (req && req.cookies) {
        token = req.cookies.jwt;
        console.log('Passport - Extracted token from cookie:', token);
      }
      return token;
    },
  ]),
  secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
};

passport.use(
  new JwtStrategy(options, async (payload, done) => {
    try {
      console.log('Passport - JWT Payload:', payload);
      const user = await User.findById(payload.id);
      if (user) {
        console.log('Passport - Found user:', user._id);
        return done(null, user);
      }
      console.log('Passport - No user found for payload:', payload);
      return done(null, false);
    } catch (error) {
      console.log('Passport - Error finding user:', error);
      return done(error, false);
    }
  }),
);

export default passport;
