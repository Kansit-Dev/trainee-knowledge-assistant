"""
Conversation endpoint tests
---------------------------
POST   /conversations              — create → 200 with id + title
GET    /conversations              — list → array
GET    /conversations/{id}         — get by id → 200
GET    /conversations/{id}         — another user's id → 404
DELETE /conversations/{id}         — 204
DELETE /conversations/{id}         — unknown id → 404
PATCH  /conversations/{id}         — update title → 200
"""
import pytest

from app.core.security import hash_password
from app.main import app
from app.repositories import user_repo



# ---------------------------------------------------------------------------
# Helper: create a second user and return their auth headers
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def other_user_headers(client):
    """Register a second user and return their auth headers."""
    from tests.conftest import TestingSessionLocal  # lazy import avoids circular

    db = TestingSessionLocal()
    try:
        if user_repo.get_by_username(db, "other") is None:
            user_repo.create_user(
                db,
                username="other",
                password_hash=hash_password("other123"),
                display_name="Other",
            )
    finally:
        db.close()

    resp = client.post("/auth/login", json={"username": "other", "password": "other123"})
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}



# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_create_conversation(client, auth_headers):
    resp = client.post("/conversations", json={"title": "Test Conv"}, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"]
    assert body["title"] == "Test Conv"
    assert isinstance(body["messages"], list)


def test_list_conversations(client, auth_headers):
    resp = client.get("/conversations", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_list_conversations_no_auth(client):
    resp = client.get("/conversations")
    assert resp.status_code == 401


def test_get_conversation_by_id(client, auth_headers):
    # Create first
    create = client.post("/conversations", json={"title": "Fetch Me"}, headers=auth_headers)
    assert create.status_code == 200
    conv_id = create.json()["id"]

    resp = client.get(f"/conversations/{conv_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == conv_id


def test_get_conversation_wrong_owner(client, auth_headers, other_user_headers):
    """A conversation owned by admin should 404 for other user."""
    create = client.post(
        "/conversations", json={"title": "Admin Only"}, headers=auth_headers
    )
    assert create.status_code == 200
    conv_id = create.json()["id"]

    resp = client.get(f"/conversations/{conv_id}", headers=other_user_headers)
    assert resp.status_code == 404


def test_get_conversation_not_found(client, auth_headers):
    resp = client.get("/conversations/non-existent-id", headers=auth_headers)
    assert resp.status_code == 404


def test_update_conversation_title(client, auth_headers):
    create = client.post(
        "/conversations", json={"title": "Old Title"}, headers=auth_headers
    )
    conv_id = create.json()["id"]

    patch = client.patch(
        f"/conversations/{conv_id}",
        json={"title": "New Title"},
        headers=auth_headers,
    )
    assert patch.status_code == 200
    assert patch.json()["title"] == "New Title"


def test_delete_conversation(client, auth_headers):
    create = client.post(
        "/conversations", json={"title": "Delete Me"}, headers=auth_headers
    )
    conv_id = create.json()["id"]

    delete = client.delete(f"/conversations/{conv_id}", headers=auth_headers)
    assert delete.status_code == 204

    # Confirm gone
    get = client.get(f"/conversations/{conv_id}", headers=auth_headers)
    assert get.status_code == 404


def test_delete_conversation_not_found(client, auth_headers):
    resp = client.delete("/conversations/non-existent-id", headers=auth_headers)
    assert resp.status_code == 404
