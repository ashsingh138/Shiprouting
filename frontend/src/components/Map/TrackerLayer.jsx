// src/components/Map/TrackerLayer.jsx
import React from 'react';
import { Polyline, Marker, Popup, Tooltip, Circle } from 'react-leaflet';
import L from 'leaflet';

// 1. Custom SVG Ship Icon
const createShipIcon = (heading = 0) => {
  return L.divIcon({
    className: 'clear-background',
    html: `
      <div style="transform: rotate(${heading}deg); width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
        <svg viewBox="0 0 24 24" fill="#1e3a8a" stroke="#ffffff" stroke-width="1" width="28" height="28" style="filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.5));">
          <path d="M12 2L4 10v9c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-9L12 2z"/>
        </svg>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

// 2. NEW: Clean, professional Start/End Markers
const createLocationIcon = (type) => {
  const bgColor = type === 'start' ? '#10b981' : '#ef4444'; // Green for Origin, Red for Dest
  const label = type === 'start' ? 'A' : 'B';
  
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div style="
        background-color: ${bgColor}; color: white; border-radius: 50%;
        width: 24px; height: 24px; display: flex; justify-content: center;
        align-items: center; font-weight: bold; font-size: 12px;
        border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.4);
      ">
        ${label}
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
};

const TrackerLayer = ({ trackingData }) => {
  if (!trackingData || !trackingData.currentLocation) return null;

  const { pastPath, futurePath, currentLocation, shipDetails, stormArea } = trackingData;

  // Extract the exact first and last coordinates
  const originCoords = pastPath && pastPath.length > 0 ? pastPath[0] : null;
  const destCoords = futurePath && futurePath.length > 0 ? futurePath[futurePath.length - 1] : null;

  return (
    <>
      {/* PAST PATH */}
      {pastPath && pastPath.length > 0 && (
        <Polyline positions={pastPath} color="#6b7280" weight={4} opacity={0.6} />
      )}

      {/* FUTURE PATH */}
      {futurePath && futurePath.length > 0 && (
        <Polyline positions={futurePath} color="#3b82f6" weight={4} dashArray="10, 10" opacity={0.9}>
          <Tooltip sticky>Optimized Future Route</Tooltip>
        </Polyline>
      )}

      {/* NEW: ORIGIN MARKER (A) */}
      {originCoords && (
        <Marker position={originCoords} icon={createLocationIcon('start')}>
          <Tooltip direction="top" offset={[0, -10]} opacity={1}>
            <span className="font-bold text-green-700">Origin: {shipDetails?.origin}</span>
          </Tooltip>
        </Marker>
      )}

      {/* NEW: DESTINATION MARKER (B) */}
      {destCoords && (
        <Marker position={destCoords} icon={createLocationIcon('end')}>
          <Tooltip direction="top" offset={[0, -10]} opacity={1}>
            <span className="font-bold text-red-700">Destination: {shipDetails?.destination}</span>
          </Tooltip>
        </Marker>
      )}

      {/* STORM VISUALIZER */}
      {stormArea && (
        <Circle 
          center={[stormArea.lat, stormArea.lon]} 
          radius={stormArea.radius}
          pathOptions={{ 
            color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.3, weight: 2, dashArray: "5, 5" 
          }}
        >
          <Popup>
            <div className="font-bold text-red-700">⚠️ SEVERE CYCLONE ZONE</div>
          </Popup>
        </Circle>
      )}

      {/* CURRENT SHIP LOCATION */}
      <Marker position={[currentLocation.lat, currentLocation.lon]} icon={createShipIcon(currentLocation.heading)}>
        <Popup className="custom-popup">
          <div className="font-sans">
            <h3 className="font-bold text-lg text-blue-900 border-b pb-1 mb-2">
              {shipDetails?.name || "Unknown Vessel"}
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-700">
              <span className="font-semibold text-gray-500">IMO:</span> 
              <span>{shipDetails?.imo || "N/A"}</span>
              <span className="font-semibold text-gray-500">Speed:</span> 
              <span>{currentLocation.speed_knots} kn</span>
            </div>
          </div>
        </Popup>
        <Tooltip direction="top" offset={[0, -15]} opacity={1}>
          <span className="font-bold">{shipDetails?.name || "Tracked Ship"}</span>
        </Tooltip>
      </Marker>
    </>
  );
};

export default TrackerLayer;