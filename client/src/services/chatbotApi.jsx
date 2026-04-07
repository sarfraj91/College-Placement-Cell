import API from "./api.jsx";


export const askPlacementAssistant = async (payload) => {
  const response = await API.post("/ai/chat", payload);
  return response.data;
};
