import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000";

const API = axios.create({
    baseURL: API_URL,
    timeout: 10000,
});

export default API;
export { API_URL, WS_URL };