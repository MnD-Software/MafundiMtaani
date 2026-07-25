from pydantic_settings import BaseSettings, SettingsConfigDict
import json


class Settings(BaseSettings):
    app_name: str = "Mafundi Mtaani API"
    environment: str = "development"
    database_url: str = "sqlite:///./mafundi.db"
    cors_origins: str = '["http://localhost:3000","http://127.0.0.1:3000"]'
    jwt_secret: str = "development-only-change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 43200
    mpesa_consumer_key: str = ""
    mpesa_consumer_secret: str = ""
    mpesa_shortcode: str = ""
    mpesa_passkey: str = ""
    mpesa_callback_url: str = ""
    mpesa_base_url: str = "https://sandbox.safaricom.co.ke"
    mpesa_callback_secret: str = ""
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
    verification_webhook_secret: str = ""
    erpnext_url: str = ""
    erpnext_api_key: str = ""
    erpnext_api_secret: str = ""
    masked_call_provider_url: str = ""
    masked_call_provider_token: str = ""
    google_client_id: str = ""
    webauthn_rp_id: str = ""
    webauthn_origin: str = ""
    platform_fee_rate: float = 0.10
    tax_rate: float = 0.0
    # Ignore retired bootstrap-only variables that may still exist in a host's
    # environment; production users are always created through the audited CLI.
    model_config = SettingsConfigDict(env_file=".env", env_prefix="MAFUNDI_", extra="ignore")

    def model_post_init(self, __context: object) -> None:
        if self.environment == "production" and self.jwt_secret == "development-only-change-me":
            raise ValueError("MAFUNDI_JWT_SECRET must be configured in production")

    @property
    def cors_origin_list(self) -> list[str]:
        value = self.cors_origins.strip()
        if value.startswith("["):
            try:
                parsed = json.loads(value)
                return [str(item).strip().rstrip("/") for item in parsed if str(item).strip()]
            except (json.JSONDecodeError, TypeError):
                pass
        return [item.strip().rstrip("/") for item in value.split(",") if item.strip()]


settings = Settings()
