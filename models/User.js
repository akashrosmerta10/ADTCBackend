const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    roles: {
      type: [String],
      enum: ["Supervisor", "opsmanager", "centerhead", "User", "Trainer", "Learner", "Admin"],
    },
   

    phoneNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      match: [/^[6-9]\d{9}$/, "Please enter a valid 10-digit phone number"],
    },

    alternatePhoneNumber: {
      type: String,
      sparse: true,
      trim: true,
    },

    encryptedOTP: {
      type: String,
      default: null,
    },
    emailEncryptedOTP: {
      type: String,
      default: null,
    },
    otpTimestamp: {
      type: Date,
      default: null,
    },
    emailOtpTimestamp: {
      type: String,
      default: null,
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please enter a valid email address",
      ],
    },
     pendingEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please enter a valid email address",
      ],
      default: null,
      index: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
   
    profilePhoto: {
      type: String,
      default: "/images/default-profile.png",
    },
   
   
    courses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
      },
    ],

    transactions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payment",
      },
    ],
    purchasedCourses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
      },
    ],

    onBoardData: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OnBoardData",
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
    },


    wishlist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wishlist",
    },

  //   address: {
  //   pincode: { type: String },
  //   address: { type: String },
  //   state: { type: String },
  //   city: { type: String },
  //   country: { type: String, default: "India" },

  // },
  password: { type: String },
    receiveUpdates: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt); 
    next();
  } catch (error) {
    next(error);
  }
});
UserSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

UserSchema.methods.toJSON = function () {
  const user = this.toObject();

  if (Array.isArray(user.roles) && !user.roles.includes("User")) {
    delete user.transactions;
  }

  return user;
};

module.exports = mongoose.model("User", UserSchema);
