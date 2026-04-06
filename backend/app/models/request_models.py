# app/models/request_models.py
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from typing import List, Optional
# -------------------------------------------------------------------------
# Sub-models: We break complex data into smaller pieces for better structure
# -------------------------------------------------------------------------

class Coordinate(BaseModel):
    """Defines a geographical point on the map."""
    # Field(..., ge=-90, le=90) means this field is required (...), 
    # must be greater than or equal to -90, and less than or equal to 90.
    lat: float = Field(..., ge=-90, le=90, description="Latitude of the point")
    lon: float = Field(..., ge=-180, le=180, description="Longitude of the point")
    name: Optional[str] = "Unknown Port",
    isoCode: Optional[str] = None # This is the 2-letter country code, e.g., "us" for USA. Optional for now.
class ShipProfile(BaseModel):
    """Defines the physical characteristics of the ship being routed."""
    # We need this to calculate "Speed Loss" due to waves and wind.
    max_speed_knots: float = Field(..., gt=0, description="Maximum speed in calm water")
    daily_fuel_consumption_tons: float = Field(..., gt=0, description="Fuel burned per day at cruising speed")
    # Optional fields can be left blank by the frontend. 
    # Draft is how deep the ship sits in the water, affecting drag.
    draft_meters: Optional[float] = None 

class OptimizationWeights(BaseModel):
    """
    Defines the commercial priorities for the voyage. 
    As discussed in the webinar, this helps calculate the 'Profit Speed'.
    """
    # Weight from 0.0 to 1.0. 1.0 means "I only care about saving fuel".
    fuel_weight: float = Field(0.5, ge=0.0, le=1.0)
    # Weight from 0.0 to 1.0. 1.0 means "I only care about arriving as fast as possible".
    time_weight: float = Field(0.5, ge=0.0, le=1.0)
    # The maximum wave height the captain considers safe. The algorithm will strictly avoid areas above this.
    max_safe_wave_height_meters: float = Field(4.0, gt=0.0, description="Threshold for storm avoidance")

# -------------------------------------------------------------------------
# Main Request Model: This bundles everything together.
# -------------------------------------------------------------------------

class RouteOptimizationRequest(BaseModel):
    """
    This is the main payload the frontend will POST to the /optimize-route endpoint.
    """
    waypoints: List[Coordinate] = Field(..., min_length=2, description="List of ports to visit in order")
    departure_time: datetime 
    ship_profile: ShipProfile
    weights: OptimizationWeights