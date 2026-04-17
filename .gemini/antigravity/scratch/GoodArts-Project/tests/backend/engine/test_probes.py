"""Test verification probe system."""
import pytest
from src.backend.engine.probes import select_probes, evaluate_probe, compute_drift_score


@pytest.mark.asyncio
async def test_select_probes_returns_correct_count(db):
    # Seed: 5 artworks with known movements, taste profile with Impressionism high
    for i in range(1, 6):
        await db.execute(
            "INSERT INTO artworks (id, title, movement, image_url) VALUES (?, ?, ?, ?)",
            (i, f"Art{i}", "Impressionism" if i <= 3 else "Cubism", "http://img"),
        )
    await db.execute(
        "INSERT INTO taste_profile (dimension, value, affinity_score, artwork_count) "
        "VALUES ('movement', 'Impressionism', 0.9, 10)"
    )
    await db.execute(
        "INSERT INTO taste_profile (dimension, value, affinity_score, artwork_count) "
        "VALUES ('movement', 'Cubism', 0.2, 5)"
    )
    await db.commit()
    probes = await select_probes(db, count=3, exclude_ids=set())
    assert len(probes) <= 3
    types = [p["probe_type"] for p in probes]
    # Should have confirmation and contradiction probes
    assert "confirmation" in types or "contradiction" in types


@pytest.mark.asyncio
async def test_evaluate_probe_logs_result(db):
    await db.execute("INSERT INTO artworks (id, title) VALUES (1, 'Test')")
    await db.commit()
    await evaluate_probe(db, artwork_id=1, probe_type="confirmation",
                         expected_signal="positive", actual_weight=3)
    async with db.execute("SELECT * FROM probe_log") as cur:
        rows = await cur.fetchall()
    assert len(rows) == 1
    assert dict(rows[0])["agreed"] == 1  # weight 3 is positive, matches expected


@pytest.mark.asyncio
async def test_evaluate_probe_disagreement(db):
    await db.execute("INSERT INTO artworks (id, title) VALUES (1, 'Test')")
    await db.commit()
    await evaluate_probe(db, artwork_id=1, probe_type="confirmation",
                         expected_signal="positive", actual_weight=-1)
    async with db.execute("SELECT * FROM probe_log") as cur:
        row = dict((await cur.fetchall())[0])
    assert row["agreed"] == 0


def test_compute_drift_score_empty():
    assert compute_drift_score([]) == 0.0


def test_compute_drift_score_all_agree():
    probes = [{"agreed": True}, {"agreed": True}, {"agreed": True}]
    assert compute_drift_score(probes) == 0.0


def test_compute_drift_score_all_disagree():
    probes = [{"agreed": False}, {"agreed": False}, {"agreed": False}]
    assert compute_drift_score(probes) == 1.0


def test_compute_drift_score_mixed():
    probes = [{"agreed": True}, {"agreed": False}, {"agreed": True}, {"agreed": False}]
    assert compute_drift_score(probes) == 0.5
