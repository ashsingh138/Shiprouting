// src/App.jsx
import React, { useState } from 'react';
import MapView from './components/Map/MapView';
import InputForm from './components/Sidebar/InputForm';
import StatsPanel from './components/Dashboard/StatsPanel';
import LiveMonitorPanel from './components/LiveMonitor/LiveMonitorPanel';
import { useRouteFetch } from './hooks/useRouteFetch';

// Leaflet marker fix
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

function App() {
  const [activeTab, setActiveTab] = useState('planner'); // 'planner' or 'tracker'
  
  // NEW STATE: Controls whether the sidebar is visible or collapsed
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); 
  
  const { routeData, requestedWaypoints, loading, error, fetchRoute } = useRouteFetch();
  const [trackedShip, setTrackedShip] = useState(null);

  return (
    <div className="min-h-screen bg-gray-100 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-blue-900 text-white py-4 px-6 shadow-md flex justify-between items-center z-20">
        <h1 className="text-2xl font-bold m-0">🌊 Global Fleet Manager</h1>
        
        {/* Navigation Tabs */}
        <div className="flex bg-blue-800 rounded-lg overflow-hidden border border-blue-700 shadow-inner">
          <button 
            onClick={() => { setActiveTab('planner'); setIsSidebarOpen(true); }}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'planner' ? 'bg-white text-blue-900' : 'text-gray-300 hover:bg-blue-700 hover:text-white'}`}
          >
            Route Planner
          </button>
          <button 
            onClick={() => { setActiveTab('tracker'); setIsSidebarOpen(true); }}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'tracker' ? 'bg-white text-blue-900' : 'text-gray-300 hover:bg-blue-700 hover:text-white'}`}
          >
            Live Monitor
          </button>
        </div>
      </header>
      
      {/* Main Layout Area */}
      <div className="flex flex-1 w-full max-w-[1800px] mx-auto p-4 gap-4 overflow-hidden relative">
        
        {/* LEFT SIDEBAR (Collapsible) */}
        <div 
          className={`transition-all duration-300 ease-in-out flex flex-col h-full overflow-y-auto overflow-x-hidden custom-scrollbar
            ${isSidebarOpen ? 'w-full md:w-[420px] opacity-100 pr-2' : 'w-0 opacity-0 pointer-events-none'}
          `}
        >
          {/* Inner fixed width prevents contents from squishing during the slide animation */}
          <div className="w-[400px] flex flex-col gap-5 pb-10">
            {activeTab === 'planner' ? (
              <>
                <InputForm onSubmit={fetchRoute} loading={loading} />
                <StatsPanel routeData={routeData} loading={loading} error={error} />
              </>
            ) : (
              <LiveMonitorPanel setTrackingData={setTrackedShip} />
            )}
          </div>
        </div>

        {/* RIGHT MAIN AREA (Interactive Map) */}
        <div className="flex-1 relative bg-white rounded-lg shadow-xl border border-gray-300 flex flex-col min-h-[700px] z-10">
          
          {/* COLLAPSE/EXPAND TOGGLE BUTTON */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="absolute top-6 -left-4 md:-left-5 z-[1000] bg-white text-blue-800 border border-gray-300 shadow-md rounded-full w-8 h-8 md:w-10 md:h-10 flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 transition-all focus:outline-none"
            title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <svg 
              className={`w-5 h-5 transition-transform duration-300 ${isSidebarOpen ? '' : 'rotate-180'}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Map View */}
          <div className="flex-1 w-full h-full rounded-lg overflow-hidden">
            <MapView 
              routeData={activeTab === 'planner' ? routeData : null} 
              requestedWaypoints={activeTab === 'planner' ? requestedWaypoints : []} 
              shipData={activeTab === 'tracker' ? trackedShip : null} 
              trackingData={activeTab === 'tracker' ? trackedShip : null}
            />
          </div>

        </div>
        
      </div>
    </div>
  );
}

export default App;