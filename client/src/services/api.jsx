import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:3000/api/v1", // ✅ BACKEND PORT
  withCredentials: true,

});


export default API;
