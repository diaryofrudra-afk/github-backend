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

    class Config:
        env_file = ".env"


settings = Settings()
