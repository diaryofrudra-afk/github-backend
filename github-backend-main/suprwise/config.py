from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DB_PATH: str = "./data/suprwise.db"
    JWT_SECRET: str = "change-me"
    JWT_EXPIRY_DAYS: int = 30
    CORS_ORIGINS: str = "http://localhost:5173"

    # Email OTP
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@suprwise.com"
    OTP_EXPIRY_MINUTES: int = 10

    # SMS OTP (Fast2SMS)
    FAST2SMS_API_KEY: str = ""
    FAST2SMS_SENDER_ID: str = "FSTSMS"  # Default sender ID for Dev API
    SMS_OTP_LENGTH: int = 6
    SMS_OTP_EXPIRY_MINUTES: int = 10
    SMS_OTP_MAX_ATTEMPTS: int = 3

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""

    # Blackbuck GPS integration — API token based (no Playwright needed)
    # Extract from browser localStorage after logging into blackbuck.com/boss/gps
    BLACKBUCK_AUTH_TOKEN: str = ""
    BLACKBUCK_FLEET_OWNER_ID: str = ""

    # Legacy (deprecated) — kept for backward compatibility
    BLACKBUCK_USERNAME: str = ""
    BLACKBUCK_PASSWORD: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
