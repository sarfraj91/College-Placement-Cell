import fs from "fs";
import Job from "../models/jobModel.js";
import Application from "../models/applicationModel.js";
import uploadToCloudinary from "../utils/uploadToCloudinary.js";

const parseJobPayload = (rawBody) => {
  if (rawBody?.payload) {
    try {
      return JSON.parse(rawBody.payload);
    } catch {
      return null;
    }
  }
  return rawBody;
};

const normalizeToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const validateLastDate = (jobBody = {}) => {
  const lastDateInput = jobBody?.timeline?.lastDate;
  if (!lastDateInput) {
    return "Last date is required";
  }

  const lastDate = new Date(lastDateInput);
  if (Number.isNaN(lastDate.getTime())) {
    return "Invalid last date";
  }

  if (lastDate < normalizeToday()) {
    return "Last date cannot be in the past";
  }

  return "";
};

const uploadCompanyLogoIfAny = async (file) => {
  if (!file) return null;
  try {
    const uploadedLogo = await uploadToCloudinary(file.path, {
      folder: "placement_jobs/company_logos",
    });
    return uploadedLogo;
  } finally {
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  }
};

export const createJob = async (req, res) => {
  try {
    const payload = parseJobPayload(req.body);
    if (!payload) {
      return res.status(400).json({
        success: false,
        message: "Invalid job payload",
      });
    }

    const lastDateError = validateLastDate(payload);
    if (lastDateError) {
      return res.status(400).json({
        success: false,
        message: lastDateError,
      });
    }

    const companyLogo = await uploadCompanyLogoIfAny(req.file);

    const job = await Job.create({
      ...payload,
      company: {
        ...(payload.company || {}),
        ...(companyLogo ? { logo: companyLogo } : {}),
      },
      eligibleStudents: [],
      postedBy: req.user?.id,
    });

    return res.status(201).json({
      success: true,
      message: "Job created successfully",
      job,
    });
  } catch (error) {
    console.error("CREATE JOB ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAdminJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ postedBy: req.user.id })
      .sort({ createdAt: -1 })
      .lean();

    const jobIds = jobs.map((job) => job._id);
    let countMap = new Map();

    if (jobIds.length > 0) {
      const counts = await Application.aggregate([
        { $match: { job: { $in: jobIds } } },
        { $group: { _id: "$job", count: { $sum: 1 } } },
      ]);
      countMap = new Map(
        counts.map((item) => [item._id.toString(), item.count]),
      );
    }

    const jobsWithStats = jobs.map((job) => ({
      ...job,
      applicantsCount: countMap.get(job._id.toString()) || 0,
      invitedStudentsCount: Array.isArray(job.eligibleStudents)
        ? job.eligibleStudents.length
        : 0,
    }));

    return res.status(200).json({
      success: true,
      jobs: jobsWithStats,
    });
  } catch (error) {
    console.error("GET ADMIN JOBS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getSingleAdminJob = async (req, res) => {
  try {
    const job = await Job.findOne({
      _id: req.params.jobId,
      postedBy: req.user.id,
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    return res.status(200).json({
      success: true,
      job,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateAdminJob = async (req, res) => {
  try {
    const job = await Job.findOne({
      _id: req.params.jobId,
      postedBy: req.user.id,
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    const payload = parseJobPayload(req.body);
    if (!payload) {
      return res.status(400).json({
        success: false,
        message: "Invalid job payload",
      });
    }

    const lastDateError = validateLastDate(payload);
    if (lastDateError) {
      return res.status(400).json({
        success: false,
        message: lastDateError,
      });
    }

    const companyLogo = await uploadCompanyLogoIfAny(req.file);

    job.jobTitle = payload.jobTitle;
    job.jobDescription = payload.jobDescription;
    job.company = {
      ...(payload.company || {}),
      logo: companyLogo || job.company?.logo,
    };
    job.employmentDetails = payload.employmentDetails || {};
    job.roleDetails = payload.roleDetails || {};
    job.skills = payload.skills || {};
    job.compensation = payload.compensation || {};
    job.hiringProcess = payload.hiringProcess || {};
    job.timeline = payload.timeline || {};
    job.visibility = payload.visibility || "EligibleStudents";

    await job.save();

    return res.status(200).json({
      success: true,
      message: "Job updated successfully",
      job,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteAdminJob = async (req, res) => {
  try {
    const job = await Job.findOne({
      _id: req.params.jobId,
      postedBy: req.user.id,
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    await Promise.all([
      Job.deleteOne({ _id: job._id }),
      Application.deleteMany({ job: job._id }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Job deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
