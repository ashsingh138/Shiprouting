# app/services/ship_dynamics.py
import math
from app.models.request_models import ShipProfile

def calculate_speed_loss(
    calm_speed: float, 
    wave_height: float, 
    wave_direction_deg: float, 
    ship_heading_deg: float
) -> float:
    """
    Calculates the actual speed of the ship after accounting for wave resistance.
    This is a simplified version of empirical models used in oceanography.
    """
    
    # 1. Determine relative wave angle (0 = Head Seas, 180 = Following Seas)
    # Head seas slow the ship down drastically. Following seas can sometimes speed it up slightly.
    relative_angle = abs(ship_heading_deg - wave_direction_deg)
    if relative_angle > 180:
        relative_angle = 360 - relative_angle
        
    # 2. Safety Check: If waves are too high, the ship speed drops to zero (cannot pass)
    if wave_height > 6.0:  # e.g., 6 meters is extremely dangerous for most cargo ships
        return 0.1 # Return near-zero to heavily penalize this node in the pathfinder
        
    # 3. Calculate speed penalty
    # This is a basic mathematical penalty model. 
    # The penalty is highest when relative angle is near 0 (head seas) 
    # and wave height is large.
    
    # Convert angle to radians for math functions
    angle_rad = math.radians(relative_angle)
    
    # Cosine function: cos(0) = 1 (Max penalty), cos(180) = -1 (Following sea, lower penalty)
    directional_factor = (math.cos(angle_rad) + 1.5) / 2.5 
    
    # Penalty scales exponentially with wave height. 
    # e.g., 2m waves might reduce speed by 10%, 4m waves by 30%.
    speed_penalty = (wave_height ** 1.5) * 0.5 * directional_factor
    
    actual_speed = max(1.0, calm_speed - speed_penalty) # Ensure speed doesn't go below 1 knot unless blocked
    
    return actual_speed

def calculate_fuel_consumption(
    actual_speed: float, 
    profile: ShipProfile, 
    distance_nm: float
) -> float:
    """
    Calculates fuel consumed over a given distance.
    Ship fuel consumption generally follows the cube rule: 
    Fuel ~ Speed^3. If you slow down, you burn much less fuel per hour.
    """
    # Time taken for this segment in hours
    time_hours = distance_nm / actual_speed
    
    # Standard daily consumption is based on 24 hours at max speed.
    # We find the consumption per hour at max speed.
    hourly_consumption_at_max = profile.daily_fuel_consumption_tons / 24.0
    
    # Apply the cube rule: (Current Speed / Max Speed)^3
    speed_ratio = actual_speed / profile.max_speed_knots
    cube_factor = speed_ratio ** 3
    
    # Calculate total fuel for this segment
    fuel_for_segment = (hourly_consumption_at_max * cube_factor) * time_hours
    
    return fuel_for_segment