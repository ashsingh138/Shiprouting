// src/services/apiClient.js
import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

export const optimizeRoute = async (requestData) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/optimize-route`, requestData);
    return response.data;
  } catch (error) {
    console.error("Error fetching optimal route:", error);
    throw error;
  }
};

// NEW: Fetch the global ports for the dropdown
export const fetchPorts = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/ports`);
    return response.data;
  } catch (error) {
    console.error("Error fetching ports:", error);
    return [];
  }
};
// Add to the bottom of src/services/apiClient.js

export const trackShip = async (imo) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/track/${imo}`);
    return response.data;
  } catch (error) {
    console.error(`Error tracking ship ${imo}:`, error);
    throw error;
  }
};