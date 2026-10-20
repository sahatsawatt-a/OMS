// Dietary labels and allergens, as marked on Ying Thai 2's printed menu.
// Diners are told to check allergies with staff.
import type { Allergen, DietaryTag } from './types'

export const DIETARY_LABEL: Record<DietaryTag, string> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  'vegetarian-option': 'Vegetarian option',
  halal: 'Halal',
  'gluten-free': 'Gluten free',
  spicy: 'Spicy',
}

export const ALLERGEN_LABEL: Record<Allergen, string> = {
  dairy: 'dairy',
  peanuts: 'peanuts',
  'tree-nuts': 'cashew / tree nuts',
  shellfish: 'shellfish',
  egg: 'egg',
}

/** 'vegetarian-option' = can be made with vegetables instead of meat */
export function allergenSentence(allergens: Allergen[]): string {
  const names = allergens.map((a) => ALLERGEN_LABEL[a])
  if (names.length === 0) return ''
  if (names.length === 1) return `Contains ${names[0]}`
  return `Contains ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}
