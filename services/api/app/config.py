from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Mafundi Mtaani API"
    environment: str = "development"
    database_url: str = "sqlite:///./mafundi.db"
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    jwt_secret: str = "development-only-change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60
    model_config = SettingsConfigDict(env_file=".env", env_prefix="MAFUNDI_")

    def model_post_init(self, __context: object) -> None:
        if self.environment == "production" and self.jwt_secret == "development-only-change-me":
            raise ValueError("MAFUNDI_JWT_SECRET must be configured in production")


settings = Settings()
