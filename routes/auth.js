const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { verifyToken } = require("../middleware/auth");
const passport = require("passport");
const OTP = require("../models/otp");
const otpGenerator = require("otp-generator");
const { getOtpEmailTemplate, transporter } = require("../config/nodeMailer");

const signToken = (user) => {
  return jwt.sign({ 
    id: user._id, 
    email: user.email,
    name: user.name  // ✅ YE BHI ADD KAR DE CONSISTENCY KE LIYE
  }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

router.post("/send-otp", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "Email is required!" });
  }

  const otpCode = otpGenerator.generate(6, {
    digits: true,
    alphabets: false,
    upperCase: false,
    specialChars: false,
  });

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log(existingUser);
      return res
        .status(400)
        .json({ success: false, message: "User already registered" });
    }
    await OTP.findOneAndUpdate(
      { email },
      { otp: otpCode, createdAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const mailOptions = {
      from: `"Chess" <${process.env.EMAIL}>`,
      to: email,
      subject: "Your OTP for Chess Login",
      html: getOtpEmailTemplate(otpCode),
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: "OTP sent successfully!" });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({ success: false, message: "Error sending OTP" });
  }
});


router.post("/verify-otp", async (req, res) => {
  const { email, otp, name, password } = req.body;

  try {
    const otpEntry = await OTP.findOne({ email });

    if (!otpEntry || otpEntry.otp !== otp) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    let user = await User.findOne({ email });

    if (!user) {
     
      user = new User({ email, name, password });
      await user.save();
    }

    await OTP.deleteOne({ email });

    // ✅ SAME SIGNTOKEN USE KAR JO LOGIN MEIN USE HOTA HAI
    const token = signToken(user);

    // ✅ COOKIE SET KAR - YEH MISSING THA
    res.cookie("token", token, { 
      httpOnly: true, 
      sameSite: "lax",
      // secure: process.env.NODE_ENV === "production" // Agar production mein hai toh add kar
    });
    
    res.status(200).json({
      success: true,
      message: "OTP verified and user registered!",
      token,
      user: { id: user._id, name: user.name, email: user.email },
      redirect: "/home" 
    });
    
  } catch (error) {
    console.error("Error verifying OTP:", error.message);
    res.status(500).json({
      success: false,
      message: "Invalid Credentials , please try again",
    });
  }
});


router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password required!",
      });
    }
    const user = await User.findOne({ email });
    
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    // User model ke comparePassword method ko use kar
    const validPassword = await user.comparePassword(password);

    if (!validPassword)
      return res.status(400).json({ error: "Invalid credentials" });

    const token = signToken(user);
    res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
    return res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
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
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/login",
  }),
  (req, res) => {
    // req.user is the user object attached in passport verify callback
    const token = signToken(req.user);
    // send token to client, e.g. set cookie and redirect to /home
    res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
    res.redirect("/home"); // or send JSON if SPA
  }
);

module.exports = router;
