from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.scheduling_constraints import Room, SectionSchedulingRequirement, TeacherAvailability


def list_rooms(db: Session) -> list[Room]:
    return list(db.scalars(select(Room).order_by(Room.room_code)).all())


def create_room(db: Session, values: dict) -> Room:
    room = Room(**values)
    db.add(room)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Room code already exists") from exc
    db.refresh(room)
    return room


def update_room(db: Session, room_id: UUID, values: dict) -> Room:
    room = db.get(Room, room_id)
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    for key, value in values.items():
        setattr(room, key, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Room update conflicts with existing data") from exc
    db.refresh(room)
    return room


def list_teacher_availability(db: Session, term_id: UUID | None = None, teacher_external_id: str | None = None) -> list[TeacherAvailability]:
    stmt = select(TeacherAvailability)
    if term_id:
        stmt = stmt.where(TeacherAvailability.term_id == term_id)
    if teacher_external_id:
        stmt = stmt.where(TeacherAvailability.teacher_external_id == teacher_external_id)
    stmt = stmt.order_by(TeacherAvailability.teacher_external_id, TeacherAvailability.day_of_week, TeacherAvailability.start_period)
    return list(db.scalars(stmt).all())


def create_teacher_availability(db: Session, values: dict) -> TeacherAvailability:
    availability = TeacherAvailability(**values)
    db.add(availability)
    db.commit()
    db.refresh(availability)
    return availability


def update_teacher_availability(db: Session, availability_id: UUID, values: dict) -> TeacherAvailability:
    availability = db.get(TeacherAvailability, availability_id)
    if availability is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher availability not found")
    for key, value in values.items():
        setattr(availability, key, value)
    db.commit()
    db.refresh(availability)
    return availability


def list_section_requirements(db: Session, section_id: UUID | None = None) -> list[SectionSchedulingRequirement]:
    stmt = select(SectionSchedulingRequirement)
    if section_id:
        stmt = stmt.where(SectionSchedulingRequirement.section_id == section_id)
    stmt = stmt.order_by(SectionSchedulingRequirement.section_id)
    return list(db.scalars(stmt).all())


def upsert_section_requirement(db: Session, values: dict) -> SectionSchedulingRequirement:
    requirement = db.scalar(
        select(SectionSchedulingRequirement).where(SectionSchedulingRequirement.section_id == values["section_id"])
    )
    if requirement is None:
        requirement = SectionSchedulingRequirement(**values)
        db.add(requirement)
    else:
        for key, value in values.items():
            setattr(requirement, key, value)
    db.commit()
    db.refresh(requirement)
    return requirement


def update_section_requirement(db: Session, requirement_id: UUID, values: dict) -> SectionSchedulingRequirement:
    requirement = db.get(SectionSchedulingRequirement, requirement_id)
    if requirement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section requirement not found")
    for key, value in values.items():
        setattr(requirement, key, value)
    db.commit()
    db.refresh(requirement)
    return requirement
