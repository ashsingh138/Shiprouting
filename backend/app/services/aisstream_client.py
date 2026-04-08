# app/services/aisstream_client.py
import asyncio
import websockets
import json
from app.core.config import settings

# This dictionary acts as our ultra-fast, in-memory live database.
# When the React frontend asks "Where is ship X?", we instantly read it from here.
live_ships_store = {}

# A global set of MMSIs we want to track. 
tracked_mmsis = set()

async def listen_to_aisstream():
    """
    Background worker that connects to AISStream and listens continuously.
    """
    url = "wss://stream.aisstream.io/v0/stream"
    
    while True: # Auto-reconnect loop in case the connection drops
        if not tracked_mmsis:
            # If no ships are being tracked yet, wait 5 seconds and check again
            await asyncio.sleep(5)
            continue

        # Prepare the subscription message
        subscribe_message = {
            "APIKey": settings.AISSTREAM_API_KEY,  # Make sure this is in your .env
            "BoundingBoxes": [[[-90, -180], [90, 180]]], # The whole world
            "FiltersShipMMSI": list(tracked_mmsis),
            "FilterMessageTypes": ["PositionReport"] # Only get location updates
        }

        try:
            print(f"📡 Connecting to AISStream... Tracking MMSIs: {list(tracked_mmsis)}")
            async with websockets.connect(url) as ws:
                await ws.send(json.dumps(subscribe_message))
                
                # Listen endlessly for new data
                async for message_json in ws:
                    message = json.loads(message_json)
                    
                    if message["MessageType"] == "PositionReport":
                        pos_report = message["Message"]["PositionReport"]
                        mmsi = str(message["MetaData"]["MMSI"])
                        
                        # Save the live metrics
                        live_ships_store[mmsi] = {
                            "lat": pos_report["Latitude"],
                            "lon": pos_report["Longitude"],
                            "speed_knots": pos_report["Sog"], # Speed Over Ground
                            "heading": pos_report["Cog"],     # Course Over Ground
                            "status": "Live Tracking Active"
                        }
                        
                        print(f"🚢 UPDATE [{mmsi}]: Lat {pos_report['Latitude']}, Lon {pos_report['Longitude']}, Speed {pos_report['Sog']} kts")
                        
        except Exception as e:
            print(f"⚠️ AISStream disconnected: {str(e)}. Reconnecting in 5s...")
            await asyncio.sleep(5)

def add_ship_to_tracking(mmsi: str):
    """Utility to add a new ship to the live tracking pool."""
    tracked_mmsis.add(str(mmsi))
    # Note: In a fully production app, you would send a new subscribe message 
    # over the active WebSocket here. For now, it will pick it up on reconnect.