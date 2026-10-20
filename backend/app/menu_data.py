"""
Ying Thai 2's menu, from their printed menu (yingthai2.com.au/menu), October 2026.

Prices are AUD cents including GST. Where the printed price depends on the protein, size or
portion, the dish costs the lowest price and the dearer choices add the difference, so every
total matches the printed menu. Labels follow the printed marks: GF = gluten free,
P = peanuts, C = cashew nuts, chilli = spicy. Photos are cut from the printed menu.
"""

from dataclasses import dataclass, field

# (id, English name, Thai name)
CATEGORIES = [
    ("appetizers", "Appetizers", "เมนูทานเล่น"),
    ("soup", "Soup", "เมนูต้ม"),
    ("salad", "Salad", "สลัดไทย รสจัด"),
    ("stir-fried-noodles", "Stir-fried noodles", "เมนูผัด"),
    ("soup-noodles", "Soup noodles", "ก๋วยเตี๋ยว"),
    ("curry", "Curry", "เมนูแกง"),
    ("stir-fried", "Stir-fried temptation", "เมนูผัด"),
    ("specials", "Special additional", "เมนูพิเศษ"),
    ("rice", "Rice", "เมนูข้าว"),
    ("desserts", "Desserts", "ของหวาน"),
    ("drinks", "Drinks", "เครื่องดื่ม"),
]


def _c(*names: str, extra: int = 0) -> list[tuple[str, str, int]]:
    """Choices at one price step: (id, name, extra cents)."""
    return [(n.lower().replace(" & ", "-").replace(" ", "-"), n, extra) for n in names]


# (id, name, type, [(choice id, name, extra price in cents)])
OPTION_GROUPS = [
    ("satay-meat", "Meat", "single", _c("Chicken", "Beef")),
    ("por-pia-filling", "Filling", "single", _c("Pork", "Vegetable")),
    ("protein-pbc", "Protein", "single", _c("Pork", "Beef", "Chicken")),
    ("protein-spf", "Protein", "single", _c("Seafood", "Prawn", "Fish")),
    ("hot-pot-600", "Size", "single", _c("Bowl") + _c("Hot pot", extra=600)),
    ("hot-pot-700", "Size", "single", _c("Bowl") + _c("Hot pot", extra=700)),
    ("som-tum-style", "Style", "single", _c("Thai style", "Salted crab", "Mixed")),
    ("num-tok-meat", "Meat", "single", _c("Beef", "Pork")),
    (
        "protein-noodles",
        "Protein",
        "single",
        _c("Chicken", "Pork", "Beef", "Vegetable") + _c("Prawns", "Seafood", extra=400),
    ),
    (
        "protein-curry",
        "Protein",
        "single",
        _c("Chicken", "Pork", "Beef", "Vegetable")
        + _c("Prawns", "Seafood", "Duck", "Fish", extra=200),
    ),
    (
        "protein-minced",
        "Protein",
        "single",
        _c("Minced chicken", "Minced pork", "Minced beef", "Vegetable")
        + _c("Prawns", "Seafood", "Duck", "Crispy pork", extra=500),
    ),
    (
        "protein-stir-fry",
        "Protein",
        "single",
        _c("Chicken", "Pork", "Beef", "Vegetable") + _c("Prawns", "Seafood", extra=500),
    ),
    (
        "protein-ka-nar",
        "Protein",
        "single",
        _c("Chicken", "Pork", "Beef") + _c("Prawns", extra=200),
    ),
    ("fish-portion", "Portion", "single", _c("Fillet") + _c("Whole fish", extra=1900)),
    (
        "protein-fried-rice",
        "Protein",
        "single",
        _c("Chicken", "Pork", "Beef", "Vegetable")
        + _c("Prawns", "Seafood", "Duck", "Crispy pork", "Crab meat", extra=300),
    ),
    ("kao-tom-mud-filling", "Filling", "single", _c("Banana", "Taro")),
    ("iced-tea", "Tea", "single", _c("Ice milk tea", "Ice black tea")),
    (
        "ice-level",
        "Ice",
        "single",
        _c("Standard") + _c("Less ice", extra=200) + _c("No ice", extra=300),
    ),
    ("soft-drink", "Drink", "single", _c("Coke", "Coke Zero", "Sprite", "Fanta", "Solo")),
    ("herb-tea", "Tea", "single", _c("Jasmine", "Lemongrass & ginger", "Green tea")),
]

