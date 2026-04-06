// src/components/Map/MapView.jsx
import React from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import RouteLayer from './RouteLayer';
import WeatherLayer from './WeatherLayer';
import TrackerLayer from './TrackerLayer'; 
import ShipLayer from './ShipLayer'; 
import 'leaflet/dist/leaflet.css';

const MapView = ({ routeData, requestedWaypoints, shipData, trackingData }) => {
  const center = [20.0, 0.0]; 

  // NEW: Define the extreme corners of the Earth [Latitude, Longitude]
  const worldBounds = [
    [-90, -180], // Southwest corner
    [90, 180]    // Northeast corner
  ];

  return (
    <MapContainer 
      center={center} 
      zoom={3} 
      
      // ---------------------------------------------------------
      // THE FIX: Constrain the Map Viewport
      // ---------------------------------------------------------
      minZoom={2}                  // Prevents zooming out into the grey void
      maxBounds={worldBounds}      // Locks panning to the physical earth
      maxBoundsViscosity={1.0}     // Makes the world edges a solid wall
      
      className="h-full w-full rounded-md z-0"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap'
        noWrap={true} // Prevents the map from repeating horizontally
      />
      
      <WeatherLayer routeData={routeData} />
      <RouteLayer routeData={routeData} requestedWaypoints={requestedWaypoints} />
      {trackingData && <TrackerLayer trackingData={trackingData} />}
      
    </MapContainer>
  );
};

export default MapView;