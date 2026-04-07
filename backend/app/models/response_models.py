# app/models/response_models.py
from pydantic import BaseModel
from typing import List
from datetime import datetime

class Waypoint(BaseModel):
    lat: float
    lon: float
    eta: datetime 
    expected_wave_height_m: float
    expected_wind_speed_knots: float
    calculated_speed_knots: float

# NEW: Create a model specifically for Crossings
class Crossing(BaseModel):
    name: str
    lat: float
    lon: float

class RouteLeg(BaseModel):
    start_port: str
    end_port: str
    distance_nm: float
    time_hours: float
    fuel_tons: float
    eta: datetime
    # UPGRADE: Change this from List[str] to List[Crossing]
    crossings: List[Crossing]

class RouteOptimizationResponse(BaseModel):
    path: List[Waypoint]
    total_distance_nautical_miles: float
    total_estimated_time_hours: float
    total_estimated_fuel_tons: float
    final_eta: datetime
    # UPGRADE: Change this from List[str] to List[Crossing]
    total_crossings: List[Crossing]
    legs: List[RouteLeg]
    status_message: str
    eco_time_hours: float = 0.0
    eco_fuel_tons: float = 0.0
    fast_time_hours: float = 0.0
    fast_fuel_tons: float = 0.0
# Keep the Port model at the bottom
class Port(BaseModel):
    id:str
    name: str
    isoCode: str
    lat: float
    lon: float