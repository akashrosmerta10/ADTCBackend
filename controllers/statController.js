const Payment = require("../models/Payment");
const errorResponse = require("../utils/errorResponse");

function getRange(period) {
  const now = new Date();
  const confs = {
    daily:   { unit: "day",   buckets: 30 },
    weekly:  { unit: "week",  buckets: 12 },
    monthly: { unit: "month", buckets: 12 },
    yearly:  { unit: "year",  buckets: 5 },
  };
  const conf = confs[period] || confs.monthly;

  const start = new Date(now);
  if (conf.unit === "day") start.setDate(start.getDate() - (conf.buckets - 1));
  if (conf.unit === "week") start.setDate(start.getDate() - (conf.buckets - 1) * 7);
  if (conf.unit === "month") start.setMonth(start.getMonth() - (conf.buckets - 1));
  if (conf.unit === "year") start.setFullYear(start.getFullYear() - (conf.buckets - 1));

  return { unit: conf.unit, start, now };
}

function truncateToBucketStart(d, unit) {
  const x = new Date(d);
  if (unit === "day") {
    x.setHours(0, 0, 0, 0);
  } else if (unit === "week") {
    const day = x.getDay(); // 0 Sun..6 Sat
    const diff = (day === 0 ? -6 : 1) - day; // ISO Monday
    x.setDate(x.getDate() + diff);
    x.setHours(0, 0, 0, 0);
  } else if (unit === "month") {
    x.setDate(1);
    x.setHours(0, 0, 0, 0);
  } else if (unit === "year") {
    x.setMonth(0, 1);
    x.setHours(0, 0, 0, 0);
  }
  return x;
}

function formatLabel(d, unit) {
  if (unit === "day") {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  if (unit === "week") {
    const end = new Date(d);
    end.setDate(end.getDate() + 6);
    return (
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " - " +
      end.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    );
  }
  if (unit === "month") {
    return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  }
  if (unit === "year") {
    return String(d.getFullYear());
  }
  return d.toISOString();
}

exports.getPaymentOverview = async (req, res) => {
  try {
    const period = String(req.query.period || "monthly").toLowerCase();
    const { unit, start, now } = getRange(period);

    const pipeline = [
      { $match: { status: "verified", createdAt: { $gte: start, $lte: now } } },
      {
        $addFields: {
          bucket: {
            $dateTrunc: {
              date: "$createdAt",
              unit: unit,
              timezone: "Asia/Kolkata",
              startOfWeek: "Monday",
            },
          },
        },
      },
      { $group: { _id: "$bucket", totalAmount: { $sum: "$amount" } } },
      { $sort: { _id: 1 } },
    ];

    const rows = await Payment.aggregate(pipeline);

    const map = new Map();
    rows.forEach((r) => {
      const key = new Date(r._id).toISOString();
      map.set(key, r.totalAmount);
    });

    const labels = [];
    const data = [];
    const cursor = truncateToBucketStart(start, unit);
    const last = truncateToBucketStart(now, unit);

    while (cursor <= last) {
      const bucketStart = truncateToBucketStart(cursor, unit);
      const key = bucketStart.toISOString();
      const value = map.get(key) || 0;

      labels.push(formatLabel(bucketStart, unit));
      data.push(value);

      if (unit === "day") cursor.setDate(cursor.getDate() + 1);
      else if (unit === "week") cursor.setDate(cursor.getDate() + 7);
      else if (unit === "month") cursor.setMonth(cursor.getMonth() + 1);
      else if (unit === "year") cursor.setFullYear(cursor.getFullYear() + 1);
    }

    const totalAmount = data.reduce((s, v) => s + v, 0);

    return res.json({
      period,
      labels,
      series: [{ name: "Payments", data }],
      receivedAmount: totalAmount,
      dueAmount: 0,
      currency: "INR",
    });
  } catch (error) {
  return errorResponse(res, error);
  }
};
