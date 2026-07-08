from clerk_backend_api import AuthenticateRequestOptions, authenticate_request
from clerk_backend_api.security.types import RequestState
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer
from psycopg2.extras import RealDictCursor

from config import Settings, get_settings
from db import get_db

# Purely cosmetic: makes the Swagger "Authorize" button show up in /docs.
# authenticate_request() below reads the Authorization header itself from
# the raw Request, it doesn't actually use this dependency's return value.
http_bearer = HTTPBearer(auto_error=False)


def _verify_clerk_request(
    request: Request,
    settings: Settings = Depends(get_settings),
    _=Depends(http_bearer),
) -> RequestState:
    state = authenticate_request(
        request,
        AuthenticateRequestOptions(
            secret_key=settings.clerk_secret_key,
            jwt_key=settings.clerk_jwt_key,
            authorized_parties=settings.clerk_authorized_parties,
            accepts_token=["session_token"],
        ),
    )
    if not state.is_signed_in:
        raise HTTPException(status_code=401, detail=str(state.reason) if state.reason else "Unauthorized")
    return state


def get_current_user(
    state: RequestState = Depends(_verify_clerk_request),
    db=Depends(get_db),
):
    if state.payload is None:
        raise HTTPException(status_code=401, detail="Unauthorized")
    clerk_user_id = state.payload["sub"]

    clerk_email = state.payload.get("email")
    first_name = state.payload.get("first_name")
    last_name = state.payload.get("last_name")

    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        "INSERT INTO users (id, clerk_email, first_name, last_name) VALUES (%s, %s, %s, %s) "
        "ON CONFLICT (id) DO UPDATE SET "
        "clerk_email = COALESCE(EXCLUDED.clerk_email, users.clerk_email), "
        "first_name  = COALESCE(EXCLUDED.first_name,  users.first_name), "
        "last_name   = COALESCE(EXCLUDED.last_name,   users.last_name)",
        (clerk_user_id, clerk_email, first_name, last_name),
    )
    db.commit()
    cur.execute("SELECT id, clerk_email, first_name, last_name FROM users WHERE id = %s", (clerk_user_id,))
    return cur.fetchone()
