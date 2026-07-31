import json
import anthropic
from fastapi import APIRouter, Depends, HTTPException
from psycopg2.extras import RealDictCursor

from auth import get_current_user
from config import get_settings
from db import get_db

router = APIRouter()

@router.post("/decks")
def creat_deck(payload: dict, user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT is_pro FROM users WHERE id = %s", (user["id"],))
    row = cur.fetchone()
    if not row["is_pro"]:
        raise HTTPException(status_code=402, detail="Pro subscription required")
    color = payload.get("color", "#56876D")
    cur.execute("INSERT INTO decks (title, author_id, color) VALUES (%s, %s, %s) RETURNING id", (payload["title"], user["id"], color))
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
    cur.execute("SELECT d.id, d.title, d.color, d.author_id, d.created_at, d.last_studied_at, COUNT(f.id) AS card_count FROM decks d LEFT JOIN flashcards f ON f.deck_id = d.id WHERE d.author_id = %s GROUP BY d.id, d.title, d.color, d.created_at, d.last_studied_at ORDER BY d.created_at DESC", (user["id"],))
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
    title = payload.get("title")
    color = payload.get("color")
    if title:
        cur.execute("UPDATE decks SET title = %s WHERE id = %s AND author_id = %s", (title, deck_id, user["id"]))

    if color:
        cur.execute("UPDATE decks SET color = %s WHERE id = %s AND author_id = %s", (color, deck_id, user["id"]))

    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Deck not found")
    
    db.commit()

    cur.execute("SELECT d.id, d.title, d.author_id, d.created_at, COUNT(f.id) AS card_count FROM decks d LEFT JOIN flashcards f ON f.deck_id = d.id WHERE d.author_id = %s AND d.id = %s GROUP BY d.id, d.title, d.created_at", (user["id"], deck_id))

    return cur.fetchone()

@router.get("/flashcards/{deck_id}")
def get_deck_flashcards(deck_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT id, front, back, pattern_id, deck_id FROM flashcards WHERE deck_id = %s AND author_id = %s", (deck_id, user["id"]))
    return cur.fetchall()

@router.post("/decks/{deck_id}/study")
def mark_deck_studied(deck_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute("UPDATE decks SET last_studied_at = now() WHERE id = %s AND author_id = %s", (deck_id, user["id"]))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Deck not found")
    db.commit()
    return {}

def _flashcard_gen_system() -> str:
    return """You are a flashcard generator for technical study. Your only job is to output a JSON array of flashcard pairs.

SCOPE:
- Allowed: any technical topic including algorithms, data structures, LeetCode patterns, Big-O complexity, programming languages (Python, JavaScript, Java, Go, C++, etc.), web development, databases, SQL, networking, operating systems, system design, OOP, design patterns, DevOps, cloud infrastructure, security, behavioral interview frameworks (STAR method).
- Blocked: cooking, sports, natural languages (French, Spanish, etc.), art, fiction, history, general knowledge, or anything with no connection to technology.
- If the topic is blocked, return exactly: {"error": "out_of_scope", "message": "This topic is not related to technology or technical interviews."} and nothing else.

OUTPUT FORMAT (for allowed topics):
- Return only a raw JSON array. No markdown, no code fences, no explanation before or after.
- Example: [{"front": "What is a hash map?", "back": "A data structure that maps keys to values using a hash function for O(1) average lookup."}]

CARD QUALITY RULES:
- front: a specific question. Mix "What is", "How does", "What is the time complexity of", "Compare X vs Y", "When would you use".
- back: 1 sentence when possible, 2 sentences maximum. Plain, simple language. No em dashes (use a comma or period instead).
- Every card must be accurate and directly useful for studying or interviews.
- No duplicate questions within the same batch.
- If given a list of existing questions to avoid, do not generate questions that are identical or semantically similar to any of them."""


@router.post("/decks/generate")
def generate_flashcards(payload: dict, user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT is_pro FROM users WHERE id = %s", (user["id"],))
    row = cur.fetchone()
    if not row or not row["is_pro"]:
        raise HTTPException(status_code=402, detail="Pro subscription required")

    topic = payload.get("topic", "").strip()
    if not topic:
        raise HTTPException(status_code=400, detail="topic is required")
    if len(topic) > 300:
        raise HTTPException(status_code=400, detail="topic must be 300 characters or fewer")

    count = max(1, min(20, int(payload.get("count", 10))))

    existing_fronts = [str(f).strip() for f in payload.get("existing_fronts", []) if str(f).strip()][:50]

    settings = get_settings()
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=503, detail="AI not configured in this environment")

    user_msg = f"Generate exactly {count} flashcard pairs about: {topic}"
    if existing_fronts:
        user_msg += "\n\nDo NOT generate questions that are identical or semantically similar to these already in the deck:\n"
        user_msg += "\n".join(f"- {f}" for f in existing_fronts)

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    response = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=4096,
        system=_flashcard_gen_system(),
        messages=[{"role": "user", "content": user_msg}],
    )

    raw = response.content[0].text.strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="AI returned an unexpected response. Please try again.")

    if isinstance(data, dict) and data.get("error") == "out_of_scope":
        raise HTTPException(status_code=422, detail=data.get("message", "This topic is not related to technology or technical interviews."))

    if not isinstance(data, list) or len(data) == 0:
        raise HTTPException(status_code=502, detail="AI returned an unexpected response. Please try again.")

    cards = []
    for card in data:
        front = str(card.get("front", "")).strip()[:500]
        back = str(card.get("back", "")).strip()[:1000]
        if front and back:
            cards.append({"front": front, "back": back})

    if not cards:
        raise HTTPException(status_code=502, detail="AI returned an unexpected response. Please try again.")

    return {"cards": cards}


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


@router.post("/decks/{deck_id}/cards/bulk")
def add_cards_to_deck_bulk(deck_id: int, payload: dict, user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT id FROM decks WHERE id = %s AND author_id = %s", (deck_id, user["id"]))
    if cur.fetchone() is None:
        raise HTTPException(status_code=404, detail="Deck not found")

    cards = payload.get("cards", [])
    created = 0
    for card in cards:
        front = str(card.get("front", "")).strip()[:500]
        back = str(card.get("back", "")).strip()[:1000]
        if front and back:
            cur.execute(
                "INSERT INTO flashcards (author_id, pattern_id, front, back, deck_id) VALUES (%s, %s, %s, %s, %s)",
                (user["id"], card.get("pattern_id"), front, back, deck_id),
            )
            created += 1

    db.commit()
    return {"created": created}