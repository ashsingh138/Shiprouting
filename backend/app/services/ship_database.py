# app/services/ship_database.py
import json
import os
from fastapi import HTTPException

def get_ship_info_by_imo(imo: str) -> dict:
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    file_path = os.path.join(base_dir, "data", "ships_db.json")

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            ships = json.load(f)
    except Exception:
        raise HTTPException(status_code=500, detail="Ship database file not found or corrupted.")

    for vessel in ships:
        if str(vessel.get("IMO")) == str(imo):
            draft = float(vessel.get("Draft", 10.0))
            if draft <= 0.0:
                draft = 10.0
                
            return {
                "imo": str(imo),
                "mmsi": str(vessel.get("MMSI")),
                "name": vessel.get("VesselName", "Unknown Vessel"),
                "type": vessel.get("VesselType"),
                "draft_meters": draft,
                "max_speed_knots": 15.0,
                # Grab the Last Known Position for the fallback
                "last_known_lat": vessel.get("LAT"),
                "last_known_lon": vessel.get("LON"),
                "last_known_speed": vessel.get("SOG"),
                "last_known_heading": vessel.get("Heading")
            }

    raise HTTPException(status_code=404, detail=f"Ship with IMO {imo} not found in database.")