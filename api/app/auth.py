"""Authentication and authorization dependencies.

Enforces Bearer token verification matching settings.admin_token using constant-time comparison.
Never logs the token.
"""

import hmac
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from app.config import settings


async def require_admin_token(
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    """Validate Bearer token against settings.admin_token.

    - Missing header -> 401 with WWW-Authenticate: Bearer
    - Invalid scheme or mismatched token -> 401 with WWW-Authenticate: Bearer
    - Constant-time comparison prevents timing attacks.
    - Never logs token bytes or content.
    """
    if authorization is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "UNAUTHORIZED",
                "message": "Missing Authorization header.",
                "details": [],
            },
            headers={"WWW-Authenticate": "Bearer"},
        )

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "UNAUTHORIZED",
                "message": "Invalid Authorization header format. Expected 'Bearer <token>'.",
                "details": [],
            },
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = parts[1]
    expected = settings.admin_token

    # Constant-time comparison
    is_valid = hmac.compare_digest(token.encode("utf-8"), expected.encode("utf-8"))
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "UNAUTHORIZED",
                "message": "Invalid authentication token.",
                "details": [],
            },
            headers={"WWW-Authenticate": "Bearer"},
        )
