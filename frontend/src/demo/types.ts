// Domain types shared by the screens. The backend API (backend/app/schemas.py) returns
// exactly these shapes: camelCase, money in cents, times in epoch milliseconds.

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
  /** Thai name, as on the printed menu */
  nameTh?: string
}

export type DietaryTag = 'vegetarian' | 'vegan' | 'vegetarian-option' | 'halal' | 'gluten-free' | 'spicy'
export type Allergen = 'dairy' | 'peanuts' | 'tree-nuts' | 'shellfish' | 'egg'

export type MenuItem = {
  id: string
  categoryId: string
  /** Dish number on the printed menu */
  number?: number
  name: string
  /** Thai name, as on the printed menu */
  nameTh?: string
  description: string
  /** Price in cents */
  price: number
  /**
   * Guest menu: the photo to show, picked by the photo settings. Staff menu (admin page): the
   * dish's own photo, as saved.
   */
  image?: string
  /** Guest menu: set when the photo shown is an open-source one, which must be credited */
  imageCredit?: PhotoCredit
  /** Staff menu: the dish's open-source stand-in photo, if it has one */
  openPhoto?: PhotoCredit & { url: string }
  recommended?: boolean
  optionGroups?: OptionGroup[]
  dietary?: DietaryTag[]
  allergens?: Allergen[]
  /** Hidden dishes stay in past orders but are not shown on the menu */
  hidden?: boolean
}

/** Who took an open-source photo, and its licence */
export type PhotoCredit = {
  author: string
  license: string
  licenseUrl: string
  source: string
}

/**
 * Which dish photos guests see. Both: the restaurant's own where there is one, open-source for
 * the rest. Open-source only: every printed-menu dish. Neither: a text-only menu.
 */
export type PhotoSources = {
  /** Cut from the printed menu, or uploaded on the admin page */
  restaurant: boolean
  /** From Wikimedia Commons */
  openSource: boolean
}

export type MenuData = {
  categories: MenuCategory[]
  items: MenuItem[]
  /** Option groups an admin can attach to a dish */
  optionGroups?: OptionGroup[]
  soldOut?: string[]
  photoSources?: PhotoSources
}

export type SelectedOption = {
  /** Ids let the server price the option; names and price are what the guest saw */
  groupId?: string
  choiceId?: string
  groupName: string
  choiceName: string
  price: number
}

/** No kitchen screen for now: paid food is brought to the table and marked served */
export type ItemStatus = 'submitted' | 'served' | 'cancelled'

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

export type PaymentMethod = 'stripe' | 'cash' | 'card_terminal'

/** Card types the Payments report splits by (REQ-39) */
export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'eftpos' | 'other'

/**
 * Pay first: an order goes through only once paid.
 * awaiting_counter = guest chose "Pay at counter" and staff have not confirmed payment yet;
 * cancelled = never paid (e.g. guest left), so nothing was made.
 */
export type OrderPayment = {
  status: 'awaiting_counter' | 'paid' | 'cancelled'
  /** What was actually paid, after any discount; the bill was amount + discount */
  amount: number
  method?: PaymentMethod
  /** Taken off at the counter, in cents */
  discount?: number
  /** Card payments: which card type paid (from Stripe on the phone, picked by staff at the counter); missing for cash and older orders */
  cardBrand?: CardBrand
  paidAt?: number
  cancelledAt?: number
  /** Stripe PaymentIntent id for phone payments */
  intentId?: string
}

/** What a guest's phone shows (GET /api/guest/state): its table, its own letter, the table's orders */
export type GuestState = {
  session: GuestSession
  /** This phone's letter at the table: A, B, C... (REQ-37) */
  device: string
  orders: Order[]
  menu: MenuData
}

/** The table as a guest's phone sees it: no QR token */
export type GuestSession = {
  tableNumber: number
  guests: number
  status: 'open' | 'closed'
  openedAt: number
  closedAt?: number
  waiterCalledAt?: number
}

export type Order = {
  id: string
  /** Short number guests show at the counter, unique per day */
  number: number
  /** Staff only: guests never see the table's QR token */
  sessionToken?: string
  /** The phone that placed it (A, B, ...); missing for orders from before phones had letters */
  device?: string
  tableNumber: number
  round: number
  createdAt: number
  items: OrderItem[]
  payment: OrderPayment
}

/** A phone that joined a table (REQ-37) */
export type TableDevice = {
  label: string
  joinedAt: number
  /** Staff removed it; its token no longer works */
  removedAt?: number
}

/** A table session as staff see it, QR token included */
export type TableSession = {
  /** Staff actions address the session by id, so the QR token never appears in a URL */
  id: number
  token: string
  tableId: string
  tableNumber: number
  guests: number
  status: 'open' | 'closed'
  openedAt: number
  closedAt?: number
  waiterCalledAt?: number
  devices?: TableDevice[]
}

/** What the staff screens show (GET /api/staff/state) */
export type DemoState = {
  tables: Table[]
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
