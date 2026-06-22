-- Cached scheduling state on problems, so "what's due today" doesn't need
-- to recompute from full review history every time.
ALTER TABLE problems ADD COLUMN current_interval_days INT NOT NULL DEFAULT 1;
ALTER TABLE problems ADD COLUMN last_practiced TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE problems ADD COLUMN next_review_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- One row per review event (1:N from problems -> reviews, plain FK column,
-- NOT a join table -- contrast with problem_topics/problem_patterns).
CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    problem_id INT REFERENCES problems (id) ON DELETE CASCADE,
    confidence INT NOT NULL CONSTRAINT chk_confidence CHECK (confidence IN (1,2,3,4,5)),
    solved_status TEXT,  -- e.g. 'solved_alone' / 'solved_with_hints' / 'not_solved' / 'not_attempted'
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
