import User from "../models/userModel.js";
import Job from "../models/jobModel.js";
import Application from "../models/applicationModel.js";
import appError from "../utils/errorUtils.js";
import sendEmail from "../utils/sentEmail.js";
import uploadToCloudinary from "../utils/uploadToCloudinary.js";
import fs from "fs";
import crypto from "crypto";

// ✅ Basic email format check (admin emails can be any domain)
const isValidEmail = (email = "") => /.+@.+\..+/.test(email.trim());

/* ================= DASHBOARD STATS ================= */
export const getDashboardStats = async (req, res, next) => {
  try {
    const totalStudents = await User.countDocuments({ role: "student" });
    const pendingProfiles = await User.countDocuments({
      role: "student",
      profileCompleted: false,
    });
    const placedStudents = await User.countDocuments({
      role: "student",
      placementStatus: "placed", // 🔴 IMPORTANT
    });

    const adminJobs = await Job.find({ postedBy: req.user.id })
      .select("jobTitle company timeline createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const adminJobIds = adminJobs.map((job) => job._id);
    let applications = [];

    if (adminJobIds.length > 0) {
      applications = await Application.find({
        job: { $in: adminJobIds },
      })
        .populate("student", "fullname email avatar")
        .select("job student status createdAt")
        .sort({ createdAt: -1 })
        .lean();
    }

    const applicationsByJob = new Map();
    adminJobIds.forEach((id) => applicationsByJob.set(String(id), []));

    applications.forEach((application) => {
      const key = String(application.job);
      if (applicationsByJob.has(key)) {
        applicationsByJob.get(key).push(application);
      }
    });

    const jobApplications = adminJobs.map((job) => {
      const jobApps = applicationsByJob.get(String(job._id)) || [];
      return {
        jobId: job._id,
        jobTitle: job.jobTitle,
        companyName: job.company?.name || "Company",
        companyLogo:
          typeof job.company?.logo === "string"
            ? job.company.logo
            : job.company?.logo?.secure_url || "",
        lastDate: job.timeline?.lastDate || null,
        applicantsCount: jobApps.length,
        applicants: jobApps.slice(0, 10).map((app) => ({
          applicationId: app._id,
          studentId: app.student?._id,
          fullname: app.student?.fullname || "Unknown Student",
          email: app.student?.email || "",
          avatar: app.student?.avatar?.secure_url || "",
          status: app.status,
          appliedAt: app.createdAt,
        })),
      };
    });

    res.status(200).json({
      success: true,
      stats: {
        totalStudents,
        pendingProfiles,
        placedStudents,
        totalJobs: adminJobs.length,
        totalApplications: applications.length,
        noApplicationJobs: jobApplications.filter(
          (job) => job.applicantsCount === 0,
        ).length,
      },
      jobApplications,
    });
  } catch (err) {
    next(new appError(err.message, 500));
  }
};

/* ================= ALL STUDENTS ================= */
export const getAllStudents = async (req, res, next) => {
  const students = await User.find({ role: "student" })
    .select("fullname email avatar profileCompleted placementStatus allowed");

  res.status(200).json({
    success: true,
    students,
  });
};

/* ================= PENDING PROFILES ================= */
export const getPendingStudents = async (req, res, next) => {
  const students = await User.find({
    role: "student",
    profileCompleted: false,
  }).select("fullname email avatar allowed");

  res.status(200).json({
    success: true,
    students,
  });
};

/* ================= PLACED STUDENTS ================= */
export const getPlacedStudents = async (req, res, next) => {
  const students = await User.find({
    role: "student",
    placementStatus: "placed",
  }).select("fullname email avatar allowed");

  res.status(200).json({
    success: true,
    students,
  });
};

/* ================= SINGLE STUDENT ================= */
export const getStudentById = async (req, res, next) => {
  try {
    const student = await User.findById(req.params.id);

    if (!student) {
      return next(new appError("Student not found", 404));
    }

    res.status(200).json({
      success: true,
      student,
    });
  } catch (err) {
    if (err?.name === "CastError") {
      return next(new appError("Invalid student id", 400));
    }
    next(new appError(err.message, 500));
  }
};


//for filtering student based on criterias:
// controllers/adminController.js


export const filterStudents = async (req, res) => {
  try {
    const {
      tenthMin,
      twelthMin,
      cgpaMin,
      backlogsMax,
      branch,
      batch,
      placementStatus,
    } = req.query;

    const query = { role: "student" };

    /* ===== NUMERIC FILTERS (SAFE) ===== */
    if (tenthMin) {
      query.tenthPercent = {
        $exists: true,
        $gte: Number(tenthMin),
      };
    }

    if (twelthMin) {
      // ✅ Support both new and legacy field names
      query.$or = [
        {
          twelthPercent: {
            $exists: true,
            $gte: Number(twelthMin),
          },
        },
        {
          twelfthPercent: {
            $exists: true,
            $gte: Number(twelthMin),
          },
        },
      ];
    }

    if (cgpaMin) {
      query.cgpa = {
        $exists: true,
        $gte: Number(cgpaMin),
      };
    }

    if (backlogsMax) {
      query.backlogs = {
        $exists: true,
        $lte: Number(backlogsMax),
      };
    }

    /* ===== STRING FILTERS ===== */
    if (branch) query.branch = branch;
    if (batch) query.batch = batch;
    if (placementStatus) query.placementStatus = placementStatus;

    const students = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      students,
    });
  } catch (err) {
    console.error("FILTER ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Filter students failed",
    });
  }
};

