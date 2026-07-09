CREATE TABLE decks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    author_id TEXT NOT NULL REFERENCES users(id)
);

ALTER TABLE flashcards ADD COLUMN deck_id INT NULL REFERENCES decks(id);