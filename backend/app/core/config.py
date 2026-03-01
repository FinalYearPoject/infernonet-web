import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME", "infernonet")
    DB_USER = os.getenv("DB_USER", "infernonet")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "infernonet_secret")

    SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production-use-a-long-random-string")
    JWT_ALGORITHM = "HS256"
    JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))