/* ================= ADMIN SELF-REGISTRATION ================= */
export const registerAdmin = async (req, res, next) => {
  try {
    const { fullname, email, password } = req.body;

    // ✅ Basic validation
    if (!fullname || !email || !password) {
      return next(new appError("All fields are required", 400));
    }
    if (!isValidEmail(email)) {
      return next(new appError("Please enter a valid email address", 400));
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });

    // ✅ If email already exists, only allow OTP resend for unverified admin
    if (existing) {
      if (existing.role !== "admin") {
        return next(new appError("Email already registered", 400));
      }
      if (existing.emailVerified) {
        return next(new appError("Admin already exists", 400));
      }

      const otp = existing.generateEmailOtp();
      await existing.save();

      await sendEmail(
        normalizedEmail,
        "Verify your admin email",
        `<p>Your admin verification OTP is <b>${otp}</b>. It is valid for 10 minutes.</p>`,
      );

      return res.status(200).json({
        success: true,
        message: "OTP sent to your email",
        needsVerification: true,
      });
    }

    // ✅ Create admin with default role
    const admin = await User.create({
      fullname,
      email: normalizedEmail,
      password,
      role: "admin",
      emailVerified: false,
      avatar: {
        public_id: normalizedEmail,
        secure_url: `https://api.dicebear.com/6.x/initials/svg?seed=${fullname}`,
      },
    });

    // ✅ Optional avatar upload
    if (req.file) {
      try {
        const uploaded = await uploadToCloudinary(req.file.path, {
          folder: "placement_admin_avatars",
        });
        admin.avatar.public_id = uploaded.public_id;
        admin.avatar.secure_url = uploaded.secure_url;
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.log("ADMIN AVATAR UPLOAD ERROR:", e);
      }
    }

    const otp = admin.generateEmailOtp();
    await admin.save();

    await sendEmail(
      normalizedEmail,
      "Verify your admin email",
      `<p>Your admin verification OTP is <b>${otp}</b>. It is valid for 10 minutes.</p>`,
    );

    return res.status(201).json({
      success: true,
      message: "Admin registered. OTP sent to your email.",
      needsVerification: true,
    });
  } catch (err) {
    return next(new appError(err.message, 500));
  }
};

