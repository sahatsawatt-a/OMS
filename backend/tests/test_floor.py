"""The floor plan: the admin places tables and landmarks; staff find tables on it."""


def floor(staff):
    state = staff.get("/api/staff/state").json()
    return state["tables"], state["fixtures"]


def as_in(tables, fixtures):
    keep = ("id", "number", "seats", "zone", "x", "y", "w", "h", "shape")
    return {
        "tables": [{k: t[k] for k in keep} for t in tables],
        "fixtures": [{k: f[k] for k in ("zone", "label", "x", "y", "w", "h")} for f in fixtures],
    }


def test_sample_floor_has_placed_tables_and_landmarks(staff):
    tables, fixtures = floor(staff)
    assert all(t["x"] is not None and t["y"] is not None for t in tables)
    assert {t["shape"] for t in tables} == {"square", "round"}
    assert any(f["label"] == "Counter" for f in fixtures)


def test_admin_moves_adds_and_renumbers_tables(staff):
    tables, fixtures = floor(staff)
    body = as_in(tables, fixtures)
    t1 = next(t for t in body["tables"] if t["number"] == 1)
    t1.update(x=10, y=12, shape="square", w=3)
    # Swap the numbers of tables 2 and 3
    t2 = next(t for t in body["tables"] if t["number"] == 2)
    t3 = next(t for t in body["tables"] if t["number"] == 3)
    t2["number"], t3["number"] = 3, 2
    body["tables"].append(
        {
            "number": 9,
            "seats": 2,
            "zone": "Upstairs",
            "x": 0,
            "y": 0,
            "w": 2,
            "h": 2,
            "shape": "round",
        }
    )
    body["fixtures"].append(
        {"zone": "Upstairs", "label": "Stairs", "x": 20, "y": 0, "w": 4, "h": 2}
    )
    res = staff.put("/api/floor", json=body)
    assert res.status_code == 200, res.text

    tables, fixtures = floor(staff)
    by_id = {t["id"]: t for t in tables}
    assert (by_id[t1["id"]]["x"], by_id[t1["id"]]["w"], by_id[t1["id"]]["shape"]) == (
        10,
        3,
        "square",
    )
    assert (by_id[t2["id"]]["number"], by_id[t3["id"]]["number"]) == (3, 2)
    new = next(t for t in tables if t["number"] == 9)
    assert new["zone"] == "Upstairs" and new["id"]
    assert any(f["label"] == "Stairs" for f in fixtures)
    # A new table can be seated straight away
    assert staff.post(f"/api/tables/{new['id']}/sessions", json={"guests": 2}).status_code == 200


def test_tables_with_visits_stay(staff, seated):
    tables, fixtures = floor(staff)
    body = as_in([t for t in tables if t["number"] != 3], fixtures)
    res = staff.put("/api/floor", json=body)
    assert res.status_code == 409 and "Table 3" in res.json()["detail"]
    # One that was never used can go
    body = as_in([t for t in tables if t["number"] != 4], fixtures)
    assert staff.put("/api/floor", json=body).status_code == 200
    assert all(t["number"] != 4 for t in floor(staff)[0])


def test_bad_floor_plans_are_refused(staff):
    tables, fixtures = floor(staff)
    body = as_in(tables, fixtures)
    body["tables"][0]["x"] = 23  # 2 wide from column 23 sticks out of a 24-column plan
    assert staff.put("/api/floor", json=body).status_code == 422
    body = as_in(tables, fixtures)
    body["tables"][1]["number"] = body["tables"][0]["number"]
    assert staff.put("/api/floor", json=body).status_code == 422
    body = as_in(tables, fixtures)
    body["tables"][0]["id"] = "nope"
    assert staff.put("/api/floor", json=body).status_code == 422


def test_floor_plan_needs_the_staff_key(client):
    assert client.put("/api/floor", json={"tables": [], "fixtures": []}).status_code == 401


def test_demo_reset_skips_a_removed_sample_table(staff):
    staff.post("/api/demo/clear")
    tables, fixtures = floor(staff)
    body = as_in([t for t in tables if t["number"] != 7], fixtures)
    assert staff.put("/api/floor", json=body).status_code == 200
    assert staff.post("/api/demo/reset").status_code == 200
