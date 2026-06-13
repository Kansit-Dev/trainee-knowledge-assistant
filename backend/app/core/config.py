from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Auth
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # Database
    database_url: str = "sqlite:///./knowledge.db"

    # LLM provider (OpenAI-compatible)
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"

    # CORS
    frontend_origin: str = "http://localhost:3000"

    # Uploads
    max_upload_mb: int = 10
    upload_dir: str = "uploads"


settings = Settings()
