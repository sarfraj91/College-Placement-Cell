import API from "./api.jsx";

const toJobFormData = (data, companyLogo) => {
  const formData = new FormData();
  formData.append("payload", JSON.stringify(data));
  if (companyLogo) {
    formData.append("companyLogo", companyLogo);
  }
  return formData;
};

export const createJob = (data, companyLogo) =>
  API.post("/jobs/create", toJobFormData(data, companyLogo));

export const generateJobDescription = async (payload) => {
  const response = await API.post("/jobs/generate-description", payload);
  return response.data;
};

export const getAdminJobs = () => API.get("/jobs/admin");
export const getSingleAdminJob = (jobId) => API.get(`/jobs/admin/${jobId}`);
export const updateAdminJob = (jobId, data, companyLogo) =>
  API.put(`/jobs/admin/${jobId}`, toJobFormData(data, companyLogo));
export const deleteAdminJob = (jobId) => API.delete(`/jobs/admin/${jobId}`);

export const getStudentJobs = () => API.get("/student/jobs");
export const getStudentJobDetails = (jobId) => API.get(`/student/jobs/${jobId}`);
export const applyToJob = (jobId) => API.post(`/student/jobs/${jobId}/apply`);
export const getStudentAppliedJobs = () => API.get("/student/applied-jobs");
export const getStudentApplicationStatus = (jobId) =>
  API.get(`/student/jobs/${jobId}/status`);

//resume analyzer implementation
export const analyzeResume = async (formData) => {
  const response = await API.post("/resume/analyze", formData);

  return response.data;

};
