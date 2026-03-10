import User from "../models/userModel.js";

import appError from "../utils/errorUtils.js";
import uploadToCloudinary, {
  deleteFromCloudinary,
} from "../utils/uploadToCloudinary.js";
import fs from "fs";
import sendEmail from "../utils/sentEmail.js";
import crypto from "crypto";

const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// ✅ College email validation
const COLLEGE_DOMAIN = "mitmeerut.ac.in";
const isCollegeEmail = (email = "") =>
  email.toLowerCase().trim().endsWith(`@${COLLEGE_DOMAIN}`);

// ✅ Allowed roles in this system
const ALLOWED_ROLES = new Set(["student", "admin"]);

// 01.Registration logic here
const register = async (req, res, next) => {
  try {
    const { fullname, email, password } = req.body;

    // ✅ Basic validation
    if (!fullname || !email || !password) {
      return next(new appError("All fields are required", 400));
    }

    // ✅ College email validation
    if (!isCollegeEmail(email)) {
      return next(
        new appError(`Email must end with @${COLLEGE_DOMAIN}`, 400),
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ✅ If user already exists, resend OTP if not verified
    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      // ✅ Data hygiene: force legacy/invalid roles back to student
      if (!ALLOWED_ROLES.has(userExists.role)) {
        userExists.role = "student";
      }

      if (userExists.emailVerified) {
        return next(new appError("User already exists", 400));
      }

      // ✅ Re-send OTP for unverified account
      const otp = userExists.generateEmailOtp();
      await userExists.save();

      await sendEmail(
        normalizedEmail,
        "Verify your email",
        `<p>Your verification OTP is <b>${otp}</b>. It is valid for 10 minutes.</p>`,
      );

      return res.status(200).json({
        success: true,
        message: "OTP sent to your email",
        needsVerification: true,
      });
    }

    // ✅ Create user (unverified until OTP is confirmed)
    const user = await User.create({
      fullname,
      email: normalizedEmail,
      password,
      role: "student", // ✅ Default registration is always student
      emailVerified: false,
      avatar: {
        public_id: normalizedEmail,
        secure_url: `https://api.dicebear.com/6.x/initials/svg?seed=${fullname}`,
      },
    });

    if (!user) {
      return next(new appError("User registration failed", 500));
    }

    // ✅ Optional avatar upload
    if (req.file) {
      try {
        const uploaded = await uploadToCloudinary(req.file.path, {
          folder: "mit placement cell/avatars",
          width: 250,
          crop: "fill",
          height: 250,
          gravity: "face",
        });
        if (uploaded) {
          user.avatar.public_id = uploaded.public_id;
          user.avatar.secure_url = uploaded.secure_url;
          // remove the file from local uploads folder after upload
          fs.unlinkSync(`uploads/${req.file.filename}`);
        }
      } catch (e) {
        console.log("CLOUDINARY AVATAR UPLOAD ERROR:", e);
      }
    }

    // ✅ Generate OTP and send verification email
    const otp = user.generateEmailOtp();
    await user.save();

    await sendEmail(
      normalizedEmail,
      "Verify your email",
      `<p>Your verification OTP is <b>${otp}</b>. It is valid for 10 minutes.</p>`,
    );

    return res.status(201).json({
      success: true,
      message: "Registration successful. OTP sent to your email.",
      needsVerification: true,
    });
  } catch (err) {
    return next(new appError(err.message, 500));
  }
};

// 01b. Verify email OTP
const verifyEmailOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    // ✅ Basic validation
    if (!email || !otp) {
      return next(new appError("Email and OTP are required", 400));
    }

    // ✅ College email validation
    if (!isCollegeEmail(email)) {
      return next(
        new appError(`Email must end with @${COLLEGE_DOMAIN}`, 400),
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return next(new appError("Account not found", 404));
    }

    // ✅ Data hygiene: fix any legacy role values
    if (!ALLOWED_ROLES.has(user.role)) {
      user.role = "student";
    }

    if (user.emailVerified) {
      return res.status(200).json({
        success: true,
        message: "Email already verified",
      });
    }

    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
    const isExpired = !user.emailOtpExpiry || user.emailOtpExpiry < Date.now();

    if (hashedOtp !== user.emailOtpToken || isExpired) {
      return next(new appError("Invalid or expired OTP", 400));
    }

    // ✅ Mark email verified and clear OTP fields
    user.emailVerified = true;
    user.emailOtpToken = undefined;
    user.emailOtpExpiry = undefined;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (err) {
    return next(new appError(err.message, 500));
  }
};

// 01c. Resend email OTP
const resendEmailOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return next(new appError("Email is required", 400));
    }

    // ✅ College email validation
    if (!isCollegeEmail(email)) {
      return next(
        new appError(`Email must end with @${COLLEGE_DOMAIN}`, 400),
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return next(new appError("Account not found", 404));
    }

    // ✅ Data hygiene: fix any legacy role values
    if (!ALLOWED_ROLES.has(user.role)) {
      user.role = "student";
    }

    if (user.emailVerified) {
      return next(new appError("Email already verified", 400));
    }

    const otp = user.generateEmailOtp();
    await user.save();

    await sendEmail(
      normalizedEmail,
      "Verify your email",
      `<p>Your verification OTP is <b>${otp}</b>. It is valid for 10 minutes.</p>`,
    );

    return res.status(200).json({
      success: true,
      message: "OTP resent successfully",
    });
  } catch (err) {
    return next(new appError(err.message, 500));
  }
};

