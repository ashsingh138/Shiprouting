# app/services/pathfinding.py
import searoute as sr
from app.models.request_models import Coordinate, ShipProfile, OptimizationWeights

def calculate_optimal_path(
    start: Coordinate, 
    end: Coordinate, 
    ship: ShipProfile, 
    weights: OptimizationWeights, 
    weather_data: dict
):
    """
    Uses the official maritime shipping lane graph to calculate the shortest 
    water route, threading through canals and avoiding land automatically.
    """
    
    # searoute strictly expects coordinates in [longitude, latitude] format
    origin = [start.lon, start.lat]
    destination = [end.lon, end.lat]
    
    try:
        # Calculate the route. 
        # include_ports=True helps 'snap' coordinates that are slightly inland 
        # (like terminals) to the nearest valid water node.
        route = sr.searoute(origin, destination, include_ports=True)
        
        if not route or "geometry" not in route or "coordinates" not in route["geometry"]:
            raise ValueError("Could not find a valid shipping route between these coordinates.")
            
        # Extract the list of coordinates from the GeoJSON response
        raw_coordinates = route["geometry"]["coordinates"]
        
        # searoute returns [lon, lat]. We MUST convert it back to (lat, lon) 
        # so our routes.py and React frontend don't draw the map sideways!
        path_nodes = [(lat, lon) for lon, lat in raw_coordinates]
        
        return path_nodes
        
    except Exception as e:
        raise ValueError(f"Routing engine failed: {str(e)}")