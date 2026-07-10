from fastapi import APIRouter, Depends, HTTPException
from psycopg2.extras import RealDictCursor

from auth import get_current_user
from db import get_db

router = APIRouter()


@router.get("/flashcards")
def get_flashcards(user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT is_pro FROM users WHERE id = %s", (user["id"],))
    row = cur.fetchone()
    is_pro = row["is_pro"]

    # Free users get system cards only; Pro users also get their custom deck cards
    author_filter = "f.author_id IS NULL" if not is_pro else "(f.author_id IS NULL OR f.author_id = %s)"
    params = (user["id"], user["id"]) if is_pro else (user["id"],)

    cur.execute(
        f"SELECT f.id, pattern, front, back FROM flashcards f "
        f"LEFT JOIN flashcard_progress fp ON fp.flashcard_id = f.id AND fp.user_id = %s "
        f"JOIN patterns p ON f.pattern_id = p.id "
        f"WHERE (fp.next_review_at IS NULL OR fp.next_review_at <= now()) "
        f"AND {author_filter} "
        f"ORDER BY fp.next_review_at ASC NULLS FIRST, RANDOM()",
        params,
    )
    return cur.fetchall()


@router.post("/flashcards/{flashcard_id}/review")
def review_flashcard(flashcard_id: int, payload: dict, user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT user_id, flashcard_id, easiness_factor, repetitions, current_interval_days FROM flashcard_progress WHERE user_id = %s AND flashcard_id = %s", (user["id"], flashcard_id))
    row = cur.fetchone()
    if row is None:
        ef, reps, interval = 2.5, 0, 1
    else: 
        ef = row["easiness_factor"]
        reps = row["repetitions"]
        interval = row["current_interval_days"]
    
    correct = payload.get("correct")  

    quality = 4 if correct else 0


    if correct == False:
        new_reps = 0
        new_interval = 1
    else:
        new_reps = reps + 1
        if reps == 0:
            new_interval = 1
        elif reps == 1:
            new_interval = 6
        else:
            new_interval = round(interval * ef)

    new_ef = max(1.3, ef + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))

    cur.execute("INSERT INTO flashcard_progress (user_id, flashcard_id, current_interval_days, easiness_factor, repetitions, next_review_at) VALUES (%s, %s, %s, %s, %s, now() + (%s * INTERVAL '1 day')) ON CONFLICT (user_id, flashcard_id) DO UPDATE SET current_interval_days = EXCLUDED.current_interval_days, easiness_factor = EXCLUDED.easiness_factor, repetitions = EXCLUDED.repetitions, next_review_at = EXCLUDED.next_review_at", (user["id"], flashcard_id, new_interval, new_ef, new_reps, new_interval))
    db.commit()

    return {"new_interval_days": new_interval}


@router.patch("/flashcards/{flashcard_id}")
def update_flashcard(flashcard_id: int, payload: dict, user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        "UPDATE flashcards SET front = %s, back = %s, pattern_id = %s "
        "WHERE id = %s AND author_id = %s",
        (payload["front"], payload["back"], payload.get("pattern_id"), flashcard_id, user["id"])
    )
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    db.commit()
    cur.execute("SELECT id, front, back, pattern_id FROM flashcards WHERE id = %s", (flashcard_id,))
    return cur.fetchone()


@router.delete("/flashcards/{flashcard_id}")
def delete_flashcard(flashcard_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute("DELETE FROM flashcards WHERE id = %s AND author_id = %s", (flashcard_id, user["id"]))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    db.commit()