/* ================= ADMIN EMAIL OTP ================= */
export const verifyAdminEmailOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return next(new appError("Email and OTP are required", 400));
    }
    if (!isValidEmail(email)) {
      return next(new appError("Please enter a valid email address", 400));
    }

    const normalizedEmail = email.toLowerCase().trim();
    const admin = await User.findOne({
      email: normalizedEmail,
      role: "admin",
    });

    if (!admin) {
      return next(new appError("Admin account not found", 404));
    }

    if (admin.emailVerified) {
      return res.status(200).json({
        success: true,
        message: "Email already verified",
      });
    }

    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
    const isExpired =
      !admin.emailOtpExpiry || admin.emailOtpExpiry < Date.now();

    if (hashedOtp !== admin.emailOtpToken || isExpired) {
      return next(new appError("Invalid or expired OTP", 400));
    }

    // ✅ Mark verified
    admin.emailVerified = true;
    admin.emailOtpToken = undefined;
    admin.emailOtpExpiry = undefined;
    await admin.save();

    return res.status(200).json({
      success: true,
      message: "Admin email verified successfully",
    });
  } catch (err) {
    return next(new appError(err.message, 500));
  }
};

export const resendAdminEmailOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return next(new appError("Email is required", 400));
    }
    if (!isValidEmail(email)) {
      return next(new appError("Please enter a valid email address", 400));
    }

    const normalizedEmail = email.toLowerCase().trim();
    const admin = await User.findOne({
      email: normalizedEmail,
      role: "admin",
    });

    if (!admin) {
      return next(new appError("Admin account not found", 404));
    }
    if (admin.emailVerified) {
      return next(new appError("Email already verified", 400));
    }

    const otp = admin.generateEmailOtp();
    await admin.save();

    await sendEmail(
      normalizedEmail,
      "Verify your admin email",
      `<p>Your admin verification OTP is <b>${otp}</b>. It is valid for 10 minutes.</p>`,
    );

    return res.status(200).json({
      success: true,
      message: "OTP resent successfully",
    });
  } catch (err) {
    return next(new appError(err.message, 500));
  }
};

/* ================= ADMIN PROFILE ================= */
export const getAdminProfile = async (req, res, next) => {
  try {
    const admin = await User.findById(req.user.id).select(
      "fullname email phone avatar role",
    );

    if (!admin) {
      return next(new appError("Admin not found", 404));
    }

    return res.status(200).json({
      success: true,
      admin,
    });
  } catch (err) {
    return next(new appError(err.message, 500));
  }
};

export const updateAdminProfile = async (req, res, next) => {
  try {
    const admin = await User.findById(req.user.id);
    if (!admin) {
      return next(new appError("Admin not found", 404));
    }

    // ✅ Only allow phone update for admin
    if (req.body.phone !== undefined) {
      admin.phone = req.body.phone;
    }

    // ✅ Optional avatar upload
    if (req.file) {
      try {
        const uploaded = await uploadToCloudinary(req.file.path, {
          folder: "placement_admin_avatars",
        });
        admin.avatar = uploaded;
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.log("ADMIN AVATAR UPLOAD ERROR:", e);
      }
    }

    await admin.save();

    return res.status(200).json({
      success: true,
      message: "Admin profile updated",
      admin,
    });
  } catch (err) {
    return next(new appError(err.message, 500));
  }
};

/* ================= ADMIN PASSWORD OTP ================= */
export const sendAdminPasswordOtp = async (req, res, next) => {
  try {
    const admin = await User.findById(req.user.id);
    if (!admin) {
      return next(new appError("Admin not found", 404));
    }

    const otp = admin.generatePasswordOtp();
    await admin.save();

    await sendEmail(
      admin.email,
      "Admin Password Change OTP",
      `<p>Your OTP to change password is <b>${otp}</b>. It is valid for 10 minutes.</p>`,
    );

    return res.status(200).json({
      success: true,
      message: "OTP sent to admin email",
    });
  } catch (err) {
    return next(new appError(err.message, 500));
  }
};

