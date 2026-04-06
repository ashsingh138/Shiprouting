# app/core/exceptions.py
from fastapi import HTTPException, status

class WeatherDataFetchError(HTTPException):
    """Raised when the external weather API (Open-Meteo/Copernicus) fails or times out."""
    def __init__(self, detail: str = "Failed to fetch marine weather data."):
        # 503 means "Service Unavailable"
        super().__init__(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)

class RouteCalculationError(HTTPException):
    """Raised when the A* algorithm cannot find a safe path (e.g., surrounded by storms)."""
    def __init__(self, detail: str = "Unable to calculate a safe route with current parameters."):
        # 400 means "Bad Request" (the user's parameters resulted in an impossible route)
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)

class InvalidCoordinateError(HTTPException):
    """Raised if the user provides coordinates that are on land instead of water."""
    def __init__(self, detail: str = "Coordinates provided are not valid marine locations."):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)