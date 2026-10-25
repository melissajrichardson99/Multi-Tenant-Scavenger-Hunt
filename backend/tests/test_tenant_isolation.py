"""
Tenant isolation for the admin API: an organization-scoped admin can only
see and change their own organization's data; a super-admin can manage
every organization; a guest session's device_token never works as admin auth.
"""

import pytest

from app.models import Character
from conftest import auth_header, make_admin, make_character, make_hunt, make_org


@pytest.fixture
def tenants(db):
    org_a, org_b = make_org(db, "park-a"), make_org(db, "park-b")
    hunt_a, hunt_b = make_hunt(db, org_a), make_hunt(db, org_b)
    return {
        "hunt_a": hunt_a,
        "hunt_b": hunt_b,
        "char_a": make_character(db, hunt_a, "Alpha"),
        "char_b": make_character(db, hunt_b, "Bravo"),
        "admin_a": make_admin(db, org_a),
        "super": make_admin(db, None),
    }


def _character_names(db, hunt):
    db.expire_all()
    return sorted(c.name for c in db.query(Character).filter(Character.hunt_id == hunt.id))


def test_admin_lists_only_own_organizations_characters(client, tenants):
    response = client.get("/api/admin/characters", headers=auth_header(tenants["admin_a"]))
    assert response.status_code == 200
    assert [c["name"] for c in response.json()] == ["Alpha"]


def test_admin_cannot_read_other_organizations_hunt_characters(client, tenants):
    response = client.get(
        "/api/admin/characters",
        params={"hunt_id": str(tenants["hunt_b"].id)},
        headers=auth_header(tenants["admin_a"]),
    )
    assert response.status_code == 404
    assert "Bravo" not in response.text


def test_admin_cannot_create_character_in_other_organizations_hunt(client, db, tenants):
    response = client.post(
        "/api/admin/characters",
        json={"hunt_id": str(tenants["hunt_b"].id), "name": "Intruder"},
        headers=auth_header(tenants["admin_a"]),
    )
    assert response.status_code == 404
    assert _character_names(db, tenants["hunt_b"]) == ["Bravo"]


def test_admin_cannot_update_other_organizations_character(client, db, tenants):
    response = client.patch(
        "/api/admin/characters",
        json={"id": str(tenants["char_b"].id), "name": "Hijacked", "points": 999},
        headers=auth_header(tenants["admin_a"]),
    )
    assert response.status_code == 404
    db.expire_all()
    char_b = db.get(Character, tenants["char_b"].id)
    assert (char_b.name, char_b.points) == ("Bravo", 10)


def test_admin_cannot_delete_other_organizations_character(client, db, tenants):
    response = client.delete(
        "/api/admin/characters",
        params={"character_id": str(tenants["char_b"].id)},
        headers=auth_header(tenants["admin_a"]),
    )
    assert response.status_code == 404
    assert _character_names(db, tenants["hunt_b"]) == ["Bravo"]


@pytest.mark.parametrize("path", ["/api/admin/hunts/{hunt_b}/stats", "/api/admin/hunts/{hunt_b}/print-qr-codes"])
def test_admin_cannot_read_other_organizations_hunt(client, tenants, path):
    response = client.get(path.format(hunt_b=tenants["hunt_b"].id), headers=auth_header(tenants["admin_a"]))
    assert response.status_code == 404


def test_admin_can_manage_own_characters(client, db, tenants):
    headers = auth_header(tenants["admin_a"])
    created = client.post("/api/admin/characters", json={"hunt_id": str(tenants["hunt_a"].id), "name": "Charlie"}, headers=headers)
    assert created.status_code == 200
    character_id = created.json()["id"]

    assert client.patch("/api/admin/characters", json={"id": character_id, "name": "Charlie II"}, headers=headers).status_code == 200
    assert client.delete("/api/admin/characters", params={"character_id": character_id}, headers=headers).status_code == 200
    assert _character_names(db, tenants["hunt_a"]) == ["Alpha"]


def test_super_admin_can_manage_every_organizations_characters(client, db, tenants):
    headers = auth_header(tenants["super"])

    listed = client.get("/api/admin/characters", headers=headers)
    assert sorted(c["name"] for c in listed.json()) == ["Alpha", "Bravo"]

    hunt_b_id = str(tenants["hunt_b"].id)
    assert [c["name"] for c in client.get("/api/admin/characters", params={"hunt_id": hunt_b_id}, headers=headers).json()] == ["Bravo"]

    created = client.post("/api/admin/characters", json={"hunt_id": hunt_b_id, "name": "Delta"}, headers=headers)
    assert created.status_code == 200
    assert client.patch("/api/admin/characters", json={"id": str(tenants["char_b"].id), "name": "Bravo II"}, headers=headers).status_code == 200
    assert client.delete("/api/admin/characters", params={"character_id": created.json()["id"]}, headers=headers).status_code == 200
    assert _character_names(db, tenants["hunt_b"]) == ["Bravo II"]


ADMIN_ROUTES = [
    ("get", "/api/admin/characters"),
    ("post", "/api/admin/characters"),
    ("patch", "/api/admin/characters"),
    ("delete", "/api/admin/characters"),
    ("get", "/api/admin/hunts"),
    ("patch", "/api/admin/hunts"),
    ("get", "/api/admin/organizations"),
    ("patch", "/api/admin/organizations"),
    ("get", "/api/admin/admin-users"),
]


@pytest.mark.parametrize("method,path", ADMIN_ROUTES)
def test_guest_session_cannot_call_admin_routes(client, tenants, method, path):
    session = client.post("/api/sessions", json={"hunt_id": str(tenants["hunt_a"].id)}).json()

    for headers in ({}, {"Authorization": f"Bearer {session['device_token']}"}):
        response = client.request(method, path, headers=headers, params={"device_token": session["device_token"]})
        assert response.status_code == 401
