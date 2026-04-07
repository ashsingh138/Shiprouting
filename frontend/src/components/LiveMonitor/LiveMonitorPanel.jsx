import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { trackShip, optimizeRoute } from '../../services/apiClient';

const API_BASE_URL = 'https://shiprouting.onrender.com/api/v1'; 

// --- MATH HELPERS ---
const calculateHeading = (lat1, lon1, lat2, lon2) => {
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const y = Math.sin(dLon) * Math.cos(lat2 * (Math.PI / 180));
  const x = Math.cos(lat1 * (Math.PI / 180)) * Math.sin(lat2 * (Math.PI / 180)) - Math.sin(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.cos(dLon);
  let brng = Math.atan2(y, x) * (180 / Math.PI);
  return (brng + 360) % 360;
};

const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const getDestinationPoint = (lat, lon, distanceKm, bearingDeg) => {
  const R = 6371;
  const d = distanceKm;
  const brng = bearingDeg * (Math.PI / 180);
  const lat1 = lat * (Math.PI / 180);
  const lon1 = lon * (Math.PI / 180);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d / R) + Math.cos(lat1) * Math.sin(d / R) * Math.cos(brng));
  const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d / R) * Math.cos(lat1), Math.cos(d / R) - Math.sin(lat1) * Math.sin(lat2));
  return [lat2 * (180 / Math.PI), lon2 * (180 / Math.PI)];
};

const pointLineDistance = (p, v, w) => {
  const l2 = Math.pow(v[0] - w[0], 2) + Math.pow(v[1] - w[1], 2);
  if (l2 === 0) return Math.sqrt(Math.pow(p[0] - v[0], 2) + Math.pow(p[1] - v[1], 2));
  let t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
  t = Math.max(0, Math.min(1, t));
  const projection = [v[0] + t * (w[0] - v[0]), v[1] + t * (w[1] - v[1])];
  return Math.sqrt(Math.pow(p[0] - projection[0], 2) + Math.pow(p[1] - projection[1], 2));
};

const simplifyPath = (points, epsilon = 0.05) => {
  if (!points || points.length < 3) return points;
  let dmax = 0;
  let index = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = pointLineDistance(points[i], start, end);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilon) {
    const left = simplifyPath(points.slice(0, index + 1), epsilon);
    const right = simplifyPath(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  } else {
    return [start, end];
  }
};

