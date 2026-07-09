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

    for card in payload["cards"]:
        cur.execute("INSERT INTO flashcards (author_id, pattern_id, front, back) VALUES (%s, %s, %s, %s)", (user["id"], card.get("pattern_id"), card["front"], card["back"]))
    db.commit()
    return {"created": len(payload["cards"])}

@router.get("/patterns")
def get_patterns(db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT id, pattern FROM patterns")
    return cur.fetchall()  
