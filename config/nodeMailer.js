const express = require("express");
const nodemailer = require("nodemailer");
const router = express.Router();
require("dotenv").config();

const getOtpEmailTemplate = (otpCode) => {
  return `
  <div style="font-family: 'Segoe UI', sans-serif; background-color: #0E141B; color: #E5E5E5; padding: 40px; border-radius: 16px; max-width: 550px; margin: 40px auto; text-align: center; box-shadow: 0 0 40px rgba(0,0,0,0.4); border: 1px solid #1F2A36;">
    
    <h1 style="color: #6ABF4B; letter-spacing: 2px; font-size: 32px; margin-bottom: 10px;">
      Chess<span style="color:#ffffff;">.com</span>
    </h1>

    <p style="font-size: 17px; color: #C8D0D8; margin-top: 10px;">
      Your one-time password (OTP) to verify your account is:
    </p>

    <div style="background: #111C26; padding: 25px 35px; border-radius: 12px; border: 2px dashed #6ABF4B; margin: 30px 0; display: inline-block;">
      <span style="font-size: 46px; font-weight: bold; color: #6ABF4B; letter-spacing: 10px;">
        ${otpCode}
      </span>
    </div>

    <p style="font-size: 15px; color: #AAB4BE;">
      This OTP is valid for <strong style="color: #E5E5E5;">5 minutes</strong>.  
      Please do not share it with anyone.
    </p>

    <hr style="margin: 35px auto; border: none; height: 1px; background: linear-gradient(to right, transparent, #6ABF4B, transparent);" />

    <p style="font-size: 13px; color: #7E8892;">
      If you didn’t request this verification, please ignore this email.  
      <br/><br/>
      <span style="color:#6ABF4B;">– The Chess.com Team ♟️</span>
    </p>

  </div>
  `;
};


const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587, 
  secure: false, 
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD
  }
});

module.exports = {transporter , getOtpEmailTemplate};