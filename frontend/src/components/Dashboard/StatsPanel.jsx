// src/components/Dashboard/StatsPanel.jsx
import React, { useState } from 'react';
import { formatNumber } from '../../utils/formatters';

const StatsPanel = ({ routeData, loading, error }) => {
  const [openLegIndex, setOpenLegIndex] = useState(null); // Controls the accordion

  if (loading) return <div className="bg-white p-6 rounded-lg shadow-md text-gray-600 animate-pulse mt-4">⏳ Calculating voyage segments...</div>;
  if (error) return <div className="bg-white p-6 rounded-lg shadow-md text-red-600 font-medium mt-4">❌ {error}</div>;
  if (!routeData) return null;

  // Helper to convert decimal hours to Days and Hours (e.g., 33 days 9 hours)
  const formatDuration = (hours) => {
    const d = Math.floor(hours / 24);
    const h = Math.floor(hours % 24);
    if (d > 0) return `${d} days ${h} hours`;
    return `${h} hours`;
  };

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' }).replace(',', '');
  };

  return (
    <div className="bg-white rounded-lg shadow-md mt-4 overflow-hidden border border-gray-200">
      
      {/* GRAND TOTALS SECTION */}
      <div className="p-5 border-b border-gray-200 bg-gray-50">
        <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">Result</h3>
        
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <div className="text-gray-500">Distance</div>
          <div className="font-bold text-gray-800">{formatNumber(routeData.total_distance_nautical_miles, 0)} nm</div>
          
          <div className="text-gray-500">Estimated Fuel</div>
          <div className="font-bold text-gray-800">{formatNumber(routeData.total_estimated_fuel_tons, 0)} tons</div>
          
          <div className="text-gray-500">Duration</div>
          <div className="font-bold text-gray-800">{formatDuration(routeData.total_estimated_time_hours)}</div>
          
          <div className="text-gray-500">Estimated Arrival</div>
          <div className="font-bold text-gray-800">{formatDate(routeData.final_eta)}</div>
          
         {/* REPLACE THIS */}
          <div className="text-gray-500">Crossing</div>
          <div className="font-bold text-gray-800">
            {routeData.total_crossings.length > 0 
              ? routeData.total_crossings.map((c, i) => <div key={i}>{c.name}</div>) // <--- ADD .name HERE
              : "None"}
          </div>
        </div>
      </div>

      {/* ACCORDION LEGS SECTION */}
      <div className="flex flex-col">
        {routeData.legs.map((leg, index) => {
          const isOpen = openLegIndex === index;
          
          return (
            <div key={index} className="border-b border-gray-100 last:border-0">
              
              {/* Accordion Header */}
              <button 
                onClick={() => setOpenLegIndex(isOpen ? null : index)}
                className="w-full px-5 py-3 flex justify-between items-center hover:bg-gray-50 transition-colors focus:outline-none"
              >
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                     <span className="w-2 h-2 bg-blue-600 rounded-full"></span> {leg.start_port}
                  </div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 mt-1">
                     <span className="w-2 h-2 bg-red-500 rounded-full"></span> {leg.end_port}
                  </div>
                </div>
                <div className="text-gray-400 text-xl font-light">
                  {isOpen ? '−' : '+'}
                </div>
              </button>

              {/* Accordion Body */}
              {isOpen && (
                <div className="px-5 pb-4 pt-1 bg-white">
                  <div className="grid grid-cols-2 gap-y-2 text-sm pl-4 border-l-2 border-gray-100 ml-1">
                    <div className="text-gray-500">Distance</div>
                    <div className="font-semibold text-gray-800">{formatNumber(leg.distance_nm, 0)} nm</div>
                    
                    <div className="text-gray-500">Duration</div>
                    <div className="font-semibold text-gray-800">{formatDuration(leg.time_hours)}</div>
                    
                    <div className="text-gray-500">Estimated Arrival</div>
                    <div className="font-semibold text-gray-800">{formatDate(leg.eta)}</div>
                    
                    {/* REPLACE THIS */}
                    <div className="text-gray-500">Crossing</div>
                    <div className="font-semibold text-gray-800">
                      {/* Extract the names first, then join them */}
                      {leg.crossings.length > 0 ? leg.crossings.map(c => c.name).join(', ') : '-'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StatsPanel;