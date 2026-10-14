// Sample menu photos from Wikimedia Commons, used under their open licences.
// Each photo is credited in the item sheet and in the menu's photo credits list.
export type PhotoCredit = { author: string; license: string; licenseUrl: string; source: string }

export const PHOTO_CREDITS: Record<string, PhotoCredit> = {
  'spring-rolls': { author: "Vaibhavratnaparkhi", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Thai_spring_rolls_2.jpg" },
  'satay': { author: "Sumit Surai", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Chicken_Satay_With_Peanut_Sauce.jpg" },
  'som-tam': { author: "Andy Li", license: "CC0", licenseUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en", source: "https://commons.wikimedia.org/wiki/File:Som_Tom_(Papaya_Salad)_-_Little_Thai_2024-06-14.jpg" },
  'pad-thai': { author: "Takeaway", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0", source: "https://commons.wikimedia.org/wiki/File:Phat_Thai_kung_Chang_Khien_street_stall.jpg" },
  'pad-see-ew': { author: "Ser Amantio di Nicolao", license: "CC0", licenseUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en", source: "https://commons.wikimedia.org/wiki/File:Chicken_pad_see_ew_at_Rice_and_Noodles_Thai_Restaurant,_Franconia.jpg" },
  'boat-noodles': { author: "Valenzuela400", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Pathumthani_Boat_noodles_restaurant_Philippines3.jpg" },
  'kra-pao': { author: "Bitterschoko", license: "CC0", licenseUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en", source: "https://commons.wikimedia.org/wiki/File:Ka-phrao_mu_(basil_fried_pork)_with_rice_%26_egg,_Bangkok,_2019-03-31_(2).jpg" },
  'khao-man-gai': { author: "Misaochan", license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0", source: "https://commons.wikimedia.org/wiki/File:Hainanese_chicken_rice.jpg" },
  'pineapple-rice': { author: "Grendelkhan", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Pineapple_fried_rice_at_Banana_Leaf_in_Milpitas,_California.jpg" },
  'green-curry': { author: "Kenamparo", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Thai_Green_Curry_with_Rice.jpg" },
  'massaman': { author: "Vee Satayamas", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Massaman_curry,_Bang_Kapi,_Bangkok.jpg" },
  'tom-yum': { author: "Andy Li", license: "CC0", licenseUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en", source: "https://commons.wikimedia.org/wiki/File:Tom_Yum_Goong_Noodle_Soup_-_Nok_Nok_Kitchen_at_The_Cow_2024-03-28.jpg" },
  'thai-tea': { author: "Andy Li", license: "CC0", licenseUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en", source: "https://commons.wikimedia.org/wiki/File:Thai_Red_Ice_Milk_Tea_-_Siam_Siam_2024-07-31.jpg" },
  'coconut': { author: "Crisco 1492", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0", source: "https://commons.wikimedia.org/wiki/File:Coconut_Drink,_Pangandaran.JPG" },
  'lime-soda': { author: "국립국어원", license: "CC BY-SA 2.0 kr", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/kr/deed.en", source: "https://commons.wikimedia.org/wiki/File:Cider_(lemon-lime_drink).jpg" },
  'singha': { author: "Slyronit", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Singha_Beer_in_bottle_and_glass_2.jpg" },
  'mango-sticky-rice': { author: "Dennis Wong from Hong Kong, Hong Kong", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0", source: "https://commons.wikimedia.org/wiki/File:Mango_sticy_rice_(3859549574).jpg" },
  'coconut-ice-cream': { author: "Index Librorum Permissorum", license: "CC0", licenseUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en", source: "https://commons.wikimedia.org/wiki/File:Coconut_Ice_Cream_2018-08-03_(1).jpg" },
}
