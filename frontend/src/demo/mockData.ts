import { MENU_DIETARY } from './dietary'
import type { MenuCategory, MenuData, MenuItem, OptionGroup, Table } from './types'

export const RESTAURANT_NAME = 'Ying Thai 2'
export const RESTAURANT_TAGLINE = 'Thai Restaurant · Melbourne, Australia VIC'

// Australian pricing (REQ-25): menu prices are in AUD and include 10% GST; no service charge.
export const GST_RATE = 0.1

/** Items waiting longer than this are highlighted on the kitchen display */
export const KITCHEN_LATE_AFTER_MS = 10 * 60 * 1000

export const TABLES: Table[] = [
  { id: 't1', number: 1, seats: 2, zone: 'Window' },
  { id: 't2', number: 2, seats: 2, zone: 'Window' },
  { id: 't3', number: 3, seats: 4, zone: 'Main' },
  { id: 't4', number: 4, seats: 4, zone: 'Main' },
  { id: 't5', number: 5, seats: 4, zone: 'Main' },
  { id: 't6', number: 6, seats: 6, zone: 'Main' },
  { id: 't7', number: 7, seats: 8, zone: 'Terrace' },
  { id: 't8', number: 8, seats: 4, zone: 'Terrace' },
]

/** Whole Australian dollars to cents; menu prices include GST */
const dollars = (n: number) => n * 100

const spice: OptionGroup = {
  id: 'spice',
  name: 'Spice level',
  type: 'single',
  choices: [
    { id: 'none', name: 'Not spicy', price: 0 },
    { id: 'mild', name: 'Mild', price: 0 },
    { id: 'medium', name: 'Medium', price: 0 },
    { id: 'hot', name: 'Thai hot', price: 0 },
  ],
}

const protein: OptionGroup = {
  id: 'protein',
  name: 'Protein',
  type: 'single',
  choices: [
    { id: 'chicken', name: 'Chicken', price: 0 },
    { id: 'pork', name: 'Pork', price: 0 },
    { id: 'tofu', name: 'Tofu', price: 0 },
    { id: 'shrimp', name: 'Shrimp', price: dollars(5) },
  ],
}

const extras: OptionGroup = {
  id: 'extras',
  name: 'Extras',
  type: 'multi',
  choices: [
    { id: 'egg', name: 'Fried egg', price: dollars(3) },
    { id: 'rice', name: 'Extra rice', price: dollars(4) },
  ],
}

const sweetness: OptionGroup = {
  id: 'sweetness',
  name: 'Sweetness',
  type: 'single',
  choices: [
    { id: 'normal', name: 'Normal', price: 0 },
    { id: 'less', name: 'Less sweet', price: 0 },
    { id: 'none', name: 'No sugar', price: 0 },
  ],
}

const DEFAULT_CATEGORIES: MenuCategory[] = [
  { id: 'starters', name: 'Starters' },
  { id: 'noodles', name: 'Noodles' },
  { id: 'rice', name: 'Rice dishes' },
  { id: 'curries', name: 'Curries & soups' },
  { id: 'drinks', name: 'Drinks' },
  { id: 'desserts', name: 'Desserts' },
]

