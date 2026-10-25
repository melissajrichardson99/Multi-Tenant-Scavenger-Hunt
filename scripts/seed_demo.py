# Inserts demo data: two organizations with different themes, their hunts, and characters with QR codes.
"""
Run from the project root after scripts/init_db.py:
    python scripts/seed_demo.py

Creates:
  - Cobb's Adventure Park (slug "cobbs", light theme) with an active hunt.
  - Lantern Grove Fun Park (slug "lantern-grove", dark theme), a fictional
    park with original characters, with one active and one inactive hunt.

Each organization is skipped if its slug already exists, so re-running is
safe. Character images and the Lantern Grove logo are bundled with the
frontend under frontend/public/demo/. No admin accounts are created; use
scripts/create_admin.py for that.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.database import SessionLocal
from app.models import Character, Hunt, Organization
from app.qr_codes import generate_and_upload_qr_image, generate_unique_qr_code

DEMO_IMAGE_BASE = "/demo/characters"

ORGANIZATIONS = [
    {
        "name": "Cobb's Adventure Park",
        "slug": "cobbs",
        "theme_primary": "#f7931e",
        "theme_secondary": "#1a1a1a",
        "theme_mode": "light",
        "logo_url": None,
        "hunts": [
            {
                "name": "Cobb's Summer Hunt 2026",
                "description": "Find all the hidden characters around the park!",
                "is_active": True,
                "characters": [
                    {
                        "name": "Cobb the Kangaroo",
                        "image": "kangaroo.svg",
                        "description": "The park's founder and chief hopper. Cobb has bounced past every ride in the park at least a thousand times.",
                        "hint": "Look for the tallest jump in the park.",
                        "area": "Front Gate",
                        "trivia_question": "How far can a real kangaroo jump in a single bound?",
                        "trivia_option_a": "About 1 metre",
                        "trivia_option_b": "About 3 metres",
                        "trivia_option_c": "Up to 8 metres",
                        "trivia_option_d": "Over 20 metres",
                        "trivia_correct_answer": "c",
                        "trivia_description": "Red kangaroos can cover up to 8 metres in one hop and reach speeds above 50 km/h.",
                    },
                    {
                        "name": "Sleepy the Sloth",
                        "image": "sloth.svg",
                        "description": "Sleepy is never in a rush. Find a shady spot and you might find Sleepy taking a nap.",
                        "hint": "Somewhere slow and shady.",
                        "area": "Picnic Grove",
                    },
                    {
                        "name": "Penny the Peacock",
                        "image": "peacock.svg",
                        "description": "Penny shows off her feathers to anyone who stops by the mini golf course.",
                        "hint": "Hole 9 has the best view.",
                        "area": "Mini Golf",
                    },
                    {
                        "name": "Captain Splash",
                        "image": "duck.svg",
                        "description": "Captain Splash guards the bumper boats and never lets anyone stay dry.",
                        "hint": "You'll probably get wet finding this one.",
                        "area": "Bumper Boats",
                    },
                    {
                        "name": "The Golden Chipmunk",
                        "image": "chipmunk.svg",
                        "description": "You found a secret character! The Golden Chipmunk only pops up for the sharpest explorers.",
                        "is_secret": True,
                    },
                ],
            },
        ],
    },
    {
        "name": "Lantern Grove Fun Park",
        "slug": "lantern-grove",
        "theme_primary": "#2b1055",
        "theme_secondary": "#ffb703",
        "theme_mode": "dark",
        "logo_url": "/demo/lantern-grove-logo.svg",
        "hunts": [
            {
                "name": "Night of a Thousand Lanterns",
                "description": "Follow the lantern light and meet the creatures of the grove.",
                "is_active": True,
                "characters": [
                    {
                        "name": "Ember the Firefly",
                        "image": "beetle.svg",
                        "description": "Ember lights the path for late-night explorers and never runs out of glow.",
                        "hint": "Follow the brightest light near the pond.",
                        "area": "Lantern Pond",
                        "trivia_question": "Fireflies are actually a kind of...",
                        "trivia_option_a": "Beetle",
                        "trivia_option_b": "Fly",
                        "trivia_correct_answer": "a",
                        "trivia_description": "Despite the name, fireflies are beetles. Their glow comes from a chemical reaction called bioluminescence.",
                    },
                    {
                        "name": "Professor Hoot",
                        "image": "owl.svg",
                        "description": "The grove's resident scholar. Professor Hoot knows every star in the sky by name.",
                        "hint": "Look up, near the old observatory.",
                        "area": "Stargazer Hill",
                    },
                    {
                        "name": "Moss the Tortoise",
                        "image": "tortoise.svg",
                        "description": "Moss has lived in the grove longer than anyone and tells the best stories.",
                        "hint": "Slow and steady, by the garden wall.",
                        "area": "Moon Garden",
                    },
                    {
                        "name": "The Night Gardener",
                        "image": "mushroom.svg",
                        "description": "A secret keeper of the grove who only appears after the lanterns are lit.",
                        "is_secret": True,
                    },
                ],
            },
            {
                "name": "Winter Lights 2025",
                "description": "Last season's hunt, kept for reference.",
                "is_active": False,
                "characters": [],
            },
        ],
    },
]


def _create_character(db, hunt, sort_order, spec):
    qr_code_value = generate_unique_qr_code(db)
    generate_and_upload_qr_image(qr_code_value)
    character = Character(
        hunt_id=hunt.id,
        name=spec["name"],
        description=spec.get("description"),
        image_url=f"{DEMO_IMAGE_BASE}/{spec['image']}",
        points=10,
        qr_code_value=qr_code_value,
        sort_order=sort_order,
        hint=spec.get("hint"),
        area=spec.get("area"),
        trivia_question=spec.get("trivia_question"),
        trivia_option_a=spec.get("trivia_option_a"),
        trivia_option_b=spec.get("trivia_option_b"),
        trivia_option_c=spec.get("trivia_option_c"),
        trivia_option_d=spec.get("trivia_option_d"),
        trivia_correct_answer=spec.get("trivia_correct_answer"),
        trivia_description=spec.get("trivia_description"),
        is_secret=spec.get("is_secret", False),
    )
    db.add(character)
    # Flush per character so generate_unique_qr_code sees earlier codes.
    db.flush()
    return character


def seed():
    db = SessionLocal()
    try:
        for org_spec in ORGANIZATIONS:
            existing = db.query(Organization).filter(Organization.slug == org_spec["slug"]).first()
            if existing:
                print(f"[SKIP] Organization '{org_spec['slug']}' already exists — id={existing.id}")
                continue

            org = Organization(
                name=org_spec["name"],
                slug=org_spec["slug"],
                theme_primary=org_spec["theme_primary"],
                theme_secondary=org_spec["theme_secondary"],
                theme_mode=org_spec["theme_mode"],
                logo_url=org_spec["logo_url"],
            )
            db.add(org)
            db.flush()
            print(f"[CREATED] Organization: {org.name} (slug={org.slug}, theme={org.theme_mode})")

            for hunt_spec in org_spec["hunts"]:
                hunt = Hunt(
                    organization_id=org.id,
                    name=hunt_spec["name"],
                    description=hunt_spec["description"],
                    is_active=hunt_spec["is_active"],
                )
                db.add(hunt)
                db.flush()
                status = "active" if hunt.is_active else "inactive"
                print(f"  [CREATED] Hunt: {hunt.name} ({status})")

                for sort_order, character_spec in enumerate(hunt_spec["characters"], start=1):
                    character = _create_character(db, hunt, sort_order, character_spec)
                    secret = " [secret]" if character.is_secret else ""
                    print(f"    [CREATED] {character.name}{secret}  code={character.qr_code_value}")

        db.commit()
        print("\nSeed complete.")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Seed failed: {e}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
