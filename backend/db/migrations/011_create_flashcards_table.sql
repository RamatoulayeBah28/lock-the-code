CREATE TABLE flashcards (
    id SERIAL PRIMARY KEY,
    author_id TEXT REFERENCES users(id),
    front TEXT NOT NULL,
    back TEXT NOT NULL
)