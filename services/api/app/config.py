from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Mafundi Mtaani API"
    environment: str = "development"
    database_url: str = "sqlite:///./mafundi.db"
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    jwt_secret: str = "development-only-change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60
    mpesa_consumer_key: str = ""
    mpesa_consumer_secret: str = ""
    mpesa_shortcode: str = ""
    mpesa_passkey: str = ""
    mpesa_callback_url: str = ""
    mpesa_base_url: str = "https://sandbox.safaricom.co.ke"
    google_maps_key: str = ""
    whatsapp_token: str = ""
    whatsapp_phone_number_id: str = ""
    sms_api_key: str = ""
    sms_username: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = "info@mafundimtaani.co.ke"
    web_push_public_key: str = ""
    web_push_private_key: str = ""
    platform_fee_rate: float = 0.10
    tax_rate: float = 0.0
    model_config = SettingsConfigDict(env_file=".env", env_prefix="MAFUNDI_")

    def model_post_init(self, __context: object) -> None:
        if self.environment == "production" and self.jwt_secret == "development-only-change-me":
            raise ValueError("MAFUNDI_JWT_SECRET must be configured in production")


settings = Settings()
