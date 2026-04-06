// src/components/LiveMonitor/LiveMonitorPanel.jsx
import React, { useState, useEffect } from 'react';
import { optimizeRoute } from '../../services/apiClient';

// MOCK AIS DATABASE: Now includes exact destination coordinates to prevent text-matching errors
const MOCK_AIS_DATABASE = {
  "9454246": {
    name: "Ocean Explorer",
    currentLat: 51.9,  // Near Rotterdam
    currentLon: 4.1,
    heading: 135,
    speed: 14.5,
    destinationPortName: "Singapore",
    destLat: 1.26,     // EXACT coordinates for Singapore terminal
    destLon: 103.83
  },
  "9333366": {
    name: "Baltic Trader",
    currentLat: 40.7,  // Near New York
    currentLon: -74.0,
    heading: 90,
    speed: 12.0,
    destinationPortName: "Rotterdam",
    destLat: 51.95,    // EXACT coordinates for Rotterdam port
    destLon: 4.05
  },
  "9876543": {
    name: "Pacific Giant",
    currentLat: 35.6,  // Near Tokyo
    currentLon: 139.6,
    heading: 220,
    speed: 16.2,
    destinationPortName: "Fujairah",
    destLat: 25.12,    // EXACT coordinates for Fujairah port
    destLon: 56.36
  }
};

const LiveMonitorPanel = ({ setTrackingData }) => {
  const [imo, setImo] = useState('9454246');
  const [isSimulating, setIsSimulating] = useState(false);
  const [status, setStatus] = useState('Standby');

  // Simulation State
  const [shipState, setShipState] = useState(null);
  const [futurePath, setFuturePath] = useState([]);
  const [pastPath, setPastPath] = useState([]);

  const fetchFutureRoute = async (currentLat, currentLon, destLat, destLon) => {
    try {
      setStatus("Analyzing weather & calculating route...");
      const payload = {
        waypoints: [
          { lat: currentLat, lon: currentLon, name: "Current Location", isoCode: "" },
          { lat: destLat, lon: destLon, name: "Destination", isoCode: "" }
        ],
        departure_time: new Date().toISOString(),
        ship_profile: { max_speed_knots: 15.0, daily_fuel_consumption_tons: 30.0, draft_meters: 10.0 },
        weights: { fuel_weight: 0.5, time_weight: 0.5, max_safe_wave_height_meters: 4.0 }
      };

      const routeData = await optimizeRoute(payload);
      const pathCoordinates = routeData.path.map(wp => [wp.lat, wp.lon]);
      setFuturePath(pathCoordinates);
      setStatus("Route secured. Underway.");
      return pathCoordinates;
    } catch (error) {
      setStatus("Error calculating route.");
      console.error(error);
      return [];
    }
  };

  const startTracking = async () => {
    setStatus("Pinging ship AIS transponder...");
    setIsSimulating(true);

    // 1. Find the ship via IMO
    const shipDetails = MOCK_AIS_DATABASE[imo];
    if (!shipDetails) {
      setStatus("Error: Ship not found in AIS database.");
      setIsSimulating(false);
      return;
    }

    setStatus(`Ship located. Destination: ${shipDetails.destinationPortName}. Routing...`);
    
    // Set initial state
    setShipState(shipDetails);
    setPastPath([[shipDetails.currentLat, shipDetails.currentLon]]);
    
    // 2. Calculate the route automatically using the reliable hardcoded coordinates
    const initialRoute = await fetchFutureRoute(
      shipDetails.currentLat, 
      shipDetails.currentLon, 
      shipDetails.destLat, 
      shipDetails.destLon
    );
    
    // Send data to the map
    setTrackingData({
      currentLocation: { lat: shipDetails.currentLat, lon: shipDetails.currentLon, heading: shipDetails.heading, speed_knots: shipDetails.speed },
      futurePath: initialRoute,
      pastPath: [[shipDetails.currentLat, shipDetails.currentLon]],
      shipDetails: { name: shipDetails.name, imo: imo, destination: shipDetails.destinationPortName }
    });
  };

  // The Simulation Engine
  // The Simulation Engine
  useEffect(() => {
    let interval;
    if (isSimulating && futurePath.length > 1 && shipState) {
      interval = setInterval(() => {
        const nextPoint = futurePath[1]; 
        
        // 1. Calculate all the new data directly
        const newPastPath = [...pastPath, [shipState.currentLat, shipState.currentLon]];
        const newFuturePath = futurePath.slice(1);

        // Calculate heading
        const latDiff = nextPoint[0] - shipState.currentLat;
        const lonDiff = nextPoint[1] - shipState.currentLon;
        let calculatedHeading = Math.atan2(lonDiff, latDiff) * (180 / Math.PI);
        if (calculatedHeading < 0) calculatedHeading += 360;

        // 2. Safely push data up to the parent App component First
        const newData = {
          currentLocation: { lat: nextPoint[0], lon: nextPoint[1], heading: calculatedHeading, speed_knots: shipState.speed },
          futurePath: newFuturePath,
          pastPath: newPastPath,
          shipDetails: { name: shipState.name, imo: imo, destination: shipState.destinationPortName }
        };
        setTrackingData(newData);

        // 3. Update local component state independently
        setPastPath(newPastPath);
        setFuturePath(newFuturePath);
        setShipState({
          ...shipState,
          currentLat: nextPoint[0],
          currentLon: nextPoint[1],
          heading: calculatedHeading
        });

        // 4. Reroute every 10 ticks (Simulating dynamic weather changes)
        if (newPastPath.length % 10 === 0 && newFuturePath.length > 10) {
           const finalDest = newFuturePath[newFuturePath.length - 1];
           fetchFutureRoute(nextPoint[0], nextPoint[1], finalDest[0], finalDest[1]);
        }

      }, 2000); 
    }
    
    // Cleanup the interval if the component unmounts or state changes
    return () => clearInterval(interval);
  }, [isSimulating, futurePath, pastPath, shipState, imo, setTrackingData]);
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-bold mb-4 text-blue-900 border-b pb-2">Live Monitor</h3>
      
      <div className="space-y-4 mb-6">
        <label className="block text-sm font-semibold text-gray-600 mb-1">
          Ship IMO Number
        </label>
        
        {/* Helper text for the user so they know what IMOs work in the prototype */}
        <p className="text-xs text-gray-400 mb-2">
          Try: <strong>9454246</strong> (Rotterdam to SG) or <strong>9333366</strong> (NY to Rotterdam)
        </p>

        <input 
          type="text" 
          value={imo} 
          onChange={e => setImo(e.target.value)} 
          disabled={isSimulating} 
          className="w-full p-3 border border-gray-300 rounded text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" 
          placeholder="Enter IMO..."
        />
      </div>

      <div className="bg-gray-50 p-3 rounded mb-6 text-sm text-gray-700 font-mono min-h-[48px] border border-gray-200">
        Status: <span className="text-blue-600 font-semibold">{status}</span>
      </div>

      {!isSimulating ? (
        <button onClick={startTracking} className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded shadow transition-colors">
          ▶ Locate & Track Ship
        </button>
      ) : (
        <button onClick={() => { setIsSimulating(false); setStatus('Tracking Paused.'); }} className="w-full py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded shadow transition-colors">
          ⏹ Pause Tracking
        </button>
      )}
    </div>
  );
};

export default LiveMonitorPanel;