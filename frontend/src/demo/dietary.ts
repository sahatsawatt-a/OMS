// Sample dietary and allergen information for the demo menu.
// Real values must come from the restaurant; diners are told to check allergies with staff.
import type { Allergen, DietaryTag } from './types'

export const DIETARY_LABEL: Record<DietaryTag, string> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  'vegetarian-option': 'Vegetarian option',
  halal: 'Halal',
}

export const ALLERGEN_LABEL: Record<Allergen, string> = {
  dairy: 'dairy',
  peanuts: 'peanuts',
  'tree-nuts': 'tree nuts',
  shellfish: 'shellfish',
  egg: 'egg',
}

/** 'vegetarian-option' = can be made vegetarian by choosing tofu */
export const MENU_DIETARY: Record<string, { dietary: DietaryTag[]; allergens: Allergen[] }> = {
  'spring-rolls': { dietary: ['vegetarian', 'vegan', 'halal'], allergens: [] },
  satay: { dietary: ['halal'], allergens: ['peanuts'] },
  'som-tam': { dietary: ['halal'], allergens: ['peanuts', 'shellfish'] },
  'pad-thai': { dietary: ['vegetarian-option'], allergens: ['peanuts', 'egg'] },
  'pad-see-ew': { dietary: ['vegetarian-option'], allergens: ['egg'] },
  'boat-noodles': { dietary: [], allergens: [] },
  'kra-pao': { dietary: ['vegetarian-option'], allergens: [] },
  'khao-man-gai': { dietary: ['halal'], allergens: [] },
  'pineapple-rice': { dietary: ['vegetarian-option'], allergens: ['tree-nuts', 'egg'] },
  'green-curry': { dietary: ['vegetarian-option'], allergens: [] },
  massaman: { dietary: ['halal'], allergens: ['peanuts'] },
  'tom-yum': { dietary: ['halal'], allergens: ['shellfish'] },
  'thai-tea': { dietary: ['vegetarian', 'halal'], allergens: ['dairy'] },
  coconut: { dietary: ['vegetarian', 'vegan', 'halal'], allergens: [] },
  'lime-soda': { dietary: ['vegetarian', 'vegan', 'halal'], allergens: [] },
  singha: { dietary: ['vegetarian', 'vegan'], allergens: [] },
  'mango-sticky-rice': { dietary: ['vegetarian', 'vegan', 'halal'], allergens: [] },
  'coconut-ice-cream': { dietary: ['vegetarian', 'halal'], allergens: ['dairy', 'peanuts'] },
}

export function allergenSentence(allergens: Allergen[]): string {
  const names = allergens.map((a) => ALLERGEN_LABEL[a])
  if (names.length === 0) return ''
  if (names.length === 1) return `Contains ${names[0]}`
  return `Contains ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}
