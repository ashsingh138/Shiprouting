# app/api/routes.py
from fastapi import APIRouter, HTTPException
from datetime import timedelta
import json
import os
from typing import List
import math
import random
import searoute

# Import our Pydantic models
from app.models.request_models import RouteOptimizationRequest
from app.models.response_models import RouteOptimizationResponse, Waypoint, Port, RouteLeg, Crossing

# Import our custom exceptions
from app.core.exceptions import WeatherDataFetchError, RouteCalculationError

# Import our services and utils
from app.services.pathfinding import calculate_optimal_path
from app.services.ship_dynamics import calculate_speed_loss, calculate_fuel_consumption
from app.utils.geo_utils import calculate_bearing, calculate_eta
from geopy.distance import geodesic
from app.services.ship_database import get_ship_info_by_imo
from app.services.aisstream_client import live_ships_store, add_ship_to_tracking

# Import our live weather client
from app.services.weather_service import weather_client

router = APIRouter()

@router.get("/ports", response_model=List[Port])
async def get_supported_ports():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    file_path = os.path.join(base_dir, "data", "global_ports.json")
    with open(file_path, "r", encoding="utf-8") as f:
        ports = json.load(f)
    return ports

# Geo-Fence to detect famous canals and straits
GLOBAL_CHOKEPOINTS = {
    "Suez Canal": (30.58, 32.35),
    "Panama Canal": (9.12, -79.73),
    "Gibraltar Strait": (35.95, -5.55),
    "Malacca Strait": (1.43, 103.26),
    "Dover Strait (English Channel)": (51.05, 1.45),
    "Strait of Hormuz": (26.56, 56.25),
    "Bab-el-Mandeb Strait": (12.58, 43.33),
    "Bosporus Strait": (41.22, 29.11),
    "Dardanelles Strait": (40.21, 26.36),
    "Strait of Magellan": (-53.28, -70.61),
    "Bering Strait": (65.90, -169.00),
    "Sunda Strait": (-5.95, 105.80),
    "Lombok Strait": (-8.50, 115.80),
    "Taiwan Strait": (24.30, 119.50)
}

def detect_crossings(path_nodes, detection_radius_km=100.0):
    """
    Returns a list of Crossing objects containing the name and exact coordinates.
    """
    detected_crossings = {}
    rough_degree_threshold = detection_radius_km / 111.0
    
    for lat, lon in path_nodes:
        for strait_name, (strait_lat, strait_lon) in GLOBAL_CHOKEPOINTS.items():
            if strait_name in detected_crossings:
                continue
                
            if (abs(lat - strait_lat) < rough_degree_threshold and 
                abs(lon - strait_lon) < rough_degree_threshold):
                
                dist_km = geodesic((lat, lon), (strait_lat, strait_lon)).kilometers
                if dist_km <= detection_radius_km:
                    detected_crossings[strait_name] = {
                        "name": strait_name,
                        "lat": strait_lat,
                        "lon": strait_lon
                    }
                    
    return [Crossing(**data) for data in detected_crossings.values()]