GF, SPICY, VO = "gluten-free", "spicy", "vegetarian-option"
PEANUTS, CASHEW = "peanuts", "tree-nuts"

# Dishes with a photo cut from the printed menu (frontend/public/menu/yt/<number>.jpg)
PHOTOS = {
    1, 2, 4, 11, 13, 17, 19, 21, 28, 31, 32, 33, 34, 36, 37, 38, 39, 40, 41, 45, 47, 50, 51,
    52, 53, 55, 60, 61, 62, 65, 68, 72, 73, 74, 76, 77, 79, 80, 81, 84, 85, 86, 88, 91,
}  # fmt: skip


@dataclass
class Dish:
    number: int
    id: str
    category: str
    name: str
    name_th: str
    description: str
    price: int  # cents
    options: list[str] = field(default_factory=list)
    dietary: list[str] = field(default_factory=list)
    allergens: list[str] = field(default_factory=list)
    # Shown on the printed menu with a gold band
    recommended: bool = False

    @property
    def image(self) -> str | None:
        return f"/menu/yt/{self.number}.jpg" if self.number in PHOTOS else None


def _d(number, id_, category, name, name_th, description, dollars, **kw) -> Dish:
    return Dish(number, id_, category, name, name_th, description, round(dollars * 100), **kw)


A, S, SA, NO = "appetizers", "soup", "salad", "stir-fried-noodles"
SN, CU, SF, SP = "soup-noodles", "curry", "stir-fried", "specials"
R, DE, DR = "rice", "desserts", "drinks"

