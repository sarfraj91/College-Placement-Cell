import axios from "axios";


const API = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1",
  withCredentials: true,
});


export default API;
