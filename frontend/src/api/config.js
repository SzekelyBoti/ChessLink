import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const WS_URL = import.meta.env.VITE_WS_URL || `ws://${window.location.host}/ws`;

console.log("API URL:", API_URL);
console.log("WS URL:", WS_URL);

const API = axios.create({
    baseURL: API_URL,
    timeout: 10000,
});

export default API;
export { API_URL, WS_URL };