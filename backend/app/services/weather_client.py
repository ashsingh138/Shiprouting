# app/services/weather_client.py
import httpx
from fastapi import HTTPException
from app.core.config import settings

async def fetch_marine_weather(lat: float, lon: float, start_date: str, end_date: str):
    """
    Fetches real-time and forecasted wave data from the Open-Meteo Marine API.
    Asynchronous (async/await) is used so the server doesn't freeze while waiting for the data.
    """
    
    # We define the parameters we want from the live API.
    # 'wave_height' is crucial for checking safety.
    # 'ocean_current_velocity' helps calculate speed boosts/drag.
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ["wave_height", "wave_direction", "ocean_current_velocity"],
        "start_date": start_date,
        "end_date": end_date,
        "timezone": "auto"
    }

    # httpx.AsyncClient is the modern Python way to make API requests (faster than requests library)
    async with httpx.AsyncClient() as client:
        try:
            # We send a GET request to the Open-Meteo API URL
            response = await client.get(settings.WEATHER_API_BASE_URL, params=params)
            
            # If the API returns a 404 or 500 error, this raises an exception immediately
            response.raise_for_status()
            
            # Convert the raw JSON response into a Python dictionary
            weather_data = response.json()
            
            return weather_data
            
        except httpx.RequestError as exc:
            # If the connection fails entirely (e.g., no internet, API is down)
            raise HTTPException(
                status_code=503, 
                detail=f"Error connecting to weather service: {str(exc)}"
            )
        except httpx.HTTPStatusError as exc:
            # If the API responds but gives an error code (like 400 Bad Request)
            raise HTTPException(
                status_code=exc.response.status_code,
                detail=f"Weather API returned an error: {exc.response.text}"
            )