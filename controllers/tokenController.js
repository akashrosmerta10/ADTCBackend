const jwt = require('jsonwebtoken');

exports.checkToken = async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ status: "error", message: "Token not provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return res.status(200).json({ status: "success", message: "Token is valid", decoded });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ status: "error", message: "Token expired" });
    }
    return res.status(400).json({ status: "error", message: "Invalid token" });
  }
};
