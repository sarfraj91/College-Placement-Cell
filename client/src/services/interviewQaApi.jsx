import API from "./api.jsx";


export const generateInterviewQuestions = async (payload) => {
  const formData = new FormData();
  formData.append("resume", payload.resumeFile);
  formData.append("role", payload.role || "full stack");
  formData.append("difficulty", payload.difficulty || "medium");
  formData.append(
    "excludeQuestions",
    JSON.stringify(Array.isArray(payload.excludeQuestions) ? payload.excludeQuestions : []),
  );

  const response = await API.post("/ai/generate-questions", formData);
  return response.data;
};


export const generateInterviewAnswer = async (payload) => {
  const response = await API.post("/ai/generate-answer", payload);
  return response.data;
};


export const evaluateInterviewAnswer = async (payload) => {
  const response = await API.post("/ai/evaluate-answer", payload);
  return response.data;
};


export const generateInterviewFollowUp = async (payload) => {
  const response = await API.post("/ai/follow-up", payload);
  return response.data;
};


export const startMockInterview = async (payload) => {
  const formData = new FormData();
  formData.append("resume", payload.resumeFile);
  formData.append("role", payload.role || "full stack");
  formData.append("difficulty", payload.difficulty || "medium");
  formData.append("englishLevel", payload.englishLevel || "medium");
  formData.append("totalQuestions", String(payload.totalQuestions || 5));

  const response = await API.post("/ai/mock-interview/start", formData);
  return response.data;
};


export const continueMockInterview = async (payload) => {
  const response = await API.post("/ai/mock-interview/next", payload);
  return response.data;
};


export const finishMockInterview = async (payload) => {
  const response = await API.post("/ai/mock-interview/finish", payload);
  return response.data;
};
