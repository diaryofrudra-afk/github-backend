from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DB_PATH: str = "./data/suprwise.db"
    JWT_SECRET: str = "change-me"
    JWT_EXPIRY_DAYS: int = 30
    CORS_ORIGINS: str = "http://localhost:5173"


    # Blackbuck GPS integration
    BLACKBUCK_USERNAME: str = ""
    BLACKBUCK_PASSWORD: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
