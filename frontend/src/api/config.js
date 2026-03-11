import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const getWebSocketUrl = () => {
    if (import.meta.env.VITE_WS_URL) {
        return import.meta.env.VITE_WS_URL;
    }

    const baseUrl = API_URL.replace(/^http/, 'ws');
    return baseUrl;
};

const WS_URL = getWebSocketUrl();

console.log("API URL:", API_URL);
console.log("WS URL:", WS_URL);

const API = axios.create({
    baseURL: API_URL,
    timeout: 10000,
});

export default API;
export { API_URL, WS_URL };