// 02.Login logic here
const login = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      return next(new appError("Email and password are required", 400));
    }

    // ✅ Role-based login (student/admin only)
    if (!role) {
      return next(new appError("Role is required", 400));
    }
    if (!ALLOWED_ROLES.has(role)) {
      return next(new appError("Invalid role selected", 400));
    }

    // ✅ Normalize email for consistent lookup
    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return next(new appError("Invalid email or password", 401));
    }

    // ✅ Data hygiene: normalize any legacy role before enforcing login role
    if (!ALLOWED_ROLES.has(user.role)) {
      user.role = "student";
      await user.save();
    }

    // ✅ Enforce role match on login
    if (user.role !== role) {
      return next(new appError("Unauthorized role access", 401));
    }

    // ✅ Block login until email is verified
    if (user.emailVerified === false) {
      return next(new appError("Please verify your email before login", 401));
    }

    const token = await user.generateWebToken();
    user.password = undefined;
    res.cookie("token", token, cookieOptions);
    res.status(200).json({
      success: true,
      message: "User logged in successfully",
      user,
    });
  } catch (err) {
    return next(new appError(err.message, 500));
  }
};

// 03. Logout logic here
const logout = async (req, res) => {
  res.cookie("token", null, {
    httpOnly: true,
    secure: true,
    maxAge: 0,
  });
  res.status(200).json({
    success: true,
    message: "User logged out successfully!",
  });
};

// 04.Get user profile logic here
const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    return next(new appError("Failed to fetch your profile", 500));
  }
};

//05. save the student data