export const changeAdminPasswordWithOtp = async (req, res, next) => {
  try {
    const { otp, newPassword } = req.body;

    if (!otp || !newPassword) {
      return next(new appError("OTP and new password are required", 400));
    }
    if (newPassword.length < 8) {
      return next(new appError("Password must be at least 8 characters", 400));
    }

    const admin = await User.findById(req.user.id).select("+password");
    if (!admin) {
      return next(new appError("Admin not found", 404));
    }

    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
    const isExpired =
      !admin.passwordOtpExpiry || admin.passwordOtpExpiry < Date.now();

    if (hashedOtp !== admin.passwordOtpToken || isExpired) {
      return next(new appError("Invalid or expired OTP", 400));
    }

    admin.password = newPassword;
    admin.passwordOtpToken = undefined;
    admin.passwordOtpExpiry = undefined;
    await admin.save();

    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (err) {
    return next(new appError(err.message, 500));
  }
};

// Send an email to the selected students (uses existing nodemailer helper)
export const emailSelectedStudents = async (req, res, next) => {
  try {
    const { studentIds, subject, message, jobId } = req.body;

    // Basic validation to avoid sending empty or unintended emails
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return next(new appError("Please select at least one student", 400));
    }
    if (!subject?.trim() || !message?.trim()) {
      return next(new appError("Subject and message are required", 400));
    }

    if (!jobId) {
      return next(new appError("Please select a job for invitation", 400));
    }

    const job = await Job.findOne({
      _id: jobId,
      postedBy: req.user.id,
    }).select("jobTitle company timeline");

    if (!job) {
      return next(new appError("Job not found or not owned by this admin", 404));
    }

    // De-duplicate ids to avoid sending multiple emails to the same student
    const uniqueIds = [...new Set(studentIds)];

    // Fetch only the fields we need to send emails
    const students = await User.find({
      _id: { $in: uniqueIds },
      role: "student",
    }).select("email fullname");

    if (!students.length) {
      return next(new appError("No valid students found", 404));
    }

    const invitedStudentIds = students.map((s) => s._id);

    // Grant job access at user level and map invited students at job level.
    await Promise.all([
      User.updateMany(
        { _id: { $in: invitedStudentIds } },
        { $set: { allowed: true } },
      ),
      Job.updateOne(
        { _id: job._id },
        { $addToSet: { eligibleStudents: { $each: invitedStudentIds } } },
      ),
    ]);

    // Preserve line breaks from the textarea for HTML emails
    const htmlMessage = message.trim().replace(/\n/g, "<br/>");
    const applyLink = `${process.env.FRONTEND_URL}/student/jobs/${job._id}`;
    const invitationFooter = `
      <br/><br/>
      <p><b>Invited Job:</b> ${job.jobTitle} (${job.company?.name || "Company"})</p>
      <p><b>Apply Link:</b> <a href="${applyLink}" target="_blank" rel="noreferrer">${applyLink}</a></p>
      <p><b>Last Date:</b> ${
        job.timeline?.lastDate
          ? new Date(job.timeline.lastDate).toLocaleDateString("en-IN")
          : "Not specified"
      }</p>
    `;

    const results = await Promise.allSettled(
      students.map((s) =>
        sendEmail(
          s.email,
          subject.trim(),
          `<p>Hi ${s.fullname},</p><p>${htmlMessage}</p>${invitationFooter}`,
        ),
      ),
    );

    const failed = results.filter((r) => r.status === "rejected").length;
    const sent = results.length - failed;

    res.status(200).json({
      success: true,
      sent,
      failed,
      total: results.length,
      jobId: job._id,
    });
  } catch (err) {
    console.error("ADMIN EMAIL ERROR:", err);
    next(new appError(err.message, 500));
  }
};
