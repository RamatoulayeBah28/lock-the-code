from fastapi import APIRouter, Depends, HTTPException
from psycopg2.extras import RealDictCursor

from auth import get_current_user
from db import get_db

router = APIRouter()


@router.get("/flashcards")
def get_flashcards(user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT is_pro, flashcard_free_use_consumed FROM users WHERE id = %s", (user["id"],))
    row = cur.fetchone()

    if not row["is_pro"]:
        if row["flashcard_free_use_consumed"]:
            raise HTTPException(status_code=402, detail="Free flashcard already consumed")
        else:
            cur.execute("UPDATE users SET flashcard_free_use_consumed = true WHERE id = %s", (user["id"],))
            db.commit()
            cur.execute("SELECT front, back FROM flashcards WHERE author_id IS NULL ORDER BY RANDOM() LIMIT 1")
        card = cur.fetchone()
        if card is None:
            raise HTTPException(status_code=503, detail="No flashcards available yet")
        return card

    # Pro users
    cur.execute("SELECT f.id, pattern, front, back, current_interval_days, easiness_factor, repetitions, next_review_at FROM flashcards f LEFT JOIN flashcard_progress fp ON fp.flashcard_id = f.id AND fp.user_id = %s JOIN patterns p ON f.pattern_id = p.id WHERE (fp.next_review_at IS NULL OR fp.next_review_at <= now()) AND (f.author_id IS NULL OR f.author_id = %s) ORDER BY fp.next_review_at ASC NULLS FIRST", (user["id"], user["id"],))
    cards = cur.fetchall()

    return cards


@router.post("/flashcards/{flashcard_id}/review")
def review_flashcard(flashcard_id: int, payload: dict, user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT is_pro FROM users WHERE id = %s", (user["id"],))
    row = cur.fetchone()
    if not row["is_pro"]:
        raise HTTPException(status_code=402, detail="Pro subscription required")

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
