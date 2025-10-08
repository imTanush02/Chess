// routes/auth.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const passport = require("passport");

const signToken = (user) => {
  return jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    console.log(name, email, password); 
    if (!email || !password || !name) return res.status(400).json({ error: "Missing fields" });

    let user = await User.findOne({ email });
    if (user) {
        console.log("User already exists, please login");
        return res.status(400).json({ error: "User already exists" })
    };

    user = new User({ name, email, password });
    await user.save();
    const token = signToken(user);
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false, 
    });
    return res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    const token = signToken(user);
    res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
    return res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// logout
router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

// Google OAuth (with Passport)
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get("/google/callback", passport.authenticate("google", { session: false, failureRedirect: "/login" }), (req, res) => {
  // req.user is the user object attached in passport verify callback
  const token = signToken(req.user);
  // send token to client, e.g. set cookie and redirect to /home
  res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
  res.redirect("/home"); // or send JSON if SPA
});

module.exports = router;
