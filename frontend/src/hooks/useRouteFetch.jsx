// src/hooks/useRouteFetch.js
import { useState } from 'react';
import { optimizeRoute } from '../services/apiClient';

export const useRouteFetch = () => {
  const [routeData, setRouteData] = useState(null);
  // NEW: State to remember the specific ports the user routed through
  const [requestedWaypoints, setRequestedWaypoints] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRoute = async (payload) => {
    setLoading(true);
    setError(null);
    
    // Save the requested waypoints so the map can draw markers for them
    if (payload.waypoints) {
      setRequestedWaypoints(payload.waypoints);
    }

    try {
      const data = await optimizeRoute(payload);
      setRouteData(data);
    } catch (err) {
      const errorMessage = err.response?.data?.detail || "Failed to communicate with the server.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return { routeData, requestedWaypoints, loading, error, fetchRoute };
};