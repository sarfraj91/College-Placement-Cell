import Job from "../models/jobModel.js";
import Application from "../models/applicationModel.js";
import User from "../models/userModel.js";
import sendEmail from "../utils/sentEmail.js";

const isPastLastDate = (lastDate) => {
  if (!lastDate) return false;
  const deadline = new Date(lastDate);
  deadline.setHours(23, 59, 59, 999);
  return new Date() > deadline;
};

const isStudentInvitedForJob = (studentId, job) => {
  const eligibleStudentIds = Array.isArray(job?.eligibleStudents)
    ? job.eligibleStudents.map((id) => String(id))
    : [];
  return eligibleStudentIds.includes(String(studentId));
};

const canStudentApplyToJob = (studentId, student, job) => {
  if (!student?.allowed) return false;
  if (!isStudentInvitedForJob(studentId, job)) return false;
  if (isPastLastDate(job?.timeline?.lastDate)) return false;
  return true;
};

/* =====================================
   1. GET ALL JOBS (ALL STUDENT VIEW)
===================================== */
export const getAllJobsForStudent = async (req, res) => {
  try {
    const student = await User.findById(req.user.id).select("allowed");
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const jobs = await Job.find({})
      .sort({ createdAt: -1 })
      .lean();

    const jobIds = jobs.map((job) => job._id);
    let appliedSet = new Set();

    if (jobIds.length > 0) {
      const applications = await Application.find({
        student: req.user.id,
        job: { $in: jobIds },
      }).select("job");
      appliedSet = new Set(applications.map((app) => String(app.job)));
    }

    const jobsWithStatus = jobs.map((job) => {
      const hasApplied = appliedSet.has(String(job._id));
      return {
        ...job,
        hasApplied,
        isInvited: isStudentInvitedForJob(req.user.id, job),
        applicationsClosed: isPastLastDate(job?.timeline?.lastDate),
        canApply: canStudentApplyToJob(req.user.id, student, job) && !hasApplied,
      };
    });

    return res.status(200).json({
      success: true,
      jobs: jobsWithStatus,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* =====================================
   2. GET SINGLE JOB (FULL DETAILS)
===================================== */
export const getJobDetailsForStudent = async (req, res) => {
  try {
    const [job, student] = await Promise.all([
      Job.findById(req.params.jobId),
      User.findById(req.user.id).select("allowed"),
    ]);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const existingApplication = await Application.findOne({
      student: req.user.id,
      job: job._id,
    }).select("status");

    const isInvited = isStudentInvitedForJob(req.user.id, job);
    const applicationsClosed = isPastLastDate(job?.timeline?.lastDate);
    const hasApplied = Boolean(existingApplication);
    const canApply =
      canStudentApplyToJob(req.user.id, student, job) && !hasApplied;

    return res.status(200).json({
      success: true,
      job: {
        ...job.toObject(),
        isInvited,
        applicationsClosed,
        hasApplied,
        canApply,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* =====================================
   3. APPLY TO JOB
===================================== */
export const applyToJob = async (req, res) => {
  try {
    const studentId = req.user.id;
    const jobId = req.params.jobId;

    const [job, student] = await Promise.all([
      Job.findById(jobId),
      User.findById(studentId).select("fullname email allowed"),
    ]);

    if (!job) {
      return res
        .status(404)
        .json({ success: false, message: "Job not found" });
    }

    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }

    if (!isStudentInvitedForJob(studentId, job) || !student.allowed) {
      return res.status(403).json({
        success: false,
        message: "You are not invited to apply for this job yet.",
      });
    }

    if (isPastLastDate(job?.timeline?.lastDate)) {
      return res.status(403).json({
        success: false,
        message: "Applications are closed for this job",
      });
    }

    const alreadyApplied = await Application.findOne({
      student: studentId,
      job: jobId,
    });

    if (alreadyApplied) {
      return res.status(400).json({
        success: false,
        message: "You have already applied for this job",
      });
    }

    const application = await Application.create({
      student: studentId,
      job: jobId,
    });

    // Send email notification to admin without blocking application success.
    try {
      const admin = await User.findById(job.postedBy).select("fullname email");
      if (admin?.email) {
        const dashboardUrl = `${process.env.FRONTEND_URL}/admin/dashboard`;
        await sendEmail(
          admin.email,
          `New application received: ${job.jobTitle}`,
          `
            <p>Hello ${admin.fullname || "Admin"},</p>
            <p><b>${student.fullname}</b> (${student.email}) has applied for <b>${job.jobTitle}</b>.</p>
            <p>You can review applicants from your dashboard:</p>
            <p><a href="${dashboardUrl}" target="_blank" rel="noreferrer">${dashboardUrl}</a></p>
          `,
        );
      }
    } catch (emailError) {
      console.error("ADMIN APPLY NOTIFICATION EMAIL ERROR:", emailError);
    }

    return res.status(201).json({
      success: true,
      message: "Applied successfully",
      application,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* =====================================
   4. GET STUDENT'S APPLIED JOBS
===================================== */
export const getAppliedJobs = async (req, res) => {
  try {
    const applications = await Application.find({
      student: req.user.id,
    })
      .populate("job")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      applications,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* =====================================
   5. CHECK APPLICATION STATUS
===================================== */
export const getApplicationStatus = async (req, res) => {
  try {
    const application = await Application.findOne({
      student: req.user.id,
      job: req.params.jobId,
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Not applied",
      });
    }

    return res.status(200).json({
      success: true,
      status: application.status,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
