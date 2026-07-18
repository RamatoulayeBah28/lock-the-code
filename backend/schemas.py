# Pydantic request/response models go here.
from pydantic import BaseModel, Field
from typing import Literal


class ProblemCreate(BaseModel):
    title: str
    difficulty: Literal["easy", "medium", "hard"]
    note: str | None = None
    url: str | None = None
    topic_ids: list[int]
    pattern_ids: list[int]

class ProblemUpdate(BaseModel):
    title: str | None = None
    difficulty: str | None = None
    note: str | None = None
    url: str | None = None
    topic_ids: list[int] | None = None
    pattern_ids: list[int] | None = None

class NotificationSettings(BaseModel):
    enabled: bool
    hour: int = Field(ge=0, le=23)
    timezone: str = "UTC"

class ReviewCreate(BaseModel):
    # confidence: required int, 1-5. Field(ge=..., le=...) gives a clean 422
    # instead of letting an out-of-range value hit the DB's chk_confidence
    # CHECK constraint and surface as a raw Postgres error.
    confidence: int = Field(ge=1, le=5)
    solved_status: str | None = None
