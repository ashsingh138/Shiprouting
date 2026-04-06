// src/components/Map/RouteLayer.jsx
import React from 'react';
import { Polyline, Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';

// The numbered icons for ports
const createNumberedIcon = (number, isStart, isEnd) => {
  let bgColor = '#1d4ed8'; // Blue
  if (isStart) bgColor = '#10b981'; // Green
  if (isEnd) bgColor = '#ef4444'; // Red

  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div style="
        background-color: ${bgColor}; color: white; border-radius: 50%; 
        width: 28px; height: 28px; display: flex; justify-content: center; 
        align-items: center; font-weight: bold; font-size: 14px;
        border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.4);
      ">
        ${number}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });
};

// NEW: A special yellow diamond icon for Canals and Straits
const crossingIcon = L.divIcon({
  className: 'crossing-icon',
  html: `
    <div style="
      background-color: #f59e0b; 
      width: 14px; height: 14px; 
      transform: rotate(45deg);
      border: 2px solid white; 
      box-shadow: 0 1px 3px rgba(0,0,0,0.5);
    "></div>
  `,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -7]
});

const RouteLayer = ({ routeData, requestedWaypoints }) => {
  if (!routeData || !routeData.path || routeData.path.length === 0) return null;

  const pathCoordinates = routeData.path.map(wp => [wp.lat, wp.lon]);

  return (
    <>
      {/* 1. The Route Line */}
      <Polyline positions={pathCoordinates} color="#1d4ed8" weight={4} opacity={0.8}>
        <Tooltip sticky>
          <div className="font-sans text-sm">
            <strong>Voyage Route</strong><br/>
            Distance: {routeData.total_distance_nautical_miles} NM
          </div>
        </Tooltip>
      </Polyline>

      {/* NEW: 2. Plot the Canals and Straits */}
      {routeData.total_crossings && routeData.total_crossings.map((crossing, index) => (
        <Marker 
          key={`crossing-${index}`} 
          position={[crossing.lat, crossing.lon]} 
          icon={crossingIcon}
        >
          {/* Always show the label when hovering near the strait */}
          <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
             <span className="font-semibold text-yellow-700 font-sans">{crossing.name}</span>
          </Tooltip>
        </Marker>
      ))}

      {/* 3. The Numbered Port Markers */}
      {requestedWaypoints && requestedWaypoints.length > 0 && requestedWaypoints.map((wp, index) => {
        const isStart = index === 0;
        const isEnd = index === requestedWaypoints.length - 1;
        
        let label = `Waypoint ${index + 1}`;
        if (isStart) label = "Departure Port";
        if (isEnd) label = "Arrival Port";

        return (
          <Marker 
            key={`port-${index}`} 
            position={[wp.lat, wp.lon]} 
            icon={createNumberedIcon(index + 1, isStart, isEnd)}
          >
            <Tooltip direction="right" offset={[15, 0]} opacity={1}>
               <span className="font-bold">{wp.name || label}</span>
            </Tooltip>
            <Popup>
              <div className="font-bold text-gray-800 mb-1">{wp.name || label}</div>
              <div className="text-xs text-gray-600">
                Lat: {wp.lat.toFixed(4)} <br/> Lon: {wp.lon.toFixed(4)}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
};

export default RouteLayer;