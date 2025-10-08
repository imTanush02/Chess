// config/passport.js
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

module.exports = function (passport) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.BASE_URL}/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails && profile.emails[0] && profile.emails[0].value;
          let user = await User.findOne({ googleId: profile.id }) || await User.findOne({ email });

          if (user) {
            user.googleId = profile.id;
            if (!user.avatar && profile.photos && profile.photos[0]) user.avatar = profile.photos[0].value;
            await user.save();
            return done(null, user);
          } else {
            user = new User({
              name: profile.displayName || "NoName",
              email,
              googleId: profile.id,
              avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : undefined,
            });
            await user.save();
            return done(null, user);
          }
        } catch (err) {
          console.error(err);
          return done(err, null);
        }
      }
    )
  );
};