const MENU_ITEMS: MenuItem[] = [
  { id: 'spring-rolls', categoryId: 'starters', name: 'Crispy spring rolls', description: 'Glass noodles and vegetables, sweet chilli dip.', price: dollars(12) },
  { id: 'satay', categoryId: 'starters', name: 'Chicken satay', description: 'Grilled skewers with peanut sauce and cucumber relish.', price: dollars(14), recommended: true },
  { id: 'som-tam', categoryId: 'starters', name: 'Som tam', description: 'Green papaya salad with lime, peanuts and dried shrimp.', price: dollars(16), optionGroups: [spice] },

  { id: 'pad-thai', categoryId: 'noodles', name: 'Pad Thai', description: 'Rice noodles, tamarind, egg, bean sprouts, crushed peanuts.', price: dollars(23), recommended: true, optionGroups: [protein, spice] },
  { id: 'pad-see-ew', categoryId: 'noodles', name: 'Pad see ew', description: 'Wide noodles wok-fried with soy and Chinese broccoli.', price: dollars(23), optionGroups: [protein] },
  { id: 'boat-noodles', categoryId: 'noodles', name: 'Boat noodle soup', description: 'Rich spiced broth with beef and thin rice noodles.', price: dollars(21), optionGroups: [spice] },

  { id: 'kra-pao', categoryId: 'rice', name: 'Pad kra pao', description: 'Holy basil stir-fry with chilli and garlic over jasmine rice.', price: dollars(21), recommended: true, optionGroups: [protein, spice, extras] },
  { id: 'khao-man-gai', categoryId: 'rice', name: 'Khao man gai', description: 'Poached chicken, garlic rice, ginger-soy sauce and broth.', price: dollars(20), optionGroups: [extras] },
  { id: 'pineapple-rice', categoryId: 'rice', name: 'Pineapple fried rice', description: 'Served in the pineapple with cashews and raisins.', price: dollars(25), optionGroups: [protein] },

  { id: 'green-curry', categoryId: 'curries', name: 'Green curry', description: 'Coconut green curry with Thai eggplant and basil.', price: dollars(24), optionGroups: [protein, spice] },
  { id: 'massaman', categoryId: 'curries', name: 'Massaman beef', description: 'Slow-cooked beef, potato and peanuts in mild curry.', price: dollars(27) },
  { id: 'tom-yum', categoryId: 'curries', name: 'Tom yum goong', description: 'Hot and sour shrimp soup with lemongrass and galangal.', price: dollars(25), recommended: true, optionGroups: [spice] },

  { id: 'thai-tea', categoryId: 'drinks', name: 'Thai iced tea', description: 'Strong black tea with condensed milk.', price: dollars(7), optionGroups: [sweetness] },
  { id: 'coconut', categoryId: 'drinks', name: 'Fresh coconut', description: 'Chilled young coconut.', price: dollars(9) },
  { id: 'lime-soda', categoryId: 'drinks', name: 'Lime soda', description: 'Fresh lime, soda, a pinch of salt.', price: dollars(6), optionGroups: [sweetness] },
  { id: 'singha', categoryId: 'drinks', name: 'Singha beer', description: '330 ml bottle.', price: dollars(10) },

  { id: 'mango-sticky-rice', categoryId: 'desserts', name: 'Mango sticky rice', description: 'Ripe mango, sweet coconut sticky rice.', price: dollars(14), recommended: true },
  { id: 'coconut-ice-cream', categoryId: 'desserts', name: 'Coconut ice cream', description: 'With roasted peanuts and sticky rice.', price: dollars(11) },
]

// Every sample dish has a photo at /menu/<id>.jpg (see photoCredits.ts) and sample dietary info
const DEFAULT_ITEMS: MenuItem[] = MENU_ITEMS.map((m) => ({ ...m, image: `/menu/${m.id}.jpg`, ...MENU_DIETARY[m.id] }))

/** The sample menu; the live menu is kept in the demo store and edited on the admin page */
export function defaultMenu(): MenuData {
  return structuredClone({ categories: DEFAULT_CATEGORIES, items: DEFAULT_ITEMS })
}

/** Sample dishes by id, used to build the seeded orders */
export const DEFAULT_MENU_BY_ID: Record<string, MenuItem> = Object.fromEntries(DEFAULT_ITEMS.map((m) => [m.id, m]))

/** Option groups an admin can attach to a dish */
export const OPTION_GROUPS: OptionGroup[] = [protein, spice, extras, sweetness]

/** The bundled sample photos an admin can pick from */
export const SAMPLE_PHOTOS: { name: string; url: string }[] = DEFAULT_ITEMS.map((m) => ({ name: m.name, url: m.image! }))
