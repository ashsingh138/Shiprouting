// src/components/Map/MapView.jsx
import React from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import RouteLayer from './RouteLayer';
import WeatherLayer from './WeatherLayer';
// 1. IMPORT THE NEW TRACKER LAYER
import TrackerLayer from './TrackerLayer'; 
import ShipLayer from './ShipLayer'; 
import 'leaflet/dist/leaflet.css';

// 2. ADD trackingData TO THE PROPS
const MapView = ({ routeData, requestedWaypoints, shipData, trackingData }) => {
  const center = [10.0, 70.0]; 

  return (
    <MapContainer center={center} zoom={5} className="h-full w-full rounded-md z-0">
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap'
      />
      
      <WeatherLayer routeData={routeData} />
      
      {/* Route Planner Layer */}
      <RouteLayer routeData={routeData} requestedWaypoints={requestedWaypoints} />
      
      {/* 3. LIVE TRACKING LAYER */}
      {trackingData && <TrackerLayer trackingData={trackingData} />}
      
      {/* Note: If TrackerLayer is drawing your ship, you might want to remove ShipLayer so they don't overlap! */}
      {/* <ShipLayer shipData={shipData} /> */}
      
    </MapContainer>
  );
};

export default MapView;