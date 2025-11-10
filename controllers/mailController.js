const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: 'smtp.ethereal.email',
  port: 587,
  auth: {
    user: 'precious.witting68@ethereal.email',
    pass: 'SY57GA2wDWhDuHdgBA',          
  },
});

const sendMail = async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
        return res.status(400).json({ error: "Email and OTP are required" });
      }

}

const sendEmailOTP = async (email, otp) => {
  try {
      const info = await transporter.sendMail({
        from: '"ADTC TEST NodeMailer" <precious.witting68@ethereal.email>',  
        to: email.to,
        subject: "Your OTP Code",
        text: `Your OTP is: ${email.otp}`,
        html: `<b>Your OTP is: ${email.otp}</b>`,
      });
    
      console.log("Ethereal Preview URL:", nodemailer.getTestMessageUrl(info));
      return {
        messageId: info.messageId,
        previewURL: nodemailer.getTestMessageUrl(info),
      };

    } catch (error) {
      console.error("Email error:", error);
      throw new Error("Failed to send email: " + error.message);
    }
};

module.exports = { sendEmailOTP, sendMail };
