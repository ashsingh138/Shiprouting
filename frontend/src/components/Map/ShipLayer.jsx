// src/components/Map/ShipLayer.jsx
import React, { useEffect } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Custom red icon for the live ship
const shipIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const ShipLayer = ({ shipData }) => {
  const map = useMap();

  // Auto-pan to the ship when it is found
  useEffect(() => {
    if (shipData && shipData.lat && shipData.lon) {
      map.flyTo([shipData.lat, shipData.lon], 8, { animate: true });
    }
  }, [shipData, map]);

  if (!shipData || !shipData.lat || !shipData.lon) return null;

  return (
    <Marker position={[shipData.lat, shipData.lon]} icon={shipIcon}>
      <Popup>
        <strong>{shipData.name}</strong><br/>
        Speed: {shipData.speed_knots} kts<br/>
        Status: {shipData.is_live ? "Live Signal" : "Last Known Position"}
      </Popup>
    </Marker>
  );
};

export default ShipLayer;