from fastapi import APIRouter, Depends, HTTPException
from psycopg2.extras import RealDictCursor

from auth import get_current_user
from db import get_db

router = APIRouter()

@router.post("/decks")
def creat_deck(payload: dict, user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT is_pro FROM users WHERE id = %s", (user["id"],))
    row = cur.fetchone()
    if not row["is_pro"]:
        raise HTTPException(status_code=402, detail="Pro subscription required")
    cur.execute("INSERT INTO decks (title, author_id) VALUES (%s, %s) RETURNING id", (payload["title"], user["id"],))
    deck_id = cur.fetchone()["id"]
    for card in payload["cards"]:
        cur.execute("INSERT INTO flashcards (author_id, pattern_id, front, back, deck_id) VALUES (%s, %s, %s, %s, %s)", (user["id"], card.get("pattern_id"), card["front"], card["back"], deck_id))
    db.commit()
    return {"created": len(payload["cards"])}

@router.get("/patterns")
def get_patterns(db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT id, pattern FROM patterns")
    return cur.fetchall()  

@router.get("/decks")
def get_decks(user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT d.id, d.title, d.author_id, COUNT(f.id) AS card_count FROM decks d LEFT JOIN flashcards f ON f.deck_id = d.id WHERE d.author_id = %s GROUP BY d.id, d.title", (user["id"],))
    return cur.fetchall()

@router.delete("/decks/{deck_id}")
def delete_deck(deck_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute("DELETE FROM decks WHERE decks.id = %s AND decks.author_id = %s", (deck_id, user["id"],))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Deck not found")
    db.commit() 

@router.patch("/decks/{deck_id}")
def update_deck(deck_id: int, payload: dict, user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute("UPDATE decks SET title = %s WHERE id = %s AND author_id = %s", (payload["title"], deck_id, user["id"]))

    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Deck not found")
    
    db.commit()

    cur.execute("SELECT d.id, d.title, d.author_id, COUNT(f.id) AS card_count FROM decks d LEFT JOIN flashcards f ON f.deck_id = d.id WHERE d.author_id = %s AND d.id = %s GROUP BY d.id, d.title", (user["id"], deck_id))

    return cur.fetchone()

@router.get("/flashcards/{deck_id}")
def get_deck_flashcards(deck_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT id, front, back, pattern_id, deck_id FROM flashcards WHERE deck_id = %s AND author_id = %s", (deck_id, user["id"]))
    return cur.fetchall()

@router.post("/decks/{deck_id}/cards")
def add_card_to_deck(deck_id: int, payload: dict, user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT id FROM decks WHERE id = %s AND author_id = %s", (deck_id, user["id"]))
    if cur.fetchone() is None:
        raise HTTPException(status_code=404, detail="Deck not found")
    cur.execute(
        "INSERT INTO flashcards (author_id, pattern_id, front, back, deck_id) VALUES (%s, %s, %s, %s, %s) RETURNING id, front, back, pattern_id, deck_id",
        (user["id"], payload.get("pattern_id"), payload.get("front", ""), payload.get("back", ""), deck_id)
    )
    new_card = cur.fetchone()
    db.commit()
    return new_card