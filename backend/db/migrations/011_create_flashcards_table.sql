CREATE TABLE flashcards (
    id SERIAL PRIMARY KEY,
    author_id TEXT REFERENCES users(id) NULL,
    pattern_id INT REFERENCES patterns(id) NOT NULL,
    front TEXT NOT NULL,
    back TEXT NOT NULL
)