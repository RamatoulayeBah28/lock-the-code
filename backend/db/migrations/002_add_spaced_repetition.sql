-- Cached scheduling state on problems, so "what's due today" doesn't need
-- to recompute from full review history every time.
ALTER TABLE problems ADD COLUMN current_interval_days INT NOT NULL DEFAULT 1;
ALTER TABLE problems ADD COLUMN last_practiced TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE problems ADD COLUMN next_review_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    problem_id INT REFERENCES problems (id) ON DELETE CASCADE,
    confidence INT NOT NULL CONSTRAINT chk_confidence CHECK (confidence IN (1,2,3,4,5)),
    solved_status TEXT,  -- e.g. 'solved_alone' / 'solved_with_hints' / 'not_solved' / 'not_attempted'
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SM-2 scheduling algorithm applied in POST /problems/{problem_id}/review:
--   confidence 1 (forgot)   -> quality 0, reset repetitions and interval to 1 day
--   confidence 2 (weak)     -> quality 2, reset repetitions and interval to 1 day
--   confidence 3 (okay)     -> quality 3, increase repetitions
--   confidence 4 (good)     -> quality 4, increase repetitions
--   confidence 5 (mastered) -> quality 5, increase repetitions
--
-- Successful reviews use intervals of 1 day on the first repetition, 6 days
-- on the second, then round(current_interval_days * easiness_factor). Failed
-- reviews reset repetitions and the interval to 1 day. The easiness factor
-- starts at 2.5, is adjusted by review quality, and never falls below 1.3.
