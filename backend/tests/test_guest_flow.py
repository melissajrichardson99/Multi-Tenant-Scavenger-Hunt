"""Core guest flow: start a session, scan characters, answer trivia, complete a hunt."""

import pytest

from conftest import make_character, make_hunt, make_org


@pytest.fixture
def hunt(db):
    org = make_org(db, "cobbs", theme_mode="light")
    hunt = make_hunt(db, org)
    characters = {
        "kangaroo": make_character(
            db, hunt, "Kangaroo", sort_order=1,
            trivia_question="How far can a kangaroo jump?",
            trivia_option_a="1 m", trivia_option_b="8 m",
            trivia_correct_answer="b", trivia_description="Up to 8 metres in one hop.",
        ),
        "sloth": make_character(db, hunt, "Sloth", sort_order=2),
        "secret": make_character(db, hunt, "Secret", sort_order=3, is_secret=True),
    }
    return {"org": org, "hunt": hunt, **characters}


def _start(client, hunt):
    response = client.post("/api/sessions", json={"hunt_id": str(hunt.id)})
    assert response.status_code == 200
    return response.json()["device_token"]


def _scan(client, token, character):
    return client.post("/api/scans", json={"device_token": token, "qr_code_value": character.qr_code_value}).json()


def test_cannot_start_session_on_inactive_hunt(client, db, hunt):
    inactive = make_hunt(db, hunt["org"], is_active=False)
    response = client.post("/api/sessions", json={"hunt_id": str(inactive.id)})
    assert response.status_code == 403


def test_scan_records_find_and_rejects_duplicates_and_bad_codes(client, hunt):
    token = _start(client, hunt["hunt"])

    first = _scan(client, token, hunt["kangaroo"])
    assert first["success"] is True
    assert first["character"]["name"] == "Kangaroo"
    assert first["character"]["has_trivia"] is True
    assert (first["total_found"], first["total_characters"]) == (1, 2)

    assert _scan(client, token, hunt["kangaroo"]) == {"success": False, "reason": "already_scanned"}
    bad = client.post("/api/scans", json={"device_token": token, "qr_code_value": "NOPE-NOPE-NOPE"}).json()
    assert bad == {"success": False, "reason": "invalid_code"}


def test_scan_accepts_code_typed_without_dashes_in_lowercase(client, hunt):
    token = _start(client, hunt["hunt"])
    typed = hunt["sloth"].qr_code_value.replace("-", " ").lower()
    response = client.post("/api/scans", json={"device_token": token, "qr_code_value": typed}).json()
    assert response["success"] is True


def test_secret_characters_never_count_toward_totals(client, hunt):
    token = _start(client, hunt["hunt"])
    _scan(client, token, hunt["secret"])

    session = client.get(f"/api/sessions/{token}").json()
    progress = client.get(f"/api/progress/{token}").json()
    assert (session["total_found"], session["total_characters"]) == (0, 2)
    assert (progress["total_found"], progress["total_characters"]) == (0, 2)
    assert [c["name"] for c in progress["characters"] if c["is_secret"]] == ["Secret"]


def test_trivia_answer_is_hidden_until_guest_answers(client, hunt):
    token = _start(client, hunt["hunt"])
    character_id = str(hunt["kangaroo"].id)

    # Not found yet: indistinguishable from a character without trivia.
    assert client.get(f"/api/characters/{character_id}/trivia", params={"device_token": token}).status_code == 404

    _scan(client, token, hunt["kangaroo"])
    question = client.get(f"/api/characters/{character_id}/trivia", params={"device_token": token})
    assert question.status_code == 200
    assert "trivia_correct_answer" not in question.json()
    assert "trivia_description" not in question.json()
    assert question.json()["trivia_option_b"] == "8 m"

    answer_url = f"/api/characters/{character_id}/trivia/answer"
    wrong = client.post(answer_url, json={"device_token": token, "answer": "a"}).json()
    assert wrong == {"correct": False, "correct_answer": "b", "trivia_description": "Up to 8 metres in one hop."}
    assert client.post(answer_url, json={"device_token": token, "answer": "b"}).json()["correct"] is True
    assert client.post(answer_url, json={"device_token": token, "answer": "c"}).status_code == 400


def test_completing_hunt_and_completion_card_data(client, hunt):
    token = _start(client, hunt["hunt"])
    _scan(client, token, hunt["kangaroo"])
    final = _scan(client, token, hunt["sloth"])
    assert (final["total_found"], final["total_characters"]) == (2, 2)

    # The completion card is built from the progress totals plus the org's
    # public branding (CompletionCard.jsx).
    progress = client.get(f"/api/progress/{token}").json()
    assert progress["total_found"] == progress["total_characters"] == 2
    assert all(c["found"] for c in progress["characters"])

    public_hunt = client.get("/api/hunts/cobbs").json()
    assert public_hunt["organization"] == {
        "name": "Org cobbs",
        "slug": "cobbs",
        "theme_primary": "#123456",
        "theme_secondary": "#abcdef",
        "theme_mode": "light",
        "logo_url": None,
    }
    assert public_hunt["total_characters"] == 2


def test_health_reports_database_type_without_error_details(client):
    body = client.get("/api/health").json()
    assert body == {"status": "ok", "database": "connected", "database_type": body["database_type"]}
    assert body["database_type"] in ("sqlite", "postgresql")


def test_malformed_ids_are_404_not_500(client):
    assert client.get("/api/characters/not-a-uuid", params={"device_token": "x"}).status_code == 404
    assert client.post("/api/sessions", json={"hunt_id": "not-a-uuid"}).status_code == 404
