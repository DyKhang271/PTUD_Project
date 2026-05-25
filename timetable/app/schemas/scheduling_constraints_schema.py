from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class RoomBase(BaseModel):
    room_code: str
    room_name: str | None = None
    capacity: int | None = Field(default=None, ge=0)
    room_type: str = "theory"
    active: bool = True


class RoomCreate(RoomBase):
    pass


class RoomUpdate(BaseModel):
    room_name: str | None = None
    capacity: int | None = Field(default=None, ge=0)
    room_type: str | None = None
    active: bool | None = None


class RoomRead(RoomBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID


class TeacherAvailabilityBase(BaseModel):
    teacher_external_id: str
    term_id: UUID
    day_of_week: int = Field(ge=1, le=7)
    start_period: int = Field(ge=1)
    end_period: int = Field(ge=1)
    availability_type: str = "available"
    note: str | None = None


class TeacherAvailabilityCreate(TeacherAvailabilityBase):
    pass


class TeacherAvailabilityUpdate(BaseModel):
    day_of_week: int | None = Field(default=None, ge=1, le=7)
    start_period: int | None = Field(default=None, ge=1)
    end_period: int | None = Field(default=None, ge=1)
    availability_type: str | None = None
    note: str | None = None


class TeacherAvailabilityRead(TeacherAvailabilityBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID


class SectionSchedulingRequirementBase(BaseModel):
    section_id: UUID
    required_room_type: str | None = None
    expected_students: int | None = Field(default=None, ge=0)
    sessions_per_week: int | None = Field(default=None, ge=0)
    periods_per_session: int | None = Field(default=None, ge=0)
    note: str | None = None


class SectionSchedulingRequirementCreate(SectionSchedulingRequirementBase):
    pass


class SectionSchedulingRequirementUpdate(BaseModel):
    required_room_type: str | None = None
    expected_students: int | None = Field(default=None, ge=0)
    sessions_per_week: int | None = Field(default=None, ge=0)
    periods_per_session: int | None = Field(default=None, ge=0)
    note: str | None = None


class SectionSchedulingRequirementRead(SectionSchedulingRequirementBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
