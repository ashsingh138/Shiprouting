# app/api/routes.py
from fastapi import APIRouter, HTTPException
from datetime import timedelta
import json
import os
from typing import List
import math

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
        current_time = request.departure_time
        
        waypoints_output = []

        # LOOP THROUGH EACH WAYPOINT to create "Legs"
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
                
                # NEW: Tracker to prevent spamming the weather API
                distance_since_last_weather_check = 50.0 # Start at 50 so it triggers on the very first node
                current_weather = {"wave_height_m": 1.0, "wave_direction_deg": 90.0, "wind_speed_knots": 5.0}
                
                for j in range(1, len(segment_nodes)):
                    prev_lat, prev_lon = segment_nodes[j-1]
                    curr_lat, curr_lon = segment_nodes[j]
                    
                    dist_km = geodesic((prev_lat, prev_lon), (curr_lat, curr_lon)).kilometers
                    dist_nm = dist_km / 1.852
                    heading = calculate_bearing(prev_lat, prev_lon, curr_lat, curr_lon)
                    
                    # ---------------------------------------------------------
                    # THE SPEED FIX: Only check weather every 50 Nautical Miles
                    # ---------------------------------------------------------
                    distance_since_last_weather_check += dist_nm
                    
                    if distance_since_last_weather_check >= 50.0:
                        current_weather = await weather_client.get_weather_at_point(
                            lat=curr_lat,
                            lon=curr_lon,
                            target_time=current_time
                        )
                        distance_since_last_weather_check = 0.0 # Reset counter
                    
                    # Calculate speed loss using REAL wave heights and directions
                    actual_speed = calculate_speed_loss(
                        calm_speed=request.ship_profile.max_speed_knots, 
                        wave_height=current_weather["wave_height_m"], 
                        wave_direction_deg=current_weather["wave_direction_deg"], 
                        ship_heading_deg=heading
                    )
                    
                    fuel = calculate_fuel_consumption(actual_speed, request.ship_profile, dist_nm)
                    
                    leg_dist += dist_nm
                    leg_fuel += fuel
                    time_hrs = dist_nm / actual_speed
                    leg_time += time_hrs
                    current_time = calculate_eta(current_time, dist_nm, actual_speed)
                    
                    # Attach the real weather to the waypoint so the frontend can see it
                    waypoints_output.append(Waypoint(
                        lat=curr_lat, lon=curr_lon, eta=current_time,
                        expected_wave_height_m=current_weather["wave_height_m"], 
                        expected_wind_speed_knots=current_weather["wind_speed_knots"],
                        calculated_speed_knots=round(actual_speed, 2)
                    ))
                
                leg_crossings = detect_crossings(segment_nodes)
                legs_data.append(RouteLeg(
                    start_port=start_port.name,
                    end_port=end_port.name,
                    distance_nm=round(leg_dist, 2),
                    time_hours=round(leg_time, 2),
                    fuel_tons=round(leg_fuel, 2),
                    eta=current_time,
                    crossings=leg_crossings
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
            status_message="Successfully calculated live weather route."
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