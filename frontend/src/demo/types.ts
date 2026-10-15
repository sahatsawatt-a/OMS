// Domain types for the frontend demo. They mirror the planned backend model
// (see docs/REQUIREMENTS.md) so the mock store can later be swapped for API calls.

export type Table = {
  id: string
  number: number
  seats: number
  zone: string
}

export type OptionChoice = {
  id: string
  name: string
  /** Extra price in cents (1 AUD = 100 cents) */
  price: number
}

export type OptionGroup = {
  id: string
  name: string
  /** single = pick exactly one, multi = pick any */
  type: 'single' | 'multi'
  choices: OptionChoice[]
}

export type MenuCategory = {
  id: string
  name: string
}

export type DietaryTag = 'vegetarian' | 'vegan' | 'vegetarian-option' | 'halal'
export type Allergen = 'dairy' | 'peanuts' | 'tree-nuts' | 'shellfish' | 'egg'

export type MenuItem = {
  id: string
  categoryId: string
  name: string
  description: string
  /** Price in cents */
  price: number
  /** Photo URL; the demo menu has none and shows a text-only layout */
  image?: string
  recommended?: boolean
  optionGroups?: OptionGroup[]
  dietary?: DietaryTag[]
  allergens?: Allergen[]
  /** Hidden dishes stay in past orders but are not shown on the menu */
  hidden?: boolean
}

export type MenuData = {
  categories: MenuCategory[]
  items: MenuItem[]
}

export type SelectedOption = {
  groupName: string
  choiceName: string
  price: number
}

export type ItemStatus = 'submitted' | 'preparing' | 'ready' | 'served' | 'cancelled'

export type OrderItem = {
  id: string
  menuItemId: string
  name: string
  /** Unit price at time of ordering, including options, in cents */
  unitPrice: number
  quantity: number
  options: SelectedOption[]
  note: string
  status: ItemStatus
}

export type Order = {
  id: string
  sessionToken: string
  tableNumber: number
  round: number
  createdAt: number
  items: OrderItem[]
}

export type PaymentMethod = 'stripe' | 'cash' | 'card_terminal'

export type TableSession = {
  token: string
  tableId: string
  tableNumber: number
  guests: number
  status: 'open' | 'closed'
  openedAt: number
  closedAt?: number
  waiterCalledAt?: number
  billRequestedAt?: number
  payment?: { method: PaymentMethod; amount: number; paidAt: number }
}

export type DemoState = {
  sessions: Record<string, TableSession>
  orders: Order[]
  soldOut: string[]
  menu: MenuData
}

export type CartLine = {
  id: string
  menuItemId: string
  name: string
  unitPrice: number
  quantity: number
  options: SelectedOption[]
  note: string
}
