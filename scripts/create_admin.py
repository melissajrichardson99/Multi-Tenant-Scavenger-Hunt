# Creates an admin_users row with a bcrypt-hashed password (never insert a plaintext password into password_hash).
"""
Run from the project root:
    python scripts/create_admin.py --email admin@example.com --org-slug cobbs

Omit --org-slug to create a super-admin (organization_id = NULL, can see all orgs).
The password is prompted for interactively (not echoed, not passed on the
command line). For non-interactive setup (CI, automated demos) it can be
supplied through the ADMIN_PASSWORD environment variable instead.
"""

import argparse
import os
import sys
from getpass import getpass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.database import SessionLocal
from app.models import AdminUser, Organization
from app.auth import hash_password

MIN_PASSWORD_LENGTH = 8


def create_admin(email: str, password: str, org_slug: str | None):
    db = SessionLocal()
    try:
        existing = db.query(AdminUser).filter(AdminUser.email == email).first()
        if existing:
            print(f"[SKIP] Admin user '{email}' already exists — id={existing.id}")
            return

        organization_id = None
        if org_slug:
            org = db.query(Organization).filter(Organization.slug == org_slug).first()
            if not org:
                print(f"[ERROR] No organization found with slug '{org_slug}'", file=sys.stderr)
                sys.exit(1)
            organization_id = org.id

        admin_user = AdminUser(
            email=email,
            password_hash=hash_password(password),
            organization_id=organization_id,
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

        scope = f"organization_id={organization_id}" if organization_id else "super-admin (all orgs)"
        print(f"[CREATED] Admin user: id={admin_user.id}  email={email}  {scope}")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Admin creation failed: {e}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create an admin_users row with a hashed password.")
    parser.add_argument("--email", required=True, help="Admin login email")
    parser.add_argument("--org-slug", default=None, help="Organization slug to scope this admin to (omit for super-admin)")
    args = parser.parse_args()

    password = os.getenv("ADMIN_PASSWORD")
    if not password:
        password = getpass("Password for new admin: ")
        confirm = getpass("Confirm password: ")
        if password != confirm:
            print("[ERROR] Passwords did not match.", file=sys.stderr)
            sys.exit(1)
    if len(password) < MIN_PASSWORD_LENGTH:
        print(f"[ERROR] Password must be at least {MIN_PASSWORD_LENGTH} characters.", file=sys.stderr)
        sys.exit(1)

    create_admin(args.email, password, args.org_slug)
