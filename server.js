const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const cors = require('cors');
const path = require('path');

dotenv.config();

connectDB();

const app = express();

const corsOptions = {
  origin: "http://localhost:3000",           
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json());

app.use('/scorm', express.static(path.join(__dirname, 'public/scorm')));

app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/profile', require('./routes/profile'));
app.use('/api/v1/kyc', require('./routes/kycRoutes'));
app.use('/api/v1/courses', require('./routes/courses'));
app.use('/api/v1/cart', require('./routes/cartRoute'))
app.use('/api/v1/modules', require('./routes/moduleRoutes'));
app.use('/api/v1/payments', require('./routes/paymentRoutes'));
app.use('/api/v1/categories', require('./routes/categoryRoutes'));
app.use('/api/v1/tags', require('./routes/tagRoutes'));
app.use('/api/v1/lessons', require('./routes/lessonRoutes'));
app.use('/api/v1/discussions', require('./routes/discussionRoutes'));
app.use('/api/v1/support-tickets', require('./routes/supportTicketRoutes'));
app.use('/api/v1/assignments', require('./routes/assignmentRoutes'));
app.use('/api/v1/grades', require('./routes/gradeRoutes'));

app.use('/api/v1/certificates', require('./routes/certificateRoutes'));
app.use('/api/v1/users', require('./routes/userRoutes'))
app.use('/api/v1/auth/otp', require('./routes/mailRoutes'));

app.use('/api/v1/ratings', require('./routes/ratingRoutes'));
app.use('/api/v1/auth/scorm', require('./routes/scormRoutes'))
app.use('/api/v1/wishlist', require('./routes/wishlistRoutes'));
app.use('/api/v1/stats', require('./routes/statRoutes'))
app.use('/api/v1/analytic', require('./routes/analyticRoutes'))
app.use("/api/v1/grading", require('./routes/gradeRoutes'));
app.use("/api/v1/activity-logs", require('./routes/activityLogRoutes'));

app.use('/api/v1/sessions', require('./routes/sessionRoutes'));
app.use('/api/v1/availability', require('./routes/availabilityRoutes'));
app.use('/api/v1/bookings', require('./routes/bookingRoutes'));
app.use('/api/v1/attendance', require('./routes/attendanceRoutes'));
app.use('/api/v1/evaluations', require('./routes/evaluationRoutes'));
app.use('/api/v1/progress', require('./routes/progressRoutes'));

app.use("/api/v1/questions", require("./routes/questionsRoutes"));
app.use("/api/v1/assessments", require("./routes/assessmentSubmissionRoutes"));
app.use("/api/v1/courseProgress", require("./routes/courseProgressRoutes"));
app.use("/api/v1/assessment-analysis", require("./routes/assessmentAnalysisRoutes"));

app.use('/api/v1/comments', require('./routes/commentsRoutes'))


const PORT = process.env.PORT ;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));