NEW_DISH = {
    "categoryId": "stir-fried-noodles",
    "name": "Drunken noodles",
    "description": "Wide noodles, chilli, holy basil.",
    "price": 2400,
    "optionGroups": [
        {"id": "protein-noodles", "name": "Protein", "type": "single", "choices": []},
        {"id": "hot-pot-600"},
    ],
    "dietary": ["vegetarian-option"],
    "allergens": [],
}


def test_add_edit_and_sell_out_a_dish(staff):
    res = staff.put("/api/menu/items/drunken-noodles-ab12", json=NEW_DISH)
    assert res.status_code == 200
    dish = res.json()
    assert [g["id"] for g in dish["optionGroups"]] == ["protein-noodles", "hot-pot-600"]
    assert dish["optionGroups"][0]["choices"][4]["price"] == 400

    staff.put(
        "/api/menu/items/drunken-noodles-ab12",
        json={**NEW_DISH, "price": 2600, "optionGroups": [{"id": "hot-pot-600"}], "soldOut": True},
    )
    menu = staff.get("/api/menu/all").json()
    dish = next(m for m in menu["items"] if m["id"] == "drunken-noodles-ab12")
    assert dish["price"] == 2600 and [g["id"] for g in dish["optionGroups"]] == ["hot-pot-600"]
    assert "drunken-noodles-ab12" in menu["soldOut"]


def test_dish_validation(staff):
    assert (
        staff.put("/api/menu/items/x", json={**NEW_DISH, "categoryId": "nope"}).status_code == 422
    )
    assert (
        staff.put(
            "/api/menu/items/x", json={**NEW_DISH, "optionGroups": [{"id": "nope"}]}
        ).status_code
        == 422
    )
    assert staff.put("/api/menu/items/x", json={**NEW_DISH, "price": 0}).status_code == 422
    assert staff.put("/api/menu/items/x", json={**NEW_DISH, "dietary": ["keto"]}).status_code == 422
    assert staff.put("/api/menu/items/Bad Id", json=NEW_DISH).status_code == 422


def test_ordered_dishes_cannot_be_deleted(staff, seated):
    staff.post(
        f"/api/sessions/{seated}/orders",
        json={"lines": [{"menuItemId": "gai-tod", "quantity": 1}], "pay": "counter"},
    )
    assert staff.delete("/api/menu/items/gai-tod").status_code == 409
    assert staff.delete("/api/menu/items/kuy-chay").status_code == 200


def test_categories(staff):
    new_id = staff.post("/api/menu/categories", json={"name": "Specials"}).json()["id"]
    assert new_id.startswith("specials-")
    staff.patch(f"/api/menu/categories/{new_id}", json={"name": "Chef's specials"})
    staff.post(f"/api/menu/categories/{new_id}/move", json={"delta": -1})
    cats = staff.get("/api/menu/all").json()["categories"]
    assert [c["name"] for c in cats][-2:] == ["Chef's specials", "Drinks"]
    assert staff.delete("/api/menu/categories/drinks").status_code == 409
    assert staff.delete(f"/api/menu/categories/{new_id}").status_code == 200


def test_reset_menu(staff):
    staff.put("/api/menu/items/drunken-noodles-ab12", json=NEW_DISH)
    staff.put("/api/menu/items/pad-thai", json={**NEW_DISH, "name": "Renamed"})
    staff.post("/api/menu/reset")
    menu = staff.get("/api/menu/all").json()
    assert len(menu["items"]) == 93
    assert next(m for m in menu["items"] if m["id"] == "pad-thai")["name"] == "Pad Thai"
    assert menu["soldOut"] == []


def test_thai_name_and_menu_number_are_kept(staff):
    dish = {**NEW_DISH, "nameTh": "ผัดขี้เมา", "number": 99, "dietary": ["gluten-free", "spicy"]}
    saved = staff.put("/api/menu/items/drunken-noodles-ab12", json=dish).json()
    assert (saved["nameTh"], saved["number"], saved["dietary"]) == (
        "ผัดขี้เมา",
        99,
        ["gluten-free", "spicy"],
    )
    menu = staff.get("/api/menu").json()
    assert next(m for m in menu["items"] if m["id"] == "drunken-noodles-ab12")["number"] == 99
