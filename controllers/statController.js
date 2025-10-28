const Payment = require("../models/Payment");
const moment = require("moment");

exports.getPaymentOverview = async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 1; // e.g., ?months=3
    const now = moment();
    const startDate = now.clone().subtract(months - 1, "months").startOf("month");
    const endDate = now.clone().endOf("month");

    let groupFormat;
    let categories = [];

    const totalDays = endDate.diff(startDate, "days");

    if (totalDays <= 31) {
      // Group by day
      groupFormat = "%Y-%m-%d";
      const dateCursor = startDate.clone();
      while (dateCursor.isSameOrBefore(endDate)) {
        categories.push(dateCursor.format("YYYY-MM-DD"));
        dateCursor.add(1, "day");
      }
    } else {
      // Group by month
      groupFormat = "%Y-%m";
      const monthCursor = startDate.clone().startOf("month");
      while (monthCursor.isSameOrBefore(endDate)) {
        categories.push(monthCursor.format("YYYY-MM"));
        monthCursor.add(1, "month");
      }
    }

    const payments = await Payment.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() },
          status: "verified",
        },
      },
      {
        $group: {
          _id: {
            label: {
              $dateToString: {
                format: groupFormat,
                date: "$createdAt",
              },
            },
          },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    const dataMap = payments.reduce((acc, curr) => {
      acc[curr._id.label] = curr.totalAmount;
      return acc;
    }, {});

    const dataSeries = categories.map((label) => Number(dataMap[label] || 0));

    const totalAmount = dataSeries.reduce((sum, val) => sum + val, 0);

    res.json({
      categories,
      series: [{ name: "Total Payments", data: dataSeries }],
      receivedAmount: totalAmount,
      dueAmount: 0,
    });
  } catch (err) {
    console.error("Error in getPaymentOverview:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
