"""Load the sample Ying Thai 2 menu into the database.

Copied from frontend/src/demo/mockData.ts and dietary.ts, keeping the same ids
so the frontend's photos (/menu/<id>.jpg) and existing links still match.
Prices are AUD cents and include GST.

Run after `alembic upgrade head`:
    docker compose exec backend python -m app.seed_menu

It only inserts when the menu is empty, so running it twice is safe.
"""

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import MenuCategory, MenuItem


def dollars(n: int) -> int:
    return n * 100


SPICE = {
    "id": "spice",
    "name": "Spice level",
    "type": "single",
    "choices": [
        {"id": "none", "name": "Not spicy", "price": 0},
        {"id": "mild", "name": "Mild", "price": 0},
        {"id": "medium", "name": "Medium", "price": 0},
        {"id": "hot", "name": "Thai hot", "price": 0},
    ],
}
PROTEIN = {
    "id": "protein",
    "name": "Protein",
    "type": "single",
    "choices": [
        {"id": "chicken", "name": "Chicken", "price": 0},
        {"id": "pork", "name": "Pork", "price": 0},
        {"id": "tofu", "name": "Tofu", "price": 0},
        {"id": "shrimp", "name": "Shrimp", "price": dollars(5)},
    ],
}
EXTRAS = {
    "id": "extras",
    "name": "Extras",
    "type": "multi",
    "choices": [
        {"id": "egg", "name": "Fried egg", "price": dollars(3)},
        {"id": "rice", "name": "Extra rice", "price": dollars(4)},
    ],
}
SWEETNESS = {
    "id": "sweetness",
    "name": "Sweetness",
    "type": "single",
    "choices": [
        {"id": "normal", "name": "Normal", "price": 0},
        {"id": "less", "name": "Less sweet", "price": 0},
        {"id": "none", "name": "No sugar", "price": 0},
    ],
}

CATEGORIES = [
    ("starters", "Starters"),
    ("noodles", "Noodles"),
    ("rice", "Rice dishes"),
    ("curries", "Curries & soups"),
    ("drinks", "Drinks"),
    ("desserts", "Desserts"),
]

# (id, category, name, description, price, recommended, option groups, dietary, allergens)
ITEMS = [
    ("spring-rolls", "starters", "Crispy spring rolls", "Glass noodles and vegetables, sweet chilli dip.", dollars(12), False, [], ["vegetarian", "vegan", "halal"], []),
    ("satay", "starters", "Chicken satay", "Grilled skewers with peanut sauce and cucumber relish.", dollars(14), True, [], ["halal"], ["peanuts"]),
    ("som-tam", "starters", "Som tam", "Green papaya salad with lime, peanuts and dried shrimp.", dollars(16), False, [SPICE], ["halal"], ["peanuts", "shellfish"]),
    ("pad-thai", "noodles", "Pad Thai", "Rice noodles, tamarind, egg, bean sprouts, crushed peanuts.", dollars(23), True, [PROTEIN, SPICE], ["vegetarian-option"], ["peanuts", "egg"]),
    ("pad-see-ew", "noodles", "Pad see ew", "Wide noodles wok-fried with soy and Chinese broccoli.", dollars(23), False, [PROTEIN], ["vegetarian-option"], ["egg"]),
    ("boat-noodles", "noodles", "Boat noodle soup", "Rich spiced broth with beef and thin rice noodles.", dollars(21), False, [SPICE], [], []),
    ("kra-pao", "rice", "Pad kra pao", "Holy basil stir-fry with chilli and garlic over jasmine rice.", dollars(21), True, [PROTEIN, SPICE, EXTRAS], ["vegetarian-option"], []),
    ("khao-man-gai", "rice", "Khao man gai", "Poached chicken, garlic rice, ginger-soy sauce and broth.", dollars(20), False, [EXTRAS], ["halal"], []),
    ("pineapple-rice", "rice", "Pineapple fried rice", "Served in the pineapple with cashews and raisins.", dollars(25), False, [PROTEIN], ["vegetarian-option"], ["tree-nuts", "egg"]),
    ("green-curry", "curries", "Green curry", "Coconut green curry with Thai eggplant and basil.", dollars(24), False, [PROTEIN, SPICE], ["vegetarian-option"], []),
    ("massaman", "curries", "Massaman beef", "Slow-cooked beef, potato and peanuts in mild curry.", dollars(27), False, [], ["halal"], ["peanuts"]),
    ("tom-yum", "curries", "Tom yum goong", "Hot and sour shrimp soup with lemongrass and galangal.", dollars(25), True, [SPICE], ["halal"], ["shellfish"]),
    ("thai-tea", "drinks", "Thai iced tea", "Strong black tea with condensed milk.", dollars(7), False, [SWEETNESS], ["vegetarian", "halal"], ["dairy"]),
    ("coconut", "drinks", "Fresh coconut", "Chilled young coconut.", dollars(9), False, [], ["vegetarian", "vegan", "halal"], []),
    ("lime-soda", "drinks", "Lime soda", "Fresh lime, soda, a pinch of salt.", dollars(6), False, [SWEETNESS], ["vegetarian", "vegan", "halal"], []),
    ("singha", "drinks", "Singha beer", "330 ml bottle.", dollars(10), False, [], ["vegetarian", "vegan"], []),
    ("mango-sticky-rice", "desserts", "Mango sticky rice", "Ripe mango, sweet coconut sticky rice.", dollars(14), True, [], ["vegetarian", "vegan", "halal"], []),
    ("coconut-ice-cream", "desserts", "Coconut ice cream", "With roasted peanuts and sticky rice.", dollars(11), False, [], ["vegetarian", "halal"], ["dairy", "peanuts"]),
]


def main() -> None:
    with SessionLocal() as db:
        if db.scalar(select(MenuItem).limit(1)) is not None:
            print("Menu already has dishes, nothing to do.")
            return

        for order, (cat_id, name) in enumerate(CATEGORIES):
            db.add(MenuCategory(id=cat_id, name=name, sort_order=order))

        for order, (item_id, cat_id, name, desc, price, rec, groups, dietary, allergens) in enumerate(ITEMS):
            db.add(
                MenuItem(
                    id=item_id,
                    category_id=cat_id,
                    name=name,
                    description=desc,
                    price_cents=price,
                    image=f"/menu/{item_id}.jpg",
                    recommended=rec,
                    option_groups=groups,
                    dietary=dietary,
                    allergens=allergens,
                    sort_order=order,
                )
            )

        db.commit()
        print(f"Added {len(CATEGORIES)} categories and {len(ITEMS)} dishes.")


if __name__ == "__main__":
    main()