const postUserData = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new appError("User not found", 404));
    }

    /* ================= SAFE TEXT FIELDS ================= */
    // ✅ Backward-compat: map old field names to new ones
    if (req.body.twelfthPercent !== undefined && req.body.twelthPercent === undefined) {
      req.body.twelthPercent = req.body.twelfthPercent;
    }
    if (req.body.mcatScore !== undefined && req.body.amcatScore === undefined) {
      req.body.amcatScore = req.body.mcatScore;
    }

    const allowedFields = [
      "fullname",
      "phone",
      "gender",
      "dob",
      "rollNo",
      "branch",
      "batch",
      "cgpa",
      "graduationYear",
      "backlogs",
      "placementStatus",
      "tenthPercent",
      "twelthPercent",
      "cocubesScore",
      "amcatScore",
      "skills",
      "linkedin",
      "github",
      "internships",
      "projects",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    });

    /* ================= ADDRESS ================= */
    // ✅ Accept both nested JSON and flat fields from FormData
    let addressPayload = null;
    if (req.body.address) {
      if (typeof req.body.address === "string") {
        try {
          addressPayload = JSON.parse(req.body.address);
        } catch {
          addressPayload = null;
        }
      } else {
        addressPayload = req.body.address;
      }
    } else {
      addressPayload = {
        district: req.body.district,
        state: req.body.state,
        country: req.body.country,
        pincode: req.body.pincode,
      };
    }

    if (addressPayload) {
      user.address = {
        district: addressPayload.district || user.address?.district,
        state: addressPayload.state || user.address?.state,
        country: addressPayload.country || user.address?.country,
        pincode: addressPayload.pincode || user.address?.pincode,
      };
    }

    /* ================= CERTIFICATES ================= */
    if (!user.certificates) user.certificates = {};

    const uploadCert = async (file, extra = {}) => {
      const uploaded = await uploadToCloudinary(file.path);
      fs.unlinkSync(file.path);
      return { ...uploaded, ...extra };
    };

    if (req.files?.tenthMarksheet?.[0]) {
      user.certificates.tenth = await uploadCert(req.files.tenthMarksheet[0]);
    }

    const twelthFile =
      req.files?.twelthMarksheet?.[0] || req.files?.twelfthMarksheet?.[0];
    if (twelthFile) {
      user.certificates.twelth = await uploadCert(twelthFile);
    }

    if (req.files?.semesterMarksheet?.[0]) {
      user.certificates.semester = await uploadCert(
        req.files.semesterMarksheet[0],
      );
    }

    if (req.files?.cocubes?.[0]) {
      user.certificates.cocubes = await uploadCert(req.files.cocubes[0]);
    }

    const amcatFile = req.files?.amcat?.[0] || req.files?.mcat?.[0];
    if (amcatFile) {
      user.certificates.amcat = await uploadCert(amcatFile);
    }

    if (req.files?.resume?.[0]) {
      user.certificates.resume = await uploadCert(req.files.resume[0], {
        title: req.body.resumeTitle || "Resume",
      });
    }

    // if (req.files?.other?.[0]) {
    //   await uploadCert(req.files.other[0], "other", {
    //     title: req.body.otherTitle || "Other Certificate",
    //   });
    // }
    /* ========= OTHER CERTIFICATES (MULTIPLE) ========= */
    if (req.files?.other?.length > 0) {
      // ensure array
      if (!Array.isArray(user.certificates.other)) {
        user.certificates.other = [];
      }

      for (let i = 0; i < req.files.other.length; i++) {
        const file = req.files.other[i];

        const title = Array.isArray(req.body.otherTitle)
          ? req.body.otherTitle[i]
          : req.body.otherTitle || "Other Certificate";

        const uploaded = await uploadCert(file, { title });
        user.certificates.other.push(uploaded);
      }
    }

    /* ================= FINAL ================= */
    user.profileCompleted = true;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile completed successfully",
      user,
    });
  } catch (error) {
    console.error("PROFILE SAVE ERROR:", error);
    next(new appError(error.message || "Failed to save profile", 500));
  }
};

// 07 to reset the password
// reset password controller
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return next(new appError("Email is required", 400));
    }

    const user = await User.findOne({ email });
    if (!user) {
      return next(new appError("Email not registered", 400));
    }

    const resetToken = await user.generatePasswordResetToken();
    console.log("reset Token", resetToken);
    await user.save();

    const resetPasswordUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    const subject = "Reset Password";

    const message = `
      <p>You can reset your password by clicking the link below:</p>
      <a href="${resetPasswordUrl}" target="_blank">Reset Your Password</a>
      <br/><br/>
      <p>If the above link does not work, copy and paste this link into a new tab:</p>
      <p>${resetPasswordUrl}</p>
    `;

    try {
      await sendEmail(email, subject, message);

      return res.status(200).json({
        success: true,
        message: `Reset password link has been sent to ${email} successfully`,
      });
    } catch (e) {
      user.forgotPasswordExpiry = undefined;
      user.forgotPasswordToken = undefined;
      await user.save();

      return next(new appError(e.message, 500));
    }
  } catch (er) {
    console.error("Forgot password error:", er);
    return next(new appError("Internal server error", 500));
  }
};

//08.to reset password
const resetPassword = async (req, res, next) => {
  try {
    const { resetToken } = req.params;
    const { password } = req.body;
    const forgotPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    const user = await User.findOne({
      forgotPasswordToken,
      forgotPasswordExpiry: { $gt: Date.now() },
    });
    if (!user) {
      return next(
        new appError("Token is invalid or expired,please try again!"),
      );
    }
    user.password = password;
    user.forgotPasswordExpiry = undefined;
    user.forgotPasswordToken = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "password changed successfully !",
    });
  } catch (e) {
    console.log(e.message);
  }
};