DISHES = [
    # Appetizers
    _d(1, "satay", A, "Satay (5 skewers)", "สะเต๊ะ",
       "Marinated chicken or beef skewers, grilled and served with peanut sauce.", 15.90,
       options=["satay-meat"], allergens=[PEANUTS], recommended=True),
    _d(2, "kuy-chay", A, "Kuy Chay", "กุยช่าย",
       "Fried Chinese leek cake with bean sprouts and special sauce.", 14.90),
    _d(3, "por-pia-tod", A, "Por Pia Tod (4 pieces)", "ปอเปี๊ยะทอด",
       "Mini spring rolls, pork or vegetable, with sweet chilli sauce.", 13.90,
       options=["por-pia-filling"], dietary=[VO]),
    _d(4, "gai-tod", A, "Gai Tod (5 pieces)", "ไก่ทอด",
       "Thai-style deep-fried chicken wings with sweet chilli sauce.", 14.90),
    _d(5, "goong-hom-par", A, "Goong Hom Par (3 pieces)", "กุ้งห่มผ้า",
       "Prawns marinated with Thai spices and herbs, wrapped in spring roll pastry.", 13.90),
    _d(6, "tod-mun", A, "Tod Mun (5 pieces)", "ทอดมัน",
       "Fish cakes with red curry paste and Thai herbs, with sweet chilli sauce.", 16.90,
       dietary=[GF], allergens=[PEANUTS]),
    _d(7, "joaw-samut", A, "Joaw Samut (3 skewers)", "เจ้าสมุทร",
       "Deep-fried mixed seafood balls with sweet chilli sauce.", 16.90),
    _d(8, "gai-hor-bai-toey", A, "Gai Hor Bai Toey (4 pieces)", "ไก่ห่อใบเตย",
       "Marinated chicken with Thai herbs, wrapped in pandan leaves, with sweet chilli sauce.",
       17.90, recommended=True),
    _d(9, "sai-oua", A, "Sai Oua", "ไส้อั่ว",
       "Northern Thai pork sausage marinated with red chilli paste.", 15.90, dietary=[SPICY]),
    _d(10, "mixed-entree", A, "Mixed Entree", "ของว่างรวม",
       "Vegetable and pork spring rolls, Goong Hom Par and Tod Mun with sweet chilli sauce.",
       16.90),
    _d(11, "prawn-cakes", A, "Prawn Cakes (4 pieces)", "ทอดมันกุ้ง",
       "Deep-fried prawn cakes with plum sauce.", 17.90),
    _d(12, "poo-nim-tod-grob", A, "Poo Nim Tod Grob", "ปูนิ่มทอดกรอบ",
       "Deep-fried soft shell crab with homemade sweet chilli sauce.", 18.90,
       allergens=[CASHEW]),
    # Soup
    _d(13, "tom-yum", S, "Tom Yum (pork, beef or chicken)", "ต้มยำ",
       "Spicy hot and sour soup.", 16.90,
       options=["protein-pbc", "hot-pot-600"], dietary=[GF, SPICY]),
    _d(13, "tom-yum-seafood", S, "Tom Yum (seafood, prawn or fish)", "ต้มยำ",
       "Spicy hot and sour soup.", 18.90,
       options=["protein-spf", "hot-pot-700"], dietary=[GF, SPICY]),
    _d(14, "tom-yum-pug", S, "Tom Yum Pug (vegetables)", "ต้มยำผัก",
       "Spicy hot and sour soup with vegetables and tofu.", 16.90,
       options=["hot-pot-600"], dietary=[GF, SPICY]),
    _d(15, "po-tag", S, "Po Tag", "โป๊ะแตก",
       "Spicy hot mixed seafood soup with basil leaves.", 18.90,
       options=["hot-pot-700"], dietary=[GF, SPICY]),
    _d(16, "tom-jurd-woon-sen", S, "Tom Jurd Woon Sen Soup", "ต้มจืดวุ้นเส้น",
       "Clear soup with vermicelli noodles and marinated minced pork.", 18.90, dietary=[GF]),
    _d(17, "tom-jurd-tao-ho-moo-sub", S, "Tom Jurd Tao Ho Moo Sub", "ต้มจืดเต้าหู้หมูสับ",
       "Clear soup with egg tofu and marinated minced pork.", 18.90, dietary=[GF]),
    _d(18, "tom-jurd-lourd-moo", S, "Tom Jurd Lourd Moo", "ต้มจืดเลือดหมู",
       "Clear soup with mixed pork, pig blood and vegetables.", 18.90, dietary=[GF]),
    # Salad
    _d(19, "som-tum", SA, "Som Tum", "ส้มตำ",
       "Green papaya salad with lemon dressing, fish sauce, chilli and dried shrimp.", 17.90,
       options=["som-tum-style"], dietary=[GF]),
    _d(20, "seafood-som-tum", SA, "Seafood Som Tum", "ส้มตำทะเล",
       "Green papaya salad with lemon dressing, fish sauce, chilli, dried shrimp and seafood.",
       21.90, dietary=[GF]),
    _d(21, "num-tok-pla-muk", SA, "Num Tok Pla Muk", "น้ำตกปลาหมึก",
       "Grilled squid salad with coriander, spring onion, lemon juice, ground rice and chilli.",
       21.90, dietary=[GF]),
    _d(22, "yum-woon-sen", SA, "Yum Woon Sen", "ยำวุ้นเส้น",
       "Vermicelli salad with minced chicken, seafood, chilli, onion, fish sauce and lemon.",
       23.90, dietary=[GF]),
    _d(23, "num-tok", SA, "Num Tok", "น้ำตก",
       "Grilled sliced beef or pork salad with coriander, spring onion, lemon and ground rice.",
       21.90, options=["num-tok-meat"], dietary=[GF]),
    _d(24, "muk-ma-now", SA, "Muk Ma-Now", "หมึกมะนาว",
       "Steamed sliced squid with chopped chilli, garlic and lemon juice.", 18.90, dietary=[GF]),
    _d(25, "pla-goong", SA, "Pla Goong", "พล่ากุ้ง",
       "King prawn salad with chilli and lemongrass.", 22.90, dietary=[GF]),
    _d(26, "yum-nuer", SA, "Yum Nuer", "ยำเนื้อ",
       "Grilled sliced beef salad with cucumber, tomato, onion, lemon juice and chilli.", 20.90,
       dietary=[GF]),
    _d(27, "larb-ped", SA, "Larb Ped", "ลาบเป็ด",
       "Roast duck salad with onion, chilli, fish sauce, lemon juice and ground rice.", 22.90,
       dietary=[GF]),
    _d(28, "yum-sam-grob", SA, "Yum Sam Grob", "ยำสามกรอบ",
       "Prawns, squid and crispy pork skin salad with vegetables and special sauce.", 23.90,
       dietary=[SPICY]),
    _d(29, "yum-talay", SA, "Yum Talay", "ยำทะเล",
       "Seafood salad with chilli, lemon juice, fish sauce and onion.", 23.90, dietary=[GF]),
    _d(30, "tub-waan", SA, "Tub Waan", "ตับหวาน",
       "Pork liver salad with lemon juice, fish sauce and onion.", 21.90, dietary=[GF]),
    _d(31, "salad-poo-nim", SA, "Salad Poo Nim", "สลัดปูนิ่ม",
       "Deep-fried soft shell crab with fresh green apple salad.", 24.90, allergens=[CASHEW]),
    # Stir-fried noodles
    _d(32, "pad-thai", NO, "Pad Thai", "ผัดไทย",
       "Rice noodles stir-fried with bean sprouts, vegetables, dried shrimp, crushed peanuts "
       "and egg.", 20.90,
       options=["protein-noodles"], dietary=[GF, VO], allergens=[PEANUTS], recommended=True),
    _d(33, "pud-see-ew", NO, "Pud See Ew", "ผัดซีอิ๊ว",
       "Flat rice noodles stir-fried with soy sauce, egg and vegetables.", 20.90,
       options=["protein-noodles"], dietary=[VO], recommended=True),
    _d(34, "pud-kee-mow", NO, "Pud Kee Mow", "ผัดขี้เมา",
       "Flat rice noodles stir-fried with chilli, basil leaves and vegetables.", 20.90,
       options=["protein-noodles"], dietary=[SPICY, VO], recommended=True),
    _d(35, "lard-nar", NO, "Lard Nar", "ราดหน้า",
       "Stir-fried flat rice noodles topped with gravy and mixed vegetables.", 20.90,
       options=["protein-noodles"], dietary=[VO]),
    # Soup noodles
    _d(36, "gouy-teaw-nuer", SN, "Gouy Teaw Nuer", "ก๋วยเตี๋ยวเนื้อ",
       "Beef noodle soup with bean sprouts, beef brisket, sliced beef and beef balls.", 17.90,
       recommended=True),
    _d(37, "gouy-teaw-moo", SN, "Gouy Teaw Moo", "ก๋วยเตี๋ยวหมู",
       "Pork noodle soup with minced pork, fish balls, pork liver, bean sprouts, spring onion "
       "and dried shrimp.", 17.90),
    _d(38, "tender-pork-soup", SN, "Tender Pork Soup", "ก๋วยเตี๋ยวหมูตุ๋น",
       "Pork noodle soup with tender braised pork.", 17.90),
    # Curry
    _d(39, "gang-dang", CU, "Gang Dang", "แกงแดง",
       "Thai red curry cooked in coconut milk with vegetables.", 21.90,
       options=["protein-curry"], dietary=[GF, VO]),
    _d(40, "gang-panang", CU, "Gang Panang", "แกงแพนง",
       "Mild Thai curry cooked in coconut milk with kaffir lime leaves.", 21.90,
       options=["protein-curry"], dietary=[GF, VO]),
    _d(41, "gang-keaw-waan", CU, "Gang Keaw Waan", "แกงเขียวหวาน",
       "Thai green curry cooked in coconut milk with vegetables.", 21.90,
       options=["protein-curry"], dietary=[GF, VO]),
    _d(42, "gang-pa", CU, "Gang Pa", "แกงป่า",
       "Thai red-hot soup with vegetables, served in a hot pot (no coconut milk).", 21.90,
       options=["protein-curry"], dietary=[GF, VO]),
    _d(43, "gang-som", CU, "Gang Som (hot pot)", "แกงส้ม",
       "Thai hot and sour soup with seafood and vegetables.", 21.90),
    _d(44, "gang-som-cha-aom-kai-tod", CU, "Gang Som Cha Aom Kai Tod (hot pot)",
       "แกงส้มชะอมไข่ทอด", "Hot and sour soup with seafood and acacia omelette.", 23.90),
    # Stir-fried temptation
    _d(45, "pad-grapow", SF, "Pad Grapow", "ผัดกระเพรา",
       "Stir-fried with chilli and holy basil.", 21.90, options=["protein-minced"],
       dietary=[VO]),
    _d(46, "pud-prik-kee-nu", SF, "Pud Prik Kee Nu", "ผัดพริกขี้หนู",
       "Stir-fried with chilli and spring onion.", 21.90, options=["protein-minced"],
       dietary=[VO]),
    _d(47, "pud-gratiem-prik-thai", SF, "Pud Gratiem Prik Thai", "ผัดกระเทียมพริกไทย",
       "Stir-fried with pepper, garlic and soy sauce.", 21.90, options=["protein-stir-fry"],
       dietary=[VO]),
    _d(48, "pud-med-ma-muang", SF, "Pud Med Ma-Muang", "ผัดเม็ดมะม่วง",
       "Stir-fried with vegetables and cashew nuts.", 21.90, options=["protein-stir-fry"],
       dietary=[VO], allergens=[CASHEW]),
    _d(49, "pud-king", SF, "Pud King", "ผัดขิง",
       "Stir-fried with ginger, mushroom, onion and oyster sauce.", 21.90,
       options=["protein-stir-fry"], dietary=[VO]),
    _d(50, "pud-prik-gang", SF, "Pud Prik Gang", "ผัดพริกแกง",
       "Stir-fried with chilli paste, long beans and basil leaves.", 21.90,
       options=["protein-stir-fry"], dietary=[VO]),
    _d(51, "pud-num-mun-hoy", SF, "Pud Num Mun Hoy", "ผัดน้ำมันหอย",
       "Stir-fried with oyster sauce and spring onion.", 21.90, options=["protein-stir-fry"],
       dietary=[VO]),
    _d(52, "pud-pug-ruammit", SF, "Pud Pug Ruammit", "ผัดผักรวมมิตร",
       "Stir-fried mixed vegetables with tofu and soy sauce.", 17.90, dietary=[GF]),
    _d(53, "kanar-moo-grob", SF, "Kanar Moo Grob", "คะน้าหมูกรอบ",
       "Stir-fried Chinese broccoli with crispy pork and oyster sauce.", 24.90),
    _d(54, "pud-ka-nar", SF, "Pud Ka Nar", "ผัดคะน้า",
       "Stir-fried Chinese broccoli with oyster sauce.", 23.90, options=["protein-ka-nar"]),
    _d(55, "poo-pud-phong-karee", SF, "Poo Pud Phong Karee", "ปูผัดผงกะหรี่",
       "Stir-fried jumbo crab meat with yellow curry, spring onion and chilli.", 39.90),
    _d(56, "pud-phong-karee-ta-lay", SF, "Pud Phong Karee Ta-lay", "ผัดผงกะหรี่ทะเล",
       "Stir-fried seafood with yellow curry, spring onion and chilli.", 29.90),
    _d(57, "pud-phong-karee-goong", SF, "Pud Phong Karee Goong", "กุ้งผัดผงกะหรี่",
       "Stir-fried prawns with yellow curry, spring onion and chilli.", 29.90),
    _d(58, "poo-pud-num-prik-pow", SF, "Poo Pud Num Prik Pow", "ปูผัดน้ำพริกเผา",
       "Stir-fried jumbo crab meat with sweet chilli paste.", 39.90),
    _d(59, "goong-pud-num-prik-pow", SF, "Goong Pud Num Prik Pow", "กุ้งผัดน้ำพริกเผา",
       "Stir-fried prawns with sweet chilli paste.", 29.90, dietary=[GF]),
    # Special additional
    _d(60, "pla-lard-prig", SP, "Pla Lard Prig", "ปลาราดพริก",
       "Deep-fried fish topped with hot chilli sauce.", 20.90, options=["fish-portion"],
       dietary=[SPICY], recommended=True),
    _d(61, "pla-neung-ma-now", SP, "Pla Neung Ma-now (whole)", "ปลานึ่งมะนาว",
       "Steamed whole barramundi topped with lemon, garlic and chilli.", 39.90, dietary=[GF],
       recommended=True),
    _d(62, "pla-lui-suan", SP, "Pla Lui Suan", "ปลาลุยสวน",
       "Deep-fried fish topped with green apple salad (mango in season).", 39.90,
       recommended=True),
    _d(63, "pla-sam-rod", SP, "Pla Sam Rod", "ปลาสามรส",
       "Deep-fried fish topped with sweet and sour sauce.", 20.90, options=["fish-portion"]),
    _d(64, "pla-tod-gratiem-prik-thai", SP, "Pla Tod Gratiem Prik Thai (whole)",
       "ปลาทอดกระเทียมพริกไทย", "Deep-fried whole fish with garlic, pepper and oyster sauce.",
       39.90),
    _d(65, "moo-aob", SP, "Moo Aob", "หมูอบ",
       "Tender pork fillet with herbs and homemade sauce.", 23.90),
    _d(66, "neur-aob", SP, "Neur Aob", "เนื้ออบ",
       "Tender beef fillet with herbs and homemade sauce.", 23.90),
    _d(67, "cha-aom-kai-tod", SP, "Cha Aom Kai Tod", "ชะอมไข่ทอด", "Acacia omelette.", 14.90),
    _d(68, "plain-omelette", SP, "Plain Omelette", "ไข่เจียว", "Thai-style omelette.", 12.90),
    _d(69, "kai-jeaw-moo-sub", SP, "Kai Jeaw Moo Sub", "ไข่เจียวหมูสับ",
       "Omelette with minced pork.", 16.90),
    _d(70, "kai-jeaw-poo", SP, "Kai Jeaw Poo", "ไข่เจียวปู", "Omelette with crab meat.", 19.90),
    # Rice
    _d(71, "kao-pud", R, "Kao Pud", "ข้าวผัด",
       "Thai fried rice with onion, spring onion, tomato, egg and vegetables.", 22.90,
       options=["protein-fried-rice"], dietary=[VO]),
    _d(72, "pineapple-fried-rice", R, "Pineapple Fried Rice", "ข้าวผัดสับปะรด",
       "Fried rice with ham, pineapple and spring onion.", 22.90),
    _d(73, "kao-pud-nam", R, "Kao Pud Nam", "ข้าวผัดแหนม",
       "Fried rice with egg, sour pork and spring onion.", 22.90),
    _d(74, "jasmine-rice", R, "Steamed jasmine rice", "ข้าวสวย", "", 4.50),
    _d(75, "sticky-rice", R, "Steamed sticky rice", "ข้าวเหนียว", "", 5.00),
    _d(76, "coconut-rice", R, "Coconut rice", "ข้าวกะทิ", "", 5.00),
    _d(77, "roti", R, "Roti", "โรตี", "", 5.00),
    _d(78, "peanut-sauce", R, "Peanut sauce", "", "", 5.00, allergens=[PEANUTS]),
    _d(79, "fried-egg", R, "Fried egg (each)", "", "", 4.50),
    # Desserts
    _d(80, "kao-tom-mud-ice-cream", DE, "Kao Tom Mud Ice Cream", "ข้าวต้มมัดไอศครีม",
       "Sweet sticky rice stuffed with banana or taro, served with ice cream.", 14.90,
       options=["kao-tom-mud-filling"]),
    _d(81, "coconut-ice-cream", DE, "Coconut ice cream", "ไอศครีม", "Coconut ice cream.", 11.90),
    _d(82, "sago-coconut", DE, "Sa Coo Maprao On", "สาคูมะพร้าวอ่อน",
       "Sago in coconut cream.", 11.90),
    _d(83, "bua-loy", DE, "Bua Loy", "บัวลอย", "Rice balls in sweet coconut milk.", 11.90),
    # Drinks
    _d(84, "iced-tea", DR, "Ice Milk Tea or Ice Black Tea", "ชาเย็น, ชาดำเย็น",
       "Thai iced tea. Less ice or no ice costs a little more.", 6.50,
       options=["iced-tea", "ice-level"]),
    _d(85, "ice-lemon-tea", DR, "Ice Lemon Tea", "ชามะนาว", "", 6.50),
    _d(86, "ice-coffee", DR, "Ice Coffee", "กาแฟเย็น", "", 6.50),
    _d(87, "soft-drink", DR, "Soft drink", "น้ำอัดลม", "Coke, Coke Zero, Sprite, Fanta or Solo.",
       4.50, options=["soft-drink"]),
    _d(88, "coconut-juice", DR, "Coconut Juice", "น้ำมะพร้าว", "", 6.50),
    _d(89, "orange-juice", DR, "Orange Juice", "น้ำส้ม", "", 5.00),
    _d(90, "apple-juice", DR, "Apple Juice", "น้ำแอปเปิล", "", 5.00),
    _d(91, "thai-herb-tea", DR, "Thai Herb Tea (per person)", "ชาไทย",
       "A pot of jasmine, lemongrass and ginger, or green tea.", 3.50, options=["herb-tea"]),
    _d(92, "byo-wine", DR, "BYO wine (per bottle)", "", "Corkage for wine you bring.", 10.00),
]  # fmt: skip

# Two dishes start sold out so the demo shows how that looks
DEFAULT_SOLD_OUT = ("coconut-juice", "poo-pud-num-prik-pow")
