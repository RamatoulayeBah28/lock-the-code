CREATE TABLE flashcard_progress (
    user_id TEXT REFERENCES users (id) ON DELETE CASCADE,
    flashcard_id  INT REFERENCES flashcards (id) ON DELETE CASCADE,
    current_interval_days INT NOT NULL DEFAULT 1,
    easiness_factor FLOAT NOT NULL DEFAULT 2.5,
    repetitions INT NOT NULL DEFAULT 0,
    next_review_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, flashcard_id)
)
