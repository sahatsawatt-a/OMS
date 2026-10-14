import { MENU_DIETARY } from './dietary'
import type { MenuCategory, MenuItem, OptionGroup, Table } from './types'

export const RESTAURANT_NAME = 'Baan Saeng'
export const RESTAURANT_TAGLINE = 'Thai kitchen · Bangkok'

// Assumptions to confirm with the restaurant (REQ-25): 10% service charge, 7% VAT on top.
export const SERVICE_CHARGE_RATE = 0.1
export const VAT_RATE = 0.07

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

const baht = (n: number) => n * 100

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
    { id: 'shrimp', name: 'Shrimp', price: baht(40) },
  ],
}

const extras: OptionGroup = {
  id: 'extras',
  name: 'Extras',
  type: 'multi',
  choices: [
    { id: 'egg', name: 'Fried egg', price: baht(15) },
    { id: 'rice', name: 'Extra rice', price: baht(20) },
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

export const CATEGORIES: MenuCategory[] = [
  { id: 'starters', name: 'Starters' },
  { id: 'noodles', name: 'Noodles' },
  { id: 'rice', name: 'Rice dishes' },
  { id: 'curries', name: 'Curries & soups' },
  { id: 'drinks', name: 'Drinks' },
  { id: 'desserts', name: 'Desserts' },
]

const MENU_ITEMS: MenuItem[] = [
  { id: 'spring-rolls', categoryId: 'starters', name: 'Crispy spring rolls', description: 'Glass noodles and vegetables, sweet chilli dip.', price: baht(89) },
  { id: 'satay', categoryId: 'starters', name: 'Chicken satay', description: 'Grilled skewers with peanut sauce and cucumber relish.', price: baht(129), recommended: true },
  { id: 'som-tam', categoryId: 'starters', name: 'Som tam', description: 'Green papaya salad with lime, peanuts and dried shrimp.', price: baht(99), optionGroups: [spice] },

  { id: 'pad-thai', categoryId: 'noodles', name: 'Pad Thai', description: 'Rice noodles, tamarind, egg, bean sprouts, crushed peanuts.', price: baht(139), recommended: true, optionGroups: [protein, spice] },
  { id: 'pad-see-ew', categoryId: 'noodles', name: 'Pad see ew', description: 'Wide noodles wok-fried with soy and Chinese broccoli.', price: baht(129), optionGroups: [protein] },
  { id: 'boat-noodles', categoryId: 'noodles', name: 'Boat noodle soup', description: 'Rich spiced broth with beef and thin rice noodles.', price: baht(99), optionGroups: [spice] },

  { id: 'kra-pao', categoryId: 'rice', name: 'Pad kra pao', description: 'Holy basil stir-fry with chilli and garlic over jasmine rice.', price: baht(99), recommended: true, optionGroups: [protein, spice, extras] },
  { id: 'khao-man-gai', categoryId: 'rice', name: 'Khao man gai', description: 'Poached chicken, garlic rice, ginger-soy sauce and broth.', price: baht(89), optionGroups: [extras] },
  { id: 'pineapple-rice', categoryId: 'rice', name: 'Pineapple fried rice', description: 'Served in the pineapple with cashews and raisins.', price: baht(149), optionGroups: [protein] },

  { id: 'green-curry', categoryId: 'curries', name: 'Green curry', description: 'Coconut green curry with Thai eggplant and basil.', price: baht(159), optionGroups: [protein, spice] },
  { id: 'massaman', categoryId: 'curries', name: 'Massaman beef', description: 'Slow-cooked beef, potato and peanuts in mild curry.', price: baht(179) },
  { id: 'tom-yum', categoryId: 'curries', name: 'Tom yum goong', description: 'Hot and sour shrimp soup with lemongrass and galangal.', price: baht(199), recommended: true, optionGroups: [spice] },

  { id: 'thai-tea', categoryId: 'drinks', name: 'Thai iced tea', description: 'Strong black tea with condensed milk.', price: baht(65), optionGroups: [sweetness] },
  { id: 'coconut', categoryId: 'drinks', name: 'Fresh coconut', description: 'Chilled young coconut.', price: baht(80) },
  { id: 'lime-soda', categoryId: 'drinks', name: 'Lime soda', description: 'Fresh lime, soda, a pinch of salt.', price: baht(55), optionGroups: [sweetness] },
  { id: 'singha', categoryId: 'drinks', name: 'Singha beer', description: '330 ml bottle.', price: baht(120) },

  { id: 'mango-sticky-rice', categoryId: 'desserts', name: 'Mango sticky rice', description: 'Ripe mango, sweet coconut sticky rice.', price: baht(129), recommended: true },
  { id: 'coconut-ice-cream', categoryId: 'desserts', name: 'Coconut ice cream', description: 'With roasted peanuts and sticky rice.', price: baht(79) },
]

// Every menu item has a sample photo at /menu/<id>.jpg (see photoCredits.ts) and sample dietary info
export const MENU: MenuItem[] = MENU_ITEMS.map((m) => ({ ...m, image: `/menu/${m.id}.jpg`, ...MENU_DIETARY[m.id] }))

export const MENU_BY_ID: Record<string, MenuItem> = Object.fromEntries(MENU.map((m) => [m.id, m]))
