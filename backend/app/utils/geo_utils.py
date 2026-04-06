# app/utils/geo_utils.py
import math
from datetime import datetime, timedelta

def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculates the true compass bearing (heading) from point A to point B.
    0 = North, 90 = East, 180 = South, 270 = West.
    This is critical for determining if the ship is facing head-seas or following-seas.
    """
    # Convert all latitudes and longitudes from degrees to radians for math functions
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Calculate the difference in longitude
    dlon = lon2 - lon1
    
    # The Haversine-based formula for bearing
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - (math.sin(lat1) * math.cos(lat2) * math.cos(dlon))
    
    initial_bearing = math.atan2(x, y)
    
    # Convert the result back to degrees and normalize it to a 360-degree compass
    initial_bearing = math.degrees(initial_bearing)
    compass_bearing = (initial_bearing + 360) % 360
    
    return compass_bearing

def calculate_eta(current_time: datetime, distance_nm: float, speed_knots: float) -> datetime:
    """
    Calculates the Estimated Time of Arrival at the next waypoint.
    """
    # Prevent division by zero if the ship is completely stopped by storms
    if speed_knots <= 0:
        return current_time + timedelta(days=999) 
        
    # Speed in knots = Nautical Miles per hour
    hours_needed = distance_nm / speed_knots
    
    # Add the hours to the current time to get the exact ETA
    return current_time + timedelta(hours=hours_needed)