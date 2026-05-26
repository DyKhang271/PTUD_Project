from __future__ import annotations

from dataclasses import dataclass
from datetime import time


@dataclass(frozen=True)
class ScheduleShift:
    shift_code: str
    shift_name: str
    start_time: time
    end_time: time
    start_period: int
    end_period: int


STANDARD_SCHEDULE_SHIFTS: tuple[ScheduleShift, ...] = (
    ScheduleShift("CA1", "Ca 1", time(6, 30), time(9, 0), 1, 3),
    ScheduleShift("CA2", "Ca 2", time(9, 10), time(11, 40), 4, 6),
    ScheduleShift("CA3", "Ca 3", time(12, 30), time(15, 0), 7, 9),
    ScheduleShift("CA4", "Ca 4", time(15, 10), time(17, 40), 10, 12),
    ScheduleShift("CA5", "Ca 5", time(18, 0), time(20, 40), 13, 15),
)

SHIFT_BY_CODE = {shift.shift_code: shift for shift in STANDARD_SCHEDULE_SHIFTS}


def get_shift_by_code(shift_code: str | None) -> ScheduleShift | None:
    normalized = str(shift_code or "").strip().upper()
    if not normalized:
        return None
    return SHIFT_BY_CODE.get(normalized)


def get_shift_by_time_range(start_time: time | None, end_time: time | None) -> ScheduleShift | None:
    if start_time is None or end_time is None:
        return None
    for shift in STANDARD_SCHEDULE_SHIFTS:
        if shift.start_time == start_time and shift.end_time == end_time:
            return shift
    return None
