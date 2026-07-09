ALTER TABLE flashcards DROP CONSTRAINT flashcards_deck_id_fkey;
ALTER TABLE flashcards ADD CONSTRAINT flashcards_deck_id_fkey
  FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE;
