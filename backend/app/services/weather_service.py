# app/services/weather_service.py
import httpx
from datetime import datetime, timedelta
import asyncio

class MarineWeatherService:
    def __init__(self):
        self.base_url = "https://marine-api.open-meteo.com/v1/marine"
        self.cache = {} # NEW: In-memory cache to save API calls!

    async def _get_historical_average(self, lat: float, lon: float, target_time: datetime, years_back=3):
        tasks = []
        
        async with httpx.AsyncClient() as client:
            for y in range(1, years_back + 1):
                past_date = target_time - timedelta(days=365 * y)
                date_str = past_date.strftime("%Y-%m-%d")
                
                params = {
                    "latitude": lat,
                    "longitude": lon,
                    "hourly": "wave_height,wave_direction",
                    "start_date": date_str,
                    "end_date": date_str,
                    "timezone": "UTC"
                }
                tasks.append(client.get(self.base_url, params=params, timeout=10.0))
            
            responses = await asyncio.gather(*tasks, return_exceptions=True)
            
            total_wave = 0.0
            total_dir = 0.0
            valid_responses = 0
            
            target_hour_str = target_time.strftime("T%H:00")

            for response in responses:
                if isinstance(response, Exception) or response.status_code != 200:
                    continue
                
                data = response.json()
                try:
                    times = data["hourly"]["time"]
                    time_index = next(i for i, t in enumerate(times) if target_hour_str in t)
                    
                    wh = data["hourly"]["wave_height"][time_index]
                    wd = data["hourly"]["wave_direction"][time_index]
                    
                    if wh is not None:
                        total_wave += wh
                        total_dir += (wd or 0)
                        valid_responses += 1
                except (ValueError, StopIteration, KeyError):
                    continue

        if valid_responses > 0:
            avg_wave = total_wave / valid_responses
            avg_dir = total_dir / valid_responses
            return {
                "wave_height_m": round(avg_wave, 2),
                "wave_direction_deg": round(avg_dir, 2),
                "wind_speed_knots": round(avg_wave * 5, 2) 
            }
            
        base_wave = 1.0 + (abs(lat) * 0.03) 
        return {
            "wave_height_m": round(base_wave, 2),
            "wave_direction_deg": 90.0,
            "wind_speed_knots": round(base_wave * 5, 2)
        }

    async def get_weather_at_point(self, lat: float, lon: float, target_time: datetime):
        # Strip the timezone so Python can safely do math
        target_time_naive = target_time.replace(tzinfo=None)
        
        # NEW: Check the cache first! 
        # We round to 0 decimals (roughly a 111km grid). 
        # If we already fetched weather for this area today, return it instantly!
        cache_key = (round(lat, 0), round(lon, 0), target_time_naive.strftime("%Y-%m-%d"))
        if cache_key in self.cache:
            return self.cache[cache_key]

        now = datetime.now()
        days_ahead = (target_time_naive - now).days

        # 1. BEYOND FORECAST HORIZON: Fetch Historical Climatology
        if days_ahead > 7 or days_ahead < 0:
            result = await self._get_historical_average(lat, lon, target_time_naive, years_back=3)
            self.cache[cache_key] = result
            return result

        # 2. WITHIN FORECAST HORIZON: Fetch Live Forecast
        date_str = target_time_naive.strftime("%Y-%m-%d")
        params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": "wave_height,wave_direction",
            "start_date": date_str,
            "end_date": date_str,
            "timezone": "UTC"
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(self.base_url, params=params, timeout=10.0)
                response.raise_for_status()
                data = response.json()

                target_hour_str = target_time_naive.strftime("%Y-%m-%dT%H:00")
                times = data["hourly"]["time"]
                
                try:
                    time_index = times.index(target_hour_str)
                    wave_height = data["hourly"]["wave_height"][time_index]
                    wave_dir = data["hourly"]["wave_direction"][time_index]
                    
                    if wave_height is None: wave_height = 0.5
                    if wave_dir is None: wave_dir = 0.0
                        
                except ValueError:
                    wave_height = data["hourly"]["wave_height"][0] or 0.5
                    wave_dir = data["hourly"]["wave_direction"][0] or 0.0

                result = {
                    "wave_height_m": round(wave_height, 2),
                    "wave_direction_deg": round(wave_dir, 2),
                    "wind_speed_knots": round(wave_height * 5, 2)
                }
                
                self.cache[cache_key] = result # Save to cache
                return result

        except Exception as e:
            print(f"Live Weather API Error at {lat},{lon}: {e}")
            result = await self._get_historical_average(lat, lon, target_time_naive, years_back=3)
            self.cache[cache_key] = result # Save to cache
            return result

weather_client = MarineWeatherService()