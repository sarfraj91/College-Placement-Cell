import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
{
  jobTitle: { type: String, required: true },
  jobDescription: { type: String, required: true },
  //about company
  company: {
    name: { type: String, required: true },
    description: String,
    website: String,
    logo: {
      public_id: String,
      secure_url: String,
    },
    industry: String,
  },

  employmentDetails: {
    employmentType: String,
    workMode: String,
    location: String,
    department: String,
    openings: Number,
  },

  roleDetails: {
    overview: String,
    responsibilities: [String],
    projects: String,
    techStack: [String],
    tools: [String],
  },

  skills: {
    mustHave: [String],
    goodToHave: [String],
    softSkills: [String],
  },

  compensation: {
    salaryRange: String,
    stipend: String,
    benefits: [String],
  },

  hiringProcess: {
    steps: [String],
    mode: String,
    timeline: String,
  },

  timeline: {
    applyBy: Date,
    joiningDate: Date,
    lastDate:Date,
  },

  visibility: {
    type: String,
    enum: ["EligibleStudents", "Public"],
    default: "EligibleStudents",
  },

  eligibleStudents: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],

  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
},
{ timestamps: true }
);

export default mongoose.model("Job", jobSchema);
