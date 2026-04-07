// src/components/Sidebar/VoyageComparison.jsx
import React from 'react';

const VoyageComparison = ({ routeData }) => {
  // Only render if the route calculation has successfully returned the eco/fast variables
  if (!routeData || !routeData.eco_time_hours) return null;

  return (
    <div className="bg-white p-4 rounded-lg shadow-md mt-4 border border-gray-100">
      <h3 className="text-sm font-bold text-gray-800 mb-3 border-b pb-2">Voyage Analytics & Trade-offs</h3>
      
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        {/* ECO MODE (Time Weight: 0) */}
        <div className="bg-green-50 p-2 rounded border border-green-200 flex flex-col justify-center">
          <div className="font-bold text-green-700 mb-1">🌿 Eco Bounds</div>
          <div className="text-gray-600">Fuel: <span className="font-bold">{Math.round(routeData.eco_fuel_tons)}t</span></div>
          <div className="text-gray-600">Time: <span className="font-bold">{Math.round(routeData.eco_time_hours)}h</span></div>
        </div>

        {/* USER SELECTION */}
        <div className="bg-blue-50 p-2 rounded border-2 border-blue-400 shadow-sm transform scale-105 relative z-10">
          <div className="font-bold text-blue-800 mb-1">🎯 Your Route</div>
          <div className="text-gray-700">Fuel: <span className="font-bold">{Math.round(routeData.total_estimated_fuel_tons)}t</span></div>
          <div className="text-gray-700">Time: <span className="font-bold">{Math.round(routeData.total_estimated_time_hours)}h</span></div>
        </div>

        {/* FAST MODE (Time Weight: 1) */}
        <div className="bg-red-50 p-2 rounded border border-red-200 flex flex-col justify-center">
          <div className="font-bold text-red-700 mb-1">⚡ Fast Bounds</div>
          <div className="text-gray-600">Fuel: <span className="font-bold">{Math.round(routeData.fast_fuel_tons)}t</span></div>
          <div className="text-gray-600">Time: <span className="font-bold">{Math.round(routeData.fast_time_hours)}h</span></div>
        </div>
      </div>
    </div>
  );
};

export default VoyageComparison;