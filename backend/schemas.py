# Pydantic request/response models go here.
from pydantic import BaseModel


class ProblemCreate(BaseModel):
    title: str
    difficulty: str
    note: str | None = None
    topic_ids: list[int]
    pattern_ids: list[int]

class ProblemUpdate(BaseModel):
    title: str | None = None
    difficulty: str | None = None
    note: str | None = None
    topic_ids: list[int] | None = None
    pattern_ids: list[int] | None = None
