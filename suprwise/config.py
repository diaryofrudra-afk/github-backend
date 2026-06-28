from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DB_PATH: str = "./data/suprwise.db"
    JWT_SECRET: str = "change-me"
    JWT_EXPIRY_DAYS: int = 30
    CORS_ORIGINS: str = "http://localhost:5173"

    # Indian vehicle RC / RTO lookup (no free govt. API — use mock, or set http + your provider URL)
    VEHICLE_LOOKUP_PROVIDER: str = "mock"  # mock | http | parivahan
    VEHICLE_LOOKUP_HTTP_URL: str = ""
    VEHICLE_LOOKUP_HTTP_HEADERS: str = ""

    # Blackbuck GPS integration
    BLACKBUCK_USERNAME: str = ""
    BLACKBUCK_PASSWORD: str = ""

    # Background GPS poller: how often (seconds) to fetch all providers for all
    # users and run engine ON/OFF edge detection -> notifications. Set to 0 to disable.
    GPS_POLL_INTERVAL_SECONDS: int = 45

    # GSTIN Verification API Key
    GST_VERIFICATION_API_KEY: str = "d9100b659eef99b9779a7ff5cf78f3a8"

    class Config:
        env_file = ".env"


settings = Settings()
