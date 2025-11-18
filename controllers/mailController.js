const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

const transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const templatePath = path.join(__dirname, "..", "..","client", "src", "email-template", "otpTemplate.html")
const baseHtmlTemplate = fs.readFileSync(templatePath, "utf8");

function renderOtpHtml(otp) {
  return baseHtmlTemplate.replace(/{{\s*OTP\s*}}/g, String(otp));
}

const sendMail = async (req, res) => {
  const { email } = req.body;
  if (!email || !email.to || !email.otp) {
    return res.status(400).json({ error: "email.to and email.otp are required" });
  }
  try {
    const result = await sendEmailOTP(email);
    return res.json({ ok: true, ...result });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};

const sendEmailOTP = async (email) => {
  try {
    const fromAddr = String(process.env.EMAIL_USER).trim();
    const html = renderOtpHtml(email.otp);
    const info = await transporter.sendMail({
      from: `"ADTC Shikshan" <${fromAddr}>`,
      to: email.to,
      subject: "OTP for verifying email",
      text: `Your OTP is: ${email.otp}`,
      html,
    });
    return {
      messageId: info.messageId,
      previewURL: nodemailer.getTestMessageUrl?.(info) || null,
    };
  } catch (error) {
    console.error("Email error:", error);
    throw new Error("Failed to send email: " + error.message);
  }
};

module.exports = { sendEmailOTP, sendMail };