const LiveMonitorPanel = ({ setTrackingData }) => {
  const [imo, setImo] = useState('9464039'); 
  const [isSimulating, setIsSimulating] = useState(false);
  const [status, setStatus] = useState('Standby');
  const [weatherAlert, setWeatherAlert] = useState(false);
  
  const [shipState, setShipState] = useState(null);
  const [futurePath, setFuturePath] = useState([]);
  const [pastPath, setPastPath] = useState([]);

  const startTracking = async () => {
    setStatus("Pinging ship AIS transponder & calculating global route...");
    setIsSimulating(true);
    setWeatherAlert(false);

    try {
      const response = await axios.get(`${API_BASE_URL}/track/${imo}/live-voyage`);
      const data = response.data;
      const mmsi = data.shipDetails.mmsi || `36${imo.substring(0, 7)}`;

      const cleanPast = simplifyPath(data.pastPath, 0.05);
      const cleanFuture = simplifyPath(data.futurePath, 0.05);

      setStatus(`Sailing from ${data.shipDetails.origin} to ${data.shipDetails.destination}. Live tracking active.`);
      
      setShipState({
        name: data.shipDetails.name,
        imo: data.shipDetails.imo,
        mmsi: mmsi,
        currentLat: data.currentLocation.lat,
        currentLon: data.currentLocation.lon,
        heading: data.currentLocation.heading,
        speed: data.currentLocation.speed_knots,
        destinationPortName: data.shipDetails.destination,
        originPortName: data.shipDetails.origin,
        destLat: cleanFuture[cleanFuture.length - 1][0],
        destLon: cleanFuture[cleanFuture.length - 1][1]
      });

      setPastPath(cleanPast);
      setFuturePath(cleanFuture);
      
      setTrackingData({
          ...data,
          pastPath: cleanPast,
          futurePath: cleanFuture
      }); 

    } catch (error) {
      setStatus("Error: Ship not found or routing failed.");
      setIsSimulating(false);
    }
  };

  // --- THE NEW RADIAL SEARCH DETOUR ---
  const injectAdverseWeather = async () => {
    if (futurePath.length < 2) return;

    // Small, highly localized storm (25km)
    const stormRadiusKm = 25; 

    // Find a spot ~50-60km ahead of the ship
    let stormIndex = -1;
    let distAcc = 0;
    for(let i = 1; i < futurePath.length; i++) {
        distAcc += calculateDistanceKm(shipState.currentLat, shipState.currentLon, futurePath[i][0], futurePath[i][1]);
        if (distAcc > 50) { 
            stormIndex = i;
            break;
        }
    }

    if (stormIndex === -1 || stormIndex >= futurePath.length - 1) {
        setStatus("⚠️ Voyage is too close to destination to inject severe weather.");
        return;
    }

    setWeatherAlert(true);
    setStatus("⚠️ SEVERE CYCLONE DETECTED. SCANNING FOR SAFE DETOUR...");

    const stormCenter = futurePath[stormIndex];

    setTrackingData(prev => ({
      ...prev,
      stormArea: { lat: stormCenter[0], lon: stormCenter[1], radius: stormRadiusKm * 1000 }
    }));

    try {
        const prevPt = futurePath[stormIndex - 1];
        const nextPt = futurePath[stormIndex + 1];
        const pathBearing = calculateHeading(prevPt[0], prevPt[1], nextPt[0], nextPt[1]);
        
        const reconnectIndex = Math.min(stormIndex + 2, futurePath.length - 1);
        const reconnectPt = futurePath[reconnectIndex];

        // Push the detour point 40km out (clears the 25km storm easily)
        const detourPushKm = 40; 

        // THE FIX: Test multiple angles. If +80 (Right) hits land, try -80 (Left). 
        // If those hit land, try sharper angles (+115, -115).
        const anglesToTest = [80, -80, 115, -115];
        let successfulPath = null;

        for (const angleOffset of anglesToTest) {
            const testBearing = (pathBearing + angleOffset + 360) % 360; 
            const testWaypoint = getDestinationPoint(stormCenter[0], stormCenter[1], detourPushKm, testBearing);

            try {
                // Ask the backend if this specific waypoint is navigable
                const payload = {
                    waypoints: [
                      { lat: shipState.currentLat, lon: shipState.currentLon, name: "Ship", isoCode: "" },
                      { lat: testWaypoint[0], lon: testWaypoint[1], name: "Detour", isoCode: "" },
                      { lat: reconnectPt[0], lon: reconnectPt[1], name: "Reconnect", isoCode: "" }
                    ],
                    departure_time: new Date().toISOString(),
                    ship_profile: { max_speed_knots: 15.0, daily_fuel_consumption_tons: 30.0, draft_meters: 10.0 },
                    weights: { fuel_weight: 0.5, time_weight: 0.5, max_safe_wave_height_meters: 4.0 }
                };
                
                const routeData = await optimizeRoute(payload);
                const directDist = calculateDistanceKm(shipState.currentLat, shipState.currentLon, testWaypoint[0], testWaypoint[1]) + 
                                   calculateDistanceKm(testWaypoint[0], testWaypoint[1], reconnectPt[0], reconnectPt[1]);
                const backendDist = routeData.total_distance_nautical_miles * 1.852;
                
                // MASSIVELY RELAXED (x2.5 multiplier). We only want to reject it if searoute had 
                // to draw a massive line around an entire country to reach the point. 
                if (backendDist <= directDist * 2.5) {
                    
                    // The backend verified this area is water! 
                    // Draw the exact strict geometric triangle you requested so it looks perfect.
                    successfulPath = [
                        [shipState.currentLat, shipState.currentLon], 
                        testWaypoint,                                 
                        reconnectPt,                                  
                        ...futurePath.slice(reconnectIndex + 1)       
                    ];
                    break; // WE FOUND A PATH! Exit the loop immediately.
                }
            } catch (e) {
                console.log(`Angle ${angleOffset} blocked by landmass or grid routing failed.`);
            }
        }

        // If the loop finished and ALL 4 angles failed (e.g., trapped in a canal)
        if (!successfulPath) {
            throw new Error("All detour angles blocked by land");
        }

        setFuturePath(successfulPath);
        setStatus(`✅ Evasive route secured. Proceeding around storm.`);
        setWeatherAlert(false);

    } catch (error) {
        console.error("Detour blocked entirely:", error);
        setIsSimulating(false); 
        setStatus("❌ There is no alternative route through this. Ship has to wait until weather is fine or reroute to nearest port for halt.");
    }
  };

  // --- ANIMATION ---
  useEffect(() => {
    let interval;
    if (isSimulating && futurePath.length > 1 && shipState && !weatherAlert) {
      interval = setInterval(() => {
        const targetPoint = futurePath[1]; 
        const latDiff = targetPoint[0] - shipState.currentLat;
        const lonDiff = targetPoint[1] - shipState.currentLon;
        
        const distToTarget = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
        
        if (distToTarget < 0.02) {
            setFuturePath(futurePath.slice(1));
            return; 
        }

        // Smooth cruising speed
        const moveStep = 0.02; 
        const newLat = shipState.currentLat + (latDiff / distToTarget) * moveStep;
        const newLon = shipState.currentLon + (lonDiff / distToTarget) * moveStep;
        const calculatedHeading = calculateHeading(shipState.currentLat, shipState.currentLon, newLat, newLon);
        
        const newPastPath = [...pastPath, [newLat, newLon]];

        setTrackingData(prev => ({
          ...prev,
          currentLocation: { lat: newLat, lon: newLon, heading: calculatedHeading, speed_knots: shipState.speed },
          futurePath: futurePath,
          pastPath: newPastPath,
          shipDetails: { name: shipState.name, imo: shipState.imo, destination: shipState.destinationPortName, origin: shipState.originPortName }
        }));

        setPastPath(newPastPath);
        setShipState({
          ...shipState,
          currentLat: newLat,
          currentLon: newLon,
          heading: calculatedHeading
        });
      }, 1000); 
    }
    return () => clearInterval(interval);
  }, [isSimulating, futurePath, pastPath, shipState, weatherAlert, setTrackingData]);

  return (
    <div className="bg-white p-6 rounded-lg shadow-md flex flex-col h-full">
      <h3 className="text-xl font-bold mb-4 text-blue-900 border-b pb-2">Live Fleet Telemetry</h3>
      
      <div className="space-y-2 mb-4">
        <label className="block text-sm font-semibold text-gray-600">Ship IMO Number</label>
        <div className="flex gap-2">
          <input 
            type="text" value={imo} onChange={e => setImo(e.target.value)} disabled={isSimulating} 
            className="w-full p-2 border border-gray-300 rounded font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" 
          />
          {!isSimulating ? (
            <button onClick={startTracking} className="px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow transition-colors">
              TRACK
            </button>
          ) : (
            <button onClick={() => { setIsSimulating(false); setStatus('Tracking Paused.'); }} className="px-4 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded shadow transition-colors">
              PAUSE
            </button>
          )}
        </div>
      </div>

      {shipState && isSimulating && (
        <div className={`mb-4 p-4 rounded border text-sm grid grid-cols-2 gap-y-2 gap-x-4 transition-colors ${weatherAlert ? 'bg-red-50 border-red-300' : 'bg-slate-50 border-slate-200'}`}>
          <div className="col-span-2 text-base font-bold text-slate-800 border-b pb-1 mb-1">{shipState.name}</div>
          <div><span className="text-slate-500 font-semibold">IMO:</span> <span className="font-mono">{shipState.imo}</span></div>
          <div><span className="text-slate-500 font-semibold">MMSI:</span> <span className="font-mono">{shipState.mmsi}</span></div>
          <div className="col-span-2"><span className="text-slate-500 font-semibold">Origin:</span> {shipState.originPortName}</div>
          <div className="col-span-2"><span className="text-slate-500 font-semibold">Dest:</span> {shipState.destinationPortName}</div>
          <div><span className="text-slate-500 font-semibold">Speed:</span> {shipState.speed} kts</div>
          <div><span className="text-slate-500 font-semibold">Heading:</span> {Math.round(shipState.heading)}°</div>
          <div className="col-span-2 mt-2 pt-2 border-t border-slate-200 font-mono text-xs text-blue-800 bg-blue-100 p-2 rounded">
            POS: {shipState.currentLat.toFixed(5)} N, {shipState.currentLon.toFixed(5)} E
          </div>
        </div>
      )}

      <div className={`p-3 rounded mb-4 text-xs font-mono min-h-[48px] border flex items-center ${status.includes('❌') ? 'bg-red-100 text-red-800 border-red-400 font-bold' : weatherAlert ? 'bg-red-600 text-white border-red-700 animate-pulse' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
        {status}
      </div>

      {isSimulating && !weatherAlert && (
        <button 
          onClick={injectAdverseWeather} 
          className="mt-auto w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded shadow transition-colors flex justify-center items-center gap-2"
        >
          <span>⛈️</span> Inject Adverse Weather
        </button>
      )}
    </div>
  );
};

export default LiveMonitorPanel;