//09. to change the password
const changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const { id } = req.user;
    if (!oldPassword || !newPassword) {
      return next(new appError("all fields are mendatory!", 400));
    }
    const user = await User.findById(id).select("+password");
    if (!user) {
      return next(new appError("user does not exist!", 400));
    }
    const isPasswordValid = await user.comparePassword(oldPassword);
    if (!isPasswordValid) {
      return next(new appError("invalid old password!", 400));
    }
    user.password = newPassword;
    await user.save();
    user.password = undefined;
    res.status(200).json({
      success: true,
      message: "tour password is changed successfully",
    });
  } catch (e) {
    console.log(e.message);
  }
};




// UPDATE STUDENT PROFILE
const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new appError("User not found", 404));

    /* ================= TEXT FIELDS ================= */
    // ✅ Backward-compat: map old field names to new ones
    if (req.body.twelfthPercent !== undefined && req.body.twelthPercent === undefined) {
      req.body.twelthPercent = req.body.twelfthPercent;
    }
    if (req.body.mcatScore !== undefined && req.body.amcatScore === undefined) {
      req.body.amcatScore = req.body.mcatScore;
    }

    const textFields = [
      "fullname",
      "email",
      "phone",
      "gender",
      "dob",
      "rollNo",
      "branch",
      "batch",
      "cgpa",
      "graduationYear",
      "backlogs",
      "placementStatus",
      "tenthPercent",
      "twelthPercent",
      "skills",
      "projects",
      "internships",
      "linkedin",
      "github",
      "cocubesScore",
      "amcatScore",
    ];

    textFields.forEach((f) => {
      if (req.body[f] !== undefined) user[f] = req.body[f];
    });

    /* ================= ADDRESS ================= */
    // ✅ Accept both nested JSON and flat fields from FormData
    let addressPayload = null;
    if (req.body.address) {
      if (typeof req.body.address === "string") {
        try {
          addressPayload = JSON.parse(req.body.address);
        } catch {
          addressPayload = null;
        }
      } else {
        addressPayload = req.body.address;
      }
    } else {
      addressPayload = {
        district: req.body.district,
        state: req.body.state,
        country: req.body.country,
        pincode: req.body.pincode,
      };
    }

    user.address = {
      district: addressPayload?.district ?? user.address?.district,
      state: addressPayload?.state ?? user.address?.state,
      country: addressPayload?.country ?? user.address?.country,
      pincode: addressPayload?.pincode ?? user.address?.pincode,
    };

    /* ================= AVATAR ================= */
    if (req.files?.avatar?.[0]) {
      const file = req.files.avatar[0];
      const upload = await uploadToCloudinary(file.path);
      user.avatar = upload;
      fs.unlinkSync(file.path);
    }

    /* ================= CERTIFICATES ================= */
    user.certificates = user.certificates || {};

    const certMap = {
      tenthMarksheet: "tenth",
      twelthMarksheet: "twelth",
      semesterMarksheet: "semester",
      cocubes: "cocubes",
      amcat: "amcat",
      resume: "resume",
    };

    for (const field in certMap) {
      const file =
        req.files?.[field]?.[0] ||
        // ✅ Backward-compat old field names
        (field === "twelthMarksheet" ? req.files?.twelfthMarksheet?.[0] : null) ||
        (field === "amcat" ? req.files?.mcat?.[0] : null);

      if (file) {
        const upload = await uploadToCloudinary(file.path);
        user.certificates[certMap[field]] = upload;
        fs.unlinkSync(file.path);
      }
    }

    /* ================= OTHER CERTIFICATES (ARRAY) ================= */
    if (req.files?.other?.length) {
      if (!Array.isArray(user.certificates.other)) {
        user.certificates.other = [];
      }

      for (let i = 0; i < req.files.other.length; i++) {
        const file = req.files.other[i];
        const title = Array.isArray(req.body.otherTitle)
          ? req.body.otherTitle[i]
          : req.body.otherTitle || "Other Certificate";

        const uploaded = await uploadToCloudinary(file.path);
        user.certificates.other.push({ ...uploaded, title });
        fs.unlinkSync(file.path);
      }
    }

    user.profileCompleted = true;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user,
    });
  } catch (err) {
    console.error("UPDATE PROFILE ERROR:", err);
    next(new appError(err.message, 500));
  }
};




export {
  register,
  verifyEmailOtp,
  resendEmailOtp,
  resetPassword,
  forgotPassword,
  login,
  logout,
  getProfile,
  postUserData,
  changePassword,
  updateProfile,
};
