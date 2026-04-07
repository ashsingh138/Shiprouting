# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio

from app.core.config import settings
from app.api.routes import router as api_router

# Import our new AISStream listener
from app.services.aisstream_client import listen_to_aisstream

# The lifespan function runs when the server starts and stops
@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP: Fire up the background AIS listener
    ais_task = asyncio.create_task(listen_to_aisstream())
    
    yield # The server handles API requests during this time
    
    # SHUTDOWN: Cleanly close the background task
    ais_task.cancel()

def get_application() -> FastAPI:
    application = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        lifespan=lifespan # <-- Add the lifespan here
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000", 
            "http://localhost:5173", 
            "https://shiprouting.netlify.app"
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(api_router, prefix=settings.API_V1_STR)
    return application

app = get_application()