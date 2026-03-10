import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
  {
    fullname: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 50,
      lowercase: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },

    avatar: {
      public_id: String,
      secure_url: String,
    },
    allowed: {
      type: Boolean,
      default: false,
    },

    role: {
      type: String,
      enum: ["student", "admin"], // ✅ FIXED
      default: "student",
    },

    profileCompleted: {
      type: Boolean,
      default: false,
    },

    phone: {
      type: String,
      trim: true,
    },

    gender: String,

    dob: {
      type: Date,
    },

    rollNo: {
      type: Number,
      unique: true,
    },

    branch: {
      type: String,
      trim: true,
    },

    cgpa: {
      type: Number,
    },

    graduationYear: {
      type: Number,
    },
    batch: {
      type: String,
    },
    placementStatus: {
      type: String,
      enum: ["placed", "unplaced", "higherStudies", "notInterested"],
      default: "unplaced",
    },

    address: {
      district: {
        type: String,
      },
      state: {
        type: String,
      },
      country: {
        type: String,
      },
      pincode: {
        type: Number,
      },
    },

    backlogs: {
      type: Number,
    },

    tenthPercent: {
      type: Number,
    },

    twelthPercent: {
      type: Number,
    },
    cocubesScore: {
      type: Number,
    },
    amcatScore: {
      type: Number,
    },

    skills: {
      type: String,
    },

    linkedin: {
      type: String,
    },

    github: {
      type: String,
    },

    internships: {
      type: String,
    },

    projects: {
      type: String,
    },

    certificates: {
      tenth: {
        public_id: String,
        secure_url: String,
        resource_type: String,
      },
      twelth: {
        public_id: String,
        secure_url: String,
        resource_type: String,
      },
      semester: {
        public_id: String,
        secure_url: String,
        resource_type: String,
      },
      cocubes: {
        public_id: String,
        secure_url: String,
        resource_type: String,
      },
      amcat: {
        public_id: String,
        secure_url: String,
        resource_type: String,
      },
      resume: {
        title: String,
        public_id: String,
        secure_url: String,
        resource_type: String,
      },
      other: [
        {
          title: String,
          public_id: String,
          secure_url: String,
          resource_type: String,
        },
      ],
    },

    forgotPasswordToken: {
      type: String,
    },
    forgotPasswordExpiry: {
      type: Date,
    },

    // Email verification (OTP)
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailOtpToken: {
      type: String,
    },
    emailOtpExpiry: {
      type: Date,
    },

    // Password change OTP (used by admin profile)
    passwordOtpToken: {
      type: String,
    },
    passwordOtpExpiry: {
      type: Date,
    },
  },
  { timestamps: true },
);

// 🔐 Encrypt password
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// ✅ Normalize any legacy role values to keep schema valid
userSchema.pre("save", function () {
  if (this.role === "user") {
    this.role = "student";
  }
});

// 🔑 JWT
userSchema.methods.generateWebToken = function () {
  return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// 🔍 Compare password
userSchema.methods.comparePassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

//to set the password
userSchema.methods.generatePasswordResetToken = async function () {
  const resetToken = crypto.randomBytes(20).toString("hex");

  this.forgotPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.forgotPasswordExpiry = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

// Generate a short-lived email verification OTP
userSchema.methods.generateEmailOtp = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.emailOtpToken = crypto.createHash("sha256").update(otp).digest("hex");
  this.emailOtpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes
  return otp;
};

// Generate OTP for password change
userSchema.methods.generatePasswordOtp = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.passwordOtpToken = crypto.createHash("sha256").update(otp).digest("hex");
  this.passwordOtpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes
  return otp;
};

export default mongoose.model("User", userSchema);
