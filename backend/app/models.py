import uuid
from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    ForeignKey,
    DateTime,
    UniqueConstraint,
    text,
    CheckConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    theme_primary = Column(String, default="#000000", server_default="#000000")
    theme_secondary = Column(String, default="#ffffff", server_default="#ffffff")
    logo_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now(), server_default=func.now())

    # Relationships
    hunts = relationship("Hunt", back_populates="organization", cascade="all, delete-orphan")
    admin_users = relationship("AdminUser", back_populates="organization")


class Hunt(Base):
    __tablename__ = "hunts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, server_default="true")
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now(), server_default=func.now())

    # Relationships
    organization = relationship("Organization", back_populates="hunts")
    characters = relationship("Character", back_populates="hunt", cascade="all, delete-orphan")
    sessions = relationship("PlayerSession", back_populates="hunt", cascade="all, delete-orphan")
    reward_tiers = relationship("RewardTier", back_populates="hunt", cascade="all, delete-orphan")


class Character(Base):
    __tablename__ = "characters"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    hunt_id = Column(UUID(as_uuid=True), ForeignKey("hunts.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    points = Column(Integer, default=10, server_default="10")
    qr_code_value = Column(String, unique=True, nullable=False)
    sort_order = Column(Integer, default=0, server_default="0")
    created_at = Column(DateTime(timezone=True), default=func.now(), server_default=func.now())

    # Relationships
    hunt = relationship("Hunt", back_populates="characters")
    scans = relationship("Scan", back_populates="character", cascade="all, delete-orphan")


class PlayerSession(Base):
    __tablename__ = "sessions"  # Table remains sessions as per database schema

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    hunt_id = Column(UUID(as_uuid=True), ForeignKey("hunts.id", ondelete="CASCADE"), nullable=False)
    device_token = Column(String, unique=True, nullable=False)
    display_name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now(), server_default=func.now())
    last_active_at = Column(DateTime(timezone=True), default=func.now(), server_default=func.now(), onupdate=func.now())

    # Relationships
    hunt = relationship("Hunt", back_populates="sessions")
    scans = relationship("Scan", back_populates="session", cascade="all, delete-orphan")


class Scan(Base):
    __tablename__ = "scans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    character_id = Column(UUID(as_uuid=True), ForeignKey("characters.id", ondelete="CASCADE"), nullable=False)
    scanned_at = Column(DateTime(timezone=True), default=func.now(), server_default=func.now())

    # Relationships
    session = relationship("PlayerSession", back_populates="scans")
    character = relationship("Character", back_populates="scans")

    # Constraints
    __table_args__ = (
        UniqueConstraint("session_id", "character_id", name="uq_session_character"),
    )


class RewardTier(Base):
    __tablename__ = "reward_tiers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    hunt_id = Column(UUID(as_uuid=True), ForeignKey("hunts.id", ondelete="CASCADE"), nullable=False)
    threshold_type = Column(String, nullable=False)  # checked via Constraint below
    threshold_value = Column(Integer, nullable=False)
    reward_description = Column(String, nullable=False)
    reward_code = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now(), server_default=func.now())

    # Relationships
    hunt = relationship("Hunt", back_populates="reward_tiers")

    # Constraints
    __table_args__ = (
        CheckConstraint(threshold_type.in_(["count", "percentage"]), name="ck_threshold_type"),
    )


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)  # Null = super admin
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=func.now(), server_default=func.now())

    # Relationships
    organization = relationship("Organization", back_populates="admin_users")
