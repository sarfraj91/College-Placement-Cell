import API from "./api.jsx";

export const submitFeedback = async (payload) => {
  const response = await API.post("/users/feedback", payload);
  return response.data;
};
