const Payment = require("../models/Payment");
const moment = require("moment-timezone");

exports.getCourseSales = async (req, res) => {
  try {
    const timezone = "Asia/Kolkata";
    const range = req.query.range || "weekly";

    const labels = [];
    const paidCourses = [];

    if (range === "weekly") {
      const days = 7;
      const now = moment().tz(timezone).endOf("day");
      const startDate = moment().tz(timezone).subtract(days - 1, "days").startOf("day");

      for (let i = 0; i < days; i++) {
        const day = moment(startDate).add(i, "days").tz(timezone);
        const dayStart = day.clone().startOf("day").toDate();
        const dayEnd = day.clone().endOf("day").toDate();

        const count = await Payment.countDocuments({
          status: "verified",
          createdAt: { $gte: dayStart, $lte: dayEnd },
        });

        labels.push(day.format("ddd")); // Mon, Tue, etc.
        paidCourses.push(count);
      }

    } else if (range === "monthly") {
      const months = 12;
      const now = moment().tz(timezone);
      for (let i = months - 1; i >= 0; i--) {
        const month = moment(now).subtract(i, "months").tz(timezone);
        const startOfMonth = month.clone().startOf("month").toDate();
        const endOfMonth = month.clone().endOf("month").toDate();

        const count = await Payment.countDocuments({
          status: "verified",
          createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        });

        labels.push(month.format("MMM")); 
        paidCourses.push(count);
      }

    } else if (range === "yearly") {
      const years = 5;
      const now = moment().tz(timezone);
      for (let i = years - 1; i >= 0; i--) {
        const year = moment(now).subtract(i, "years").tz(timezone);
        const startOfYear = year.clone().startOf("year").toDate();
        const endOfYear = year.clone().endOf("year").toDate();

        const count = await Payment.countDocuments({
          status: "verified",
          createdAt: { $gte: startOfYear, $lte: endOfYear },
        });

        labels.push(year.format("YYYY"));
        paidCourses.push(count);
      }
    }

    return res.status(200).json({ labels, paidCourses });

  } catch (error) {
    console.error("Error in getCourseSales:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