@router.post("/optimize-route", response_model=RouteOptimizationResponse)
async def optimize_ship_route(request: RouteOptimizationRequest):
    try:
        optimal_path_nodes = []
        legs_data = []
        
        global_distance = 0.0
        global_time = 0.0
        global_fuel = 0.0
        
        # --- NEW: Accumulators for the extremes ---
        global_time_eco = 0.0
        global_fuel_eco = 0.0
        global_time_fast = 0.0
        global_fuel_fast = 0.0
        
        current_time = request.departure_time
        waypoints_output = []

        for i in range(len(request.waypoints) - 1):
            start_port = request.waypoints[i]
            end_port = request.waypoints[i+1]
            
            try:
                segment_nodes = calculate_optimal_path(
                    start=start_port, end=end_port, 
                    ship=request.ship_profile, weights=request.weights, 
                    weather_data={} 
                )
                
                leg_dist = 0.0
                leg_time = 0.0
                leg_fuel = 0.0
                
                distance_since_last_weather_check = 50.0 
                current_weather = {"wave_height_m": 1.0, "wave_direction_deg": 90.0, "wind_speed_knots": 5.0}
                
                for j in range(1, len(segment_nodes)):
                    prev_lat, prev_lon = segment_nodes[j-1]
                    curr_lat, curr_lon = segment_nodes[j]
                    
                    dist_km = geodesic((prev_lat, prev_lon), (curr_lat, curr_lon)).kilometers
                    dist_nm = dist_km / 1.852
                    heading = calculate_bearing(prev_lat, prev_lon, curr_lat, curr_lon)
                    
                    distance_since_last_weather_check += dist_nm
                    
                    if distance_since_last_weather_check >= 50.0:
                        current_weather = await weather_client.get_weather_at_point(
                            lat=curr_lat, lon=curr_lon, target_time=current_time
                        )
                        distance_since_last_weather_check = 0.0 
                    
                    # ---------------------------------------------------------
                    # THE COMPARISON ENGINE: Calculate all 3 scenarios at once!
                    # ---------------------------------------------------------
                    
                    # 1. User Choice (Based on Slider)
                    time_w = request.weights.time_weight
                    speed_multiplier = 0.6 + (0.4 * time_w)
                    target_calm_speed = request.ship_profile.max_speed_knots * speed_multiplier
                    
                    actual_speed = calculate_speed_loss(target_calm_speed, current_weather["wave_height_m"], current_weather["wave_direction_deg"], heading)
                    fuel = calculate_fuel_consumption(actual_speed, request.ship_profile, dist_nm)
                    
                    # 2. ECO Extreme (Fuel Weight = 1.0 -> 0.6x Speed)
                    actual_speed_eco = calculate_speed_loss(request.ship_profile.max_speed_knots * 0.6, current_weather["wave_height_m"], current_weather["wave_direction_deg"], heading)
                    global_time_eco += dist_nm / actual_speed_eco
                    global_fuel_eco += calculate_fuel_consumption(actual_speed_eco, request.ship_profile, dist_nm)
                    
                    # 3. FAST Extreme (Time Weight = 1.0 -> 1.0x Speed)
                    actual_speed_fast = calculate_speed_loss(request.ship_profile.max_speed_knots * 1.0, current_weather["wave_height_m"], current_weather["wave_direction_deg"], heading)
                    global_time_fast += dist_nm / actual_speed_fast
                    global_fuel_fast += calculate_fuel_consumption(actual_speed_fast, request.ship_profile, dist_nm)
                    
                    # ---------------------------------------------------------
                    
                    leg_dist += dist_nm
                    leg_fuel += fuel
                    time_hrs = dist_nm / actual_speed
                    leg_time += time_hrs
                    current_time = calculate_eta(current_time, dist_nm, actual_speed)
                    
                    waypoints_output.append(Waypoint(
                        lat=curr_lat, lon=curr_lon, eta=current_time,
                        expected_wave_height_m=current_weather["wave_height_m"], 
                        expected_wind_speed_knots=current_weather["wind_speed_knots"],
                        calculated_speed_knots=round(actual_speed, 2)
                    ))
                
                leg_crossings = detect_crossings(segment_nodes)
                legs_data.append(RouteLeg(
                    start_port=start_port.name, end_port=end_port.name,
                    distance_nm=round(leg_dist, 2), time_hours=round(leg_time, 2),
                    fuel_tons=round(leg_fuel, 2), eta=current_time, crossings=leg_crossings
                ))
                
                global_distance += leg_dist
                global_time += leg_time
                global_fuel += leg_fuel
                
                if i > 0 and len(segment_nodes) > 0:
                    segment_nodes = segment_nodes[1:]
                optimal_path_nodes.extend(segment_nodes)
                
            except ValueError as e:
                raise RouteCalculationError(detail=f"Error routing Leg {i+1}: {str(e)}")

        all_crossings = detect_crossings(optimal_path_nodes)

        return RouteOptimizationResponse(
            path=waypoints_output,
            total_distance_nautical_miles=round(global_distance, 2),
            total_estimated_time_hours=round(global_time, 2),
            total_estimated_fuel_tons=round(global_fuel, 2),
            final_eta=current_time,
            total_crossings=all_crossings,
            legs=legs_data,
            status_message="Successfully calculated live weather route.",
            # Add the new bounds to the response
            eco_time_hours=round(global_time_eco, 2),
            eco_fuel_tons=round(global_fuel_eco, 2),
            fast_time_hours=round(global_time_fast, 2),
            fast_fuel_tons=round(global_fuel_fast, 2)
        )

    except Exception as e:
        raise RouteCalculationError(detail=f"An unexpected error occurred: {str(e)}")


@router.get("/track/{imo}")
async def get_live_ship_location(imo: str):
    try:
        ship_info = get_ship_info_by_imo(imo)
    except HTTPException as e:
        raise e

    mmsi = ship_info["mmsi"]
    add_ship_to_tracking(mmsi)

    if mmsi in live_ships_store:
        live_data = live_ships_store[mmsi]
        return {
            **ship_info, 
            **live_data, 
            "status": "Live Tracking Active",
            "is_live": True
        }
    else:
        return {
            **ship_info,
            "status": "Using Last Known Position (Pending Live Signal)",
            "lat": ship_info["last_known_lat"],
            "lon": ship_info["last_known_lon"],
            "speed_knots": ship_info["last_known_speed"],
            "heading": ship_info["last_known_heading"],
            "is_live": False
        }



