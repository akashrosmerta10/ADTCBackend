const errorResponse = (res, err) => {
  console.log(err); // still log full error for debugging

  let statusCode = 500;
  let message = "Internal Server Error";

  // Handle duplicate key (Mongo unique index error)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    const value = err.keyValue ? Object.values(err.keyValue)[0] : "";
    message = `Please use a different ${field}`;
    statusCode = 400;
  }
  // Handle generic message
  else if (err.message) {
    message = err.message;
  }

  // If custom statusCode is provided
  if (err.statusCode) {
    statusCode = err.statusCode;
  }

  // Handle Mongoose validation errors
  if (err.errors) {
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
    statusCode = 400;
  }

  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    data: null,
  });
};

module.exports = errorResponse;