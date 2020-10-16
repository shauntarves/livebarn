const axios = require("axios");

// Adjust these values based on your system's capacity
const MAX_REQUESTS_COUNT = 15;
const INTERVAL_MS = 1000;

let PENDING_REQUESTS = 0;

// create new axios instance
const api = axios.create({});

// add request interceptor to limit concurrent requests
api.interceptors.request.use((config) => {
  return new Promise((resolve) => {
    let interval = setInterval(() => {
      if (PENDING_REQUESTS < MAX_REQUESTS_COUNT) {
        PENDING_REQUESTS++;
        clearInterval(interval);
        resolve(config);
      }
    }, INTERVAL_MS);
  });
});

// add response interceptor to free up slots
api.interceptors.response.use(
  (response) => {
    PENDING_REQUESTS = Math.max(0, PENDING_REQUESTS - 1);
    return Promise.resolve(response);
  },
  (error) => {
    PENDING_REQUESTS = Math.max(0, PENDING_REQUESTS - 1);
    return Promise.reject(error);
  }
);

exports.api = api;
