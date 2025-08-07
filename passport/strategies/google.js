import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../../models/user.js';
import { signToken } from '../../utils/jwt.js';

const strategy = new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    scope: ['profile', 'email'],
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ googleId: profile.id });

      if (!user) {
        user = await User.create({
          googleId: profile.id,
          username: profile.displayName,
          email: profile.emails[0].value,
          isVerified: true,
          password: '',
        });
      }

      const token = signToken({
        id: user._id,
        username: user.username,
        email: user.email,
      });

      done(null, { token, user });
    } catch (err) {
      done(err, null);
    }
  }
);

export default strategy;