# Math Helpers
def calculate_bearing(lat1, lon1, lat2, lon2):
    dLon = math.radians(lon2 - lon1)
    y = math.sin(dLon) * math.cos(math.radians(lat2))
    x = math.cos(math.radians(lat1)) * math.sin(math.radians(lat2)) - math.sin(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.cos(dLon)
    brng = math.degrees(math.atan2(y, x))
    return (brng + 360) % 360

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

@router.get("/track/{imo}/live-voyage")
async def get_live_voyage(imo: str):
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # 1. Load Ship Data
    with open(os.path.join(base_dir, "data", "ships_db.json"), "r", encoding="utf-8") as f:
        ships_db = json.load(f)

    ship = next((s for s in ships_db if str(s.get("IMO", "")) == imo or str(s.get("imo", "")) == imo), None)
    if not ship:
        raise HTTPException(status_code=404, detail="Ship not found")

    ship_lat = float(ship.get("LAT", ship.get("last_known_lat", 0)))
    ship_lon = float(ship.get("LON", ship.get("last_known_lon", 0)))
    ship_heading = float(ship.get("Heading", ship.get("last_known_heading", 511)))
    ship_speed = float(ship.get("SOG", ship.get("last_known_speed", 12.0)))
    ship_name = ship.get("VesselName", ship.get("name", "Unknown"))

    if ship_heading == 511 or ship_heading == 0:
        ship_heading = random.randint(0, 359)

    # 2. Load Ports Data
    with open(os.path.join(base_dir, "data", "global_ports.json"), "r", encoding="utf-8") as f:
        all_ports = json.load(f)

    # 3. THE FIX: Smart Routing Validator
    def find_valid_route(ship_lat, ship_lon, target_heading, is_future=True):
        candidates = []
        for port in all_ports:
            if not port.get('lat') or not port.get('lon'): continue
            
            bearing = calculate_bearing(ship_lat, ship_lon, port['lat'], port['lon'])
            diff = abs(bearing - target_heading)
            if diff > 180: diff = 360 - diff
            
            # Narrow the cone so it stays somewhat linear
            if diff <= 45:
                dist = haversine(ship_lat, ship_lon, port['lat'], port['lon'])
                # Limit to regional voyages (200km - 3500km) to avoid crossing the entire globe
                if 200 < dist < 3500:
                    candidates.append((dist, port))
        
        # Sort candidates by distance
        candidates.sort(key=lambda x: x[0])
        
        # Test the top 10 closest ports to find one that doesn't cross land
        for dist, port in candidates[:10]:
            try:
                if is_future:
                    route = searoute.searoute([ship_lon, ship_lat], [port['lon'], port['lat']])
                else:
                    route = searoute.searoute([port['lon'], port['lat']], [ship_lon, ship_lat])
                
                coords = route['geometry']['coordinates']
                path = [[lat, lon] for lon, lat in coords]
                
                # ANTI-TELEPORTATION CHECK: 
                # If the first jump from the ship to the ocean network is massive (>250km), 
                # it means searoute snapped across a continent. Reject this route!
                if len(path) > 2:
                    if is_future:
                        first_jump = haversine(ship_lat, ship_lon, path[1][0], path[1][1])
                    else:
                        first_jump = haversine(path[-2][0], path[-2][1], ship_lat, ship_lon)
                        
                    if first_jump > 250:
                        continue # Skip to the next port!
                
                return port, path
            except Exception:
                continue
        
        # Absolute fallback if trapped
        fallback = candidates[0][1] if candidates else random.choice(all_ports)
        return fallback, [[ship_lat, ship_lon], [fallback['lat'], fallback['lon']]]

    # 4. Generate Validated Routes
    dest_port, future_path = find_valid_route(ship_lat, ship_lon, ship_heading, True)
    origin_port, past_path = find_valid_route(ship_lat, ship_lon, (ship_heading + 180) % 360, False)

    # Guarantee seamless visual connections to the ship
    if past_path: past_path[-1] = [ship_lat, ship_lon]
    if future_path: future_path[0] = [ship_lat, ship_lon]

    return {
        "shipDetails": {
            "name": ship_name,
            "imo": imo,
            "origin": origin_port.get('name', 'Unknown Origin'),
            "destination": dest_port.get('name', 'Unknown Destination')
        },
        "currentLocation": {
            "lat": ship_lat,
            "lon": ship_lon,
            "heading": ship_heading,
            "speed_knots": ship_speed
        },
        "pastPath": past_path,
        "futurePath": future_path
    }