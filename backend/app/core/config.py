from pydantic_settings import BaseSettings
class Settings(BaseSettings):
    PROJECT_NAME:str="Ship Routing Optimizer API"
    VERSION:str="1.0.0"
    API_V1_STR:str="/api/v1"
    BACKEND_CORS_ORIGINS:list[str]=["*"]
    
    WEATHER_API_KEY:str|None=None
    WEATHER_API_BASE_URL:str="https://marine-api.open-meteo.com/v1/marine"
    class Config:
        case_sensitive=True
        env_file=".env"
settings=Settings()