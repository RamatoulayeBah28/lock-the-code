CREATE TABLE problems (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    difficulty TEXT CONSTRAINT chk_status CHECK (LOWER(difficulty) IN ('easy', 'medium', 'hard')) NOT NULL,
    note TEXT
);

CREATE TABLE topics (
    id SERIAL PRIMARY KEY,
    topic TEXT UNIQUE NOT NULL
);

CREATE TABLE patterns (
    id SERIAL PRIMARY KEY,
    pattern TEXT UNIQUE NOT NULL
);

CREATE TABLE problem_topics (
    topic_id INT REFERENCES topics (id),
    problem_id INT REFERENCES problems (id) ON DELETE CASCADE,
    PRIMARY KEY (topic_id, problem_id)
);

CREATE TABLE problem_patterns (
    pattern_id INT REFERENCES patterns (id),
    problem_id INT REFERENCES problems (id) ON DELETE CASCADE,
    PRIMARY KEY (pattern_id, problem_id)
);
