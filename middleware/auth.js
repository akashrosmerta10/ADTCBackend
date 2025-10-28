const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

const auth = (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: "Authorization header missing",
        data: null,
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: "Invalid token format. Expected 'Bearer <token>'",
        data: null,
      });
    }

    const token = authHeader.split(" ")[1];
    if (!JWT_SECRET) {
      console.error("Missing JWT_SECRET in environment variables!");
      return res.status(500).json({
        success: false,
        statusCode: 500,
        message: "Server misconfiguration: missing JWT_SECRET",
        data: null,
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded.user;
    next();

  } catch (err) {
    console.error("JWT verification failed:", err);

    let message = "Invalid or expired token";
    if (err.name === "TokenExpiredError") message = "Token has expired";
    if (err.name === "JsonWebTokenError") message = "Invalid token signature";

    return res.status(401).json({
      success: false,
      statusCode: 401,
      message,
      data: null,
    });
  }
};

module.exports = auth;
