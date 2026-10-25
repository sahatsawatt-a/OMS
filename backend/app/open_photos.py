# ruff: noqa: E501 -- one dish per line; Commons links alone are longer than a line
"""
Open-source stand-in photos for the dishes on Ying Thai 2's printed menu (app/menu_data.py).

From Wikimedia Commons, used under their licences, which ask for the credit below; the guest
menu shows it under the photo, and frontend/public/menu/open/CREDITS.md lists them all. They
show a dish like it, not the restaurant's own plate, picked to match the printed menu's photos
(shot from about 45 degrees, the dish filling the frame) and cropped to the same shape.
Files: frontend/public/menu/open/<dish id>.jpg (made by a script, not edited by hand)
"""

from app.schemas import PhotoCredit


def open_photo_url(dish_id: str) -> str:
    return f"/menu/open/{dish_id}.jpg"


def _c(author: str, license: str, license_url: str, source: str) -> PhotoCredit:
    return PhotoCredit(author=author, license=license, license_url=license_url, source=source)


OPEN_PHOTOS: dict[str, PhotoCredit] = {
    "satay": _c("Thank You (25 Millions ) views from Fresno, USA", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", "https://commons.wikimedia.org/wiki/File:Chicken_Satay_(54029806221).jpg"),
    "kuy-chay": _c("Takeaway", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Khanom_kuichai.jpg"),
    "por-pia-tod": _c("Pattaya Patrol from Pattaya", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", "https://commons.wikimedia.org/wiki/File:DFC_2191_vietnamese_spring_rolls_on_a_cooling_rack_(54849339806).jpg"),
    "gai-tod": _c("Vee Satayamas", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", "https://commons.wikimedia.org/wiki/File:Bankrueed_fried_chicken_wings.jpg"),
    "goong-hom-par": _c("Missvain", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", "https://commons.wikimedia.org/wiki/File:Shanghai_Restaurant_-_August_2019_-_Stierch_03.jpg"),
    "tod-mun": _c("Justin Hee", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", "https://commons.wikimedia.org/wiki/File:Thai_Fish_Cake.jpg"),
    "joaw-samut": _c("Shuma Shuam CHENMIEL", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", "https://commons.wikimedia.org/wiki/File:ZS_%E4%B8%AD%E5%B1%B1%E5%B8%82_Zhongshan_%E6%A3%A0%E8%A8%98%E6%B5%B7%E9%AE%AE%E9%A4%90%E5%BB%B3_Tangji_Seafood_Restaurant_%E6%99%9A%E9%A4%90_dinner_%E7%82%B8%E7%85%8E%E5%A0%86_oil_fried_rice_balls_May_2023_Px3_01.jpg"),
    "gai-hor-bai-toey": _c("LeonardKong", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", "https://commons.wikimedia.org/wiki/File:Pandan_Chicken_(7005976636).jpg"),
    "sai-oua": _c("Takeaway", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Sai_ua.JPG"),
    "mixed-entree": _c("Ewan Munro from London, UK", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", "https://commons.wikimedia.org/wiki/File:Old_Pack_Horse,_Chiswick,_London_(2441790692).jpg"),
    "prawn-cakes": _c("Takeaway", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Thanin_market_tod_man_pla.jpg"),
    "poo-nim-tod-grob": _c("pointnshoot", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", "https://commons.wikimedia.org/wiki/File:Ultimate_Seafood_Platter_at_Landry%27s_Seafood_House.jpg"),
    "tom-yum": _c("Vee Satayamas", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", "https://commons.wikimedia.org/wiki/File:Tom_yam_kung_1.jpg"),
    "tom-yum-seafood": _c("Vee Satayamas", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", "https://commons.wikimedia.org/wiki/File:Tom_yam_kung_1.jpg"),
    "tom-yum-pug": _c("Andy Li", "CC0", "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "https://commons.wikimedia.org/wiki/File:Tom_Yum_Soup_with_mushroom_-_Siam_Siam_2025-09-07.jpg"),
    "po-tag": _c("PattayaPatrol", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", "https://commons.wikimedia.org/wiki/File:DZ3_0598_Fresh_clams_and_greens_simmering_in_a_clear_flavorful_Thai_seafood_soup_ready_to_be_enjoyed.jpg"),
    "tom-jurd-woon-sen": _c("Takeaway", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Tom_mara_yat_sai_mu_sap_wunsen.jpg"),
    "tom-jurd-tao-ho-moo-sub": _c("Index Librorum Permissorum", "CC0", "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "https://commons.wikimedia.org/wiki/File:Clear_Soup_2018-05-05_(1).jpg"),
    "tom-jurd-lourd-moo": _c("Takeaway", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Kuaichap.JPG"),
    "som-tum": _c("ssour", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", "https://commons.wikimedia.org/wiki/File:Khmer-style_green_papaya_salad.jpg"),
    "seafood-som-tum": _c("Bounthy", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", "https://commons.wikimedia.org/wiki/File:Lao_papaya_salad_with_seafood.jpg"),
    "num-tok-pla-muk": _c("pelican from Tokyo, Japan", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", "https://commons.wikimedia.org/wiki/File:Thai_squid_and_noodle_salad_(8619316942).jpg"),
    "yum-woon-sen": _c("star5112", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", "https://commons.wikimedia.org/wiki/File:JOH_8256_-_Lotus_of_Siam.jpg"),
    "num-tok": _c("Takeaway", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Moo_nam_tok.jpg"),
    "muk-ma-now": _c("Glen MacLarty from Toronto, Canada", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", "https://commons.wikimedia.org/wiki/File:Calamari_Salad_(6342955224).jpg"),
    "pla-goong": _c("Takeaway", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Yam_takhrai_kung_sot.jpg"),
    "yum-nuer": _c("Sharon Chen from Austin, United States", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", "https://commons.wikimedia.org/wiki/File:Thai_Beef_Salad_(28864041891).jpg"),
    "larb-ped": _c("Vee Satayamas", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", "https://commons.wikimedia.org/wiki/File:%E0%B8%A5%E0%B8%B2%E0%B8%9A%E0%B9%80%E0%B8%9B%E0%B9%87%E0%B8%94_%E0%B8%A3%E0%B9%89%E0%B8%B2%E0%B8%99%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99%E0%B8%84%E0%B8%A3%E0%B8%B9%E0%B8%AD%E0%B8%B5%E0%B9%8A%E0%B8%94.jpg"),
    "yum-sam-grob": _c("แอนเดอร์สัน", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", "https://commons.wikimedia.org/wiki/File:Yam_Mama.jpg"),
    "yum-talay": _c("Pattaya Patrol from Pattaya", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", "https://commons.wikimedia.org/wiki/File:DFC_5372,_Spicy_Thai_seafood_salad_with_prawns,_squid_and_mushrooms,_tossed_with_fresh_herbs_and_chilies_-_a_zesty_plate_from_Klet_Kaeo,_Sattahip._-_Flickr_-_PattayaPatrol.jpg"),
    "tub-waan": _c("Takeaway", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", "https://commons.wikimedia.org/wiki/File:Lap_mu.JPG"),
    "salad-poo-nim": _c("Neil Conway from Oakland, USA", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", "https://commons.wikimedia.org/wiki/File:Drunken_Noodles_with_Soft-Shell_Crab_(5882668219).jpg"),
    "pad-thai": _c("Andy Li", "CC0", "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "https://commons.wikimedia.org/wiki/File:Pad_Thai_with_Pork_-_Unithai.jpg"),
    "pud-see-ew": _c("Ser Amantio di Nicolao", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Plate_of_pad_see_ew_from_9_Pad_Thai.jpg"),
    "pud-kee-mow": _c("Takeaway", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Sen_yai_phat_khi_mao.jpg"),
    "lard-nar": _c("stu_spivack", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", "https://commons.wikimedia.org/wiki/File:Kuay-tiew_rad_na.jpg"),
    "gouy-teaw-nuer": _c("chomjong", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", "https://commons.wikimedia.org/wiki/File:Kuai_tiao_nuea.jpg"),
    "gouy-teaw-moo": _c("Sharon Hahn Darlin", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", "https://commons.wikimedia.org/wiki/File:Common_local_Thai_food._50%E0%B8%BF_(baht)_%3D_$1.50_(pork)_noodle_soup_in_Phuket,_Thailand.jpg"),
    "tender-pork-soup": _c("Alpha from Melbourne, Australia", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", "https://commons.wikimedia.org/wiki/File:%E5%A4%A7%E8%82%89%E9%9D%A2_Braised_Belly_Pork_in_Noodle_Soup_-_Auntie%27s_Dumplings_AUD7.80_(4781709148).jpg"),
    "gang-dang": _c("Takeaway", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Kaeng_phet_mu.jpg"),
    "gang-panang": _c("Takeaway", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Phanaeng_kai.jpg"),
    "gang-keaw-waan": _c("Guilhem Vellut from Paris, France", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", "https://commons.wikimedia.org/wiki/File:Green_Curry,_Siam_House,_Paris_002.jpg"),
    "gang-pa": _c("Takeaway", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Kaeng_phak_wan.JPG"),
    "gang-som": _c("Takeaway", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Kaeng_som_kung.jpg"),
    "gang-som-cha-aom-kai-tod": _c("Takeaway", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Kaeng_som_chaom_thot.jpg"),
    "pad-grapow": _c("Mdsheth1986", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", "https://commons.wikimedia.org/wiki/File:Daging_Pad_Kra_Pao.jpg"),
    "pud-prik-kee-nu": _c("Alpha", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", "https://commons.wikimedia.org/wiki/File:%E8%95%89%E8%8A%B1%E7%82%92%E9%9F%AD%E8%8F%9C_Sliced_Banana_Flower_and_Chive_stir-fry_-_Baolaoliu_Restaurant_%E5%8C%85%E8%80%81%E5%85%AD%E9%A5%AD%E5%BA%97.jpg"),
    "pud-gratiem-prik-thai": _c("Vee Satayamas", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", "https://commons.wikimedia.org/wiki/File:Rice_with_stir-fried_squid,_garlic,_pepper_and_fried_duck_egg.jpg"),
    "pud-med-ma-muang": _c("PattayaPatrol", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", "https://commons.wikimedia.org/wiki/File:DSCF0812_Savory_cashew_chicken_stir-fry_with_bell_peppers_and_tender_pieces_of_meat_glazed_in_a_glossy_sauce.jpg"),
    "pud-king": _c("Takeaway", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", "https://commons.wikimedia.org/wiki/File:Kai_phat_khing.jpg"),
    "pud-prik-gang": _c("Iudexvivorum", "CC0", "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "https://commons.wikimedia.org/wiki/File:Phrik_khing_fried_crispy_pork_with_rice_-_Chiang_Mai_-_2017-07-09.jpg"),
    "pud-num-mun-hoy": _c("Takeaway", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Phat_khanaeng_mu.jpg"),
    "pud-pug-ruammit": _c("Wildfeuer", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:2008-06-14ThaiRestaurant03.jpg"),
    "kanar-moo-grob": _c("Takeaway", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Phat_khana_mu_krop.jpg"),
    "pud-ka-nar": _c("Takeaway", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Pak_kanaa_namman_hoi.jpg"),
    "poo-pud-phong-karee": _c("User:Takoradee", "CC BY-SA 3.0", "http://creativecommons.org/licenses/by-sa/3.0/", "https://commons.wikimedia.org/wiki/File:Pu_Phat_Phong_Kari.jpg"),
    "pud-phong-karee-ta-lay": _c("Takeaway", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Phunim_phat_pong_kari.jpg"),
    "pud-phong-karee-goong": _c("Takeaway", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Phunim_phat_pong_kari.jpg"),
    "poo-pud-num-prik-pow": _c("Gems Keerthiga", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", "https://commons.wikimedia.org/wiki/File:Crab_curry_or_Nandu_Kulambu.jpg"),
    "goong-pud-num-prik-pow": _c("Mdsheth1986", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", "https://commons.wikimedia.org/wiki/File:Udang_Tumis_Bawang_Putih_Cili.jpg"),
    "pla-lard-prig": _c("Takeaway", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Pla_tub_tim_tod_samrod.jpg"),
    "pla-neung-ma-now": _c("Takeaway", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Pla_thapthim_nueng_manao.jpg"),
    "pla-lui-suan": _c("Taz from Vancouver, Canada", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", "https://commons.wikimedia.org/wiki/File:Halibut_with_mango_salsa_on_coconut_brown_rice_(434662467).jpg"),
    "pla-sam-rod": _c("Takeaway", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Pla_sam_thap.jpg"),
    "pla-tod-gratiem-prik-thai": _c("Takeaway", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Pla_nin_thot_samun_prai.jpg"),
    "moo-aob": _c("Takeaway", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Mu_op.jpg"),
    "neur-aob": _c("Ceeseven", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", "https://commons.wikimedia.org/wiki/File:Thai_Style_Roasted_Beef_in_Hong_Kong.jpg"),
    "cha-aom-kai-tod": _c("Wagaung at English Wikipedia", "CC BY-SA 3.0", "http://creativecommons.org/licenses/by-sa/3.0/", "https://commons.wikimedia.org/wiki/File:Cha-om_omelette.jpg"),
    "plain-omelette": _c("Bitterschoko", "CC0", "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "https://commons.wikimedia.org/wiki/File:Khao_khaichiao_(omelette_with_rice),_Pathum_Thani,_2018-09-04_(1).jpg"),
    "kai-jeaw-moo-sub": _c("Bitterschoko", "CC0", "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "https://commons.wikimedia.org/wiki/File:Khao_khaichiao_(omelette_with_rice),_Bangkok,_2018-05-15.jpg"),
    "kai-jeaw-poo": _c("Stripey the crab", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Omelet_With_Fixings.jpg"),
    "kao-pud": _c("Andy Li", "CC0", "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "https://commons.wikimedia.org/wiki/File:Khao_Pad_(with_prawn)_-_Nok_Nok_Kitchen_at_The_Cow_2024-03-28.jpg"),
    "pineapple-fried-rice": _c("Ceeseven", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Thai-style_Fried_Rice_in_Pineapple.jpg"),
    "kao-pud-nam": _c("lazy fri13th", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", "https://commons.wikimedia.org/wiki/File:Khao_phat_naem.jpg"),
    "jasmine-rice": _c("Anna Frodesiak", "CC0", "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "https://commons.wikimedia.org/wiki/File:Steamed_rice_in_bowl_01.jpg"),
    "sticky-rice": _c("Thomas Wanhoff", "CC BY-SA 2.0", "https://creativecommons.org/licenses/by-sa/2.0", "https://commons.wikimedia.org/wiki/File:Lao_sticky_rice.jpg"),
    "coconut-rice": _c("Andy Li", "CC0", "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "https://commons.wikimedia.org/wiki/File:Coconut_Rice_-_Easythaiger_2026-04-21.jpg"),
    "roti": _c("BrokenSphere", "CC BY-SA 3.0", "http://creativecommons.org/licenses/by-sa/3.0/", "https://commons.wikimedia.org/wiki/File:Roti_canai_with_sauce.JPG"),
    "peanut-sauce": _c("NeoBatfreak", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", "https://commons.wikimedia.org/wiki/File:Sister_Song%27s_Fish_Soup_(%E5%AE%8B%E5%AB%82%E9%AD%9A%E7%BE%B9).png"),
    "fried-egg": _c("Kurt Kaiser", "CC0", "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "https://commons.wikimedia.org/wiki/File:Fried_egg_sunny_side_up_5.jpg"),
    "kao-tom-mud-ice-cream": _c("Takeaway", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Khao_tom_mat_sai_kluai_01.jpg"),
    "coconut-ice-cream": _c("Index Librorum Permissorum", "CC0", "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "https://commons.wikimedia.org/wiki/File:Coconut_Ice_Cream_2018-08-03_(1).jpg"),
    "sago-coconut": _c("Takeaway", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", "https://commons.wikimedia.org/wiki/File:Sakhu_thua_dam.jpg"),
    "bua-loy": _c("Kapook.com", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", "https://commons.wikimedia.org/wiki/File:Bualoi_Boiled_flour_balls_with_coconut_milk.jpg"),
    "iced-tea": _c("Andy Li", "CC0", "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "https://commons.wikimedia.org/wiki/File:Cha-Yen_(Thai_iced_tea)_-_Namo_2026-07-30.jpg"),
    "ice-lemon-tea": _c("Renee Comet (Photographer)", "Public domain", "https://creativecommons.org/publicdomain/mark/1.0/", "https://commons.wikimedia.org/wiki/File:Iced_tea.jpg"),
    "ice-coffee": _c("KtMystic", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", "https://commons.wikimedia.org/wiki/File:Iced_Ipoh_White_Coffee.jpg"),
    "soft-drink": _c("Estabiano", "CC0", "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "https://commons.wikimedia.org/wiki/File:Soft_Drink_in_Canada.jpg"),
    "coconut-juice": _c("Crisco 1492", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Coconut_Drink,_Pangandaran.JPG"),
    "orange-juice": _c("Agency of the United States Department of Agriculture Edited Version by: Arad", "Public domain", "https://creativecommons.org/publicdomain/mark/1.0/", "https://commons.wikimedia.org/wiki/File:Orange_juice_1_edit1.jpg"),
    "apple-juice": _c("Emanuel Jöbstl und Martin Thoma", "CC0", "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "https://commons.wikimedia.org/wiki/File:EmiMa-068.jpg"),
    "thai-herb-tea": _c("AyyanD", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", "https://commons.wikimedia.org/wiki/File:Lemongrass_ginger_tea.jpg"),
    "byo-wine": _c("TheCulinaryGeek from Chicago, USA", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", "https://commons.wikimedia.org/wiki/File:Vampire_Blood_(6703562867).jpg"),
}  # fmt: skip
