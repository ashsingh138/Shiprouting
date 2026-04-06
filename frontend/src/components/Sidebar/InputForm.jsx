// src/components/Sidebar/InputForm.jsx
import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { fetchPorts } from '../../services/apiClient';

const InputForm = ({ onSubmit, loading }) => {
  const [ports, setPorts] = useState([]);
  const [waypoints, setWaypoints] = useState([null, null]);
  
  // Helper to get local time formatted for the datetime-local input
  const getLocalDatetimeStr = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16); // format: YYYY-MM-DDThh:mm
  };

  const [formData, setFormData] = useState({
    maxSpeed: 15.0,
    fuelConsumption: 30.0,
    fuelWeight: 0.5,
    timeWeight: 0.5,
    departureTime: getLocalDatetimeStr() // NEW: Track departure time
  });

  useEffect(() => {
    const loadPorts = async () => {
      const portData = await fetchPorts();
      
      const formatted = portData.map(p => {
        return {
          value: p, 
          label: p.name, 
          isoCode: p.isoCode // Passed directly from backend
        };
      });
      setPorts(formatted);
    };
    loadPorts();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: name === 'departureTime' ? value : (parseFloat(value) || 0)
    }));
  };

  const handleWaypointChange = (index, selectedOption) => {
    const newWaypoints = [...waypoints];
    newWaypoints[index] = selectedOption;
    setWaypoints(newWaypoints);
  };

  const addWaypoint = () => {
    setWaypoints([...waypoints, null]);
  };

  const removeWaypoint = (index) => {
    const newWaypoints = waypoints.filter((_, i) => i !== index);
    setWaypoints(newWaypoints);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const validWaypoints = waypoints.filter(wp => wp !== null);
    if (validWaypoints.length < 2) {
      alert("Please select at least a departure and arrival port.");
      return;
    }

    const payload = {
      waypoints: validWaypoints.map(wp => ({ 
        lat: wp.value.lat, 
        lon: wp.value.lon,
        name: wp.value.name || "Unknown Port",
        isoCode: wp.value.isoCode
      })),
      departure_time: new Date(formData.departureTime).toISOString(),
      ship_profile: {
        max_speed_knots: formData.maxSpeed,
        daily_fuel_consumption_tons: formData.fuelConsumption,
        draft_meters: 10.0
      },
      weights: {
        fuel_weight: formData.fuelWeight,
        time_weight: formData.timeWeight,
        max_safe_wave_height_meters: 4.0
      }
    };
    onSubmit(payload);
  };

  // NEW: A custom rendering function for the react-select dropdown to show flags!
  const formatOptionLabel = ({ label, isoCode }) => (
    <div className="flex items-center gap-2">
      {isoCode ? (
        <img
          src={`https://flagcdn.com/w20/${isoCode}.png`}
          width="20"
          alt={isoCode}
          className="shadow-sm border border-gray-200"
        />
      ) : (
        <span className="w-5" /> // Placeholder spacing if no flag is found
      )}
      <span className="truncate">{label}</span>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-bold mb-4 text-gray-800">Route Planner</h3>
      
      <div className="mb-6 space-y-3">
        {waypoints.map((wp, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-500 block mb-1 uppercase tracking-wide">
                {index === 0 ? "Departure Port" : index === waypoints.length - 1 ? "Final Destination" : `Waypoint ${index}`}
              </label>
              <Select 
                options={ports} 
                value={wp}
                onChange={(option) => handleWaypointChange(index, option)} 
                formatOptionLabel={formatOptionLabel} // <-- THIS INJECTS THE FLAGS!
                placeholder="Search port..."
                isClearable
                className="text-sm"
              />
            </div>
            
            {waypoints.length > 2 && (
              <button 
                type="button" 
                onClick={() => removeWaypoint(index)}
                className="mt-5 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                title="Remove Port"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        
        <button 
          type="button" 
          onClick={addWaypoint}
          className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-600 hover:border-blue-500 hover:text-blue-600 font-semibold rounded text-sm transition-colors"
        >
          + Add New Port
        </button>
      </div>

      <h4 className="text-sm font-semibold text-gray-600 mb-2 mt-4 border-t pt-4">Schedule</h4>
      <div className="mb-6">
        <label className="w-full flex flex-col text-sm text-gray-600">
          Departure Time (Local)
          <input 
            name="departureTime" 
            type="datetime-local" 
            value={formData.departureTime} 
            onChange={handleChange} 
            required 
            className="mt-1 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" 
          />
        </label>
      </div>

      <h4 className="text-sm font-semibold text-gray-600 mb-2 mt-4 border-t pt-4">Ship Profile</h4>
      <div className="flex gap-3 mb-6">
        <label className="w-full flex flex-col text-sm text-gray-600">
          Max Speed (Knots)
          <input name="maxSpeed" type="number" step="0.1" value={formData.maxSpeed} onChange={handleChange} required className="mt-1 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </label>
        <label className="w-full flex flex-col text-sm text-gray-600">
          Fuel/Day (Tons)
          <input name="fuelConsumption" type="number" step="0.1" value={formData.fuelConsumption} onChange={handleChange} required className="mt-1 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </label>
      </div>

      <button type="submit" disabled={loading} className="w-full py-3 bg-blue-800 hover:bg-blue-900 text-white font-bold rounded transition-colors disabled:bg-blue-400">
        {loading ? "Calculating Voyage..." : "Calculate Optimal Route"}
      </button>
    </form>
  );
};

export default InputForm;