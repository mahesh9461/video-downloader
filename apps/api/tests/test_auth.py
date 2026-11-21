"""
Unit tests for user authentication and session management.
"""

import pytest
from app.auth import register_user, login_user, get_user_by_token, logout_token


@pytest.mark.anyio
async def test_register_and_login_user():
    email = "testuser@example.com"
    password = "secretpassword123"
    name = "Test User"

    # Register
    reg_res = await register_user(email, password, name)
    assert "user" in reg_res
    assert reg_res["user"].email == email
    assert reg_res["user"].name == name
    token = reg_res["access_token"]
    assert token is not None

    # Resolve by token
    user = await get_user_by_token(token)
    assert user is not None
    assert user.email == email

    # Login
    login_res = await login_user(email, password)
    assert login_res["user"].email == email
    new_token = login_res["access_token"]
    assert new_token is not None

    # Logout
    assert logout_token(new_token) is True
    assert await get_user_by_token(new_token) is None


@pytest.mark.anyio
async def test_invalid_login():
    with pytest.raises(ValueError):
        await login_user("nonexistent_unknown_user_99@example.com", "wrongpass")


@pytest.mark.anyio
async def test_register_user_with_name_and_surname():
    email = "alex.vance@example.com"
    password = "secretpassword123"
    name = "Alex"
    surname = "Vance"

    reg_res = await register_user(email, password, name, surname)
    assert reg_res["user"].email == email
    assert reg_res["user"].name == "Alex Vance"
    assert reg_res["user"].surname == "Vance"
