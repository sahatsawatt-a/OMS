// The look of the app, chosen per device. index.html applies it before the first paint;
// a ?design= link (e.g. on a table QR) overrides the saved choice for that visit.
import { useSyncExternalStore } from 'react'

export type Design = 'classic' | 'heritage' | 'night'

/** Each design is a template of its own (layout and structure), with its own colours */
export const DESIGNS: { id: Design; name: string; note: string }[] = [
  { id: 'classic', name: 'Classic', note: 'One scrolling list with a section bar; the order stays beside the menu on wide screens' },
  { id: 'heritage', name: 'Menu book', note: 'Like the printed menu: one section per page, numbered dishes, cream, navy and gold' },
  { id: 'night', name: 'Photo feed', note: 'Like a delivery app: photo carousels, bottom tabs, dark and gold like the logo' },
]

const STORAGE_KEY = 'oms-design'
/** The familiar list is the default; the other templates are a tap away */
const DEFAULT: Design = 'classic'

const isDesign = (v: unknown): v is Design => DESIGNS.some((d) => d.id === v)

function initial(): Design {
  const fromPage = document.documentElement.dataset.design
  if (isDesign(fromPage)) return fromPage
  return DEFAULT
}

let current: Design = initial()
document.documentElement.dataset.design = current
const listeners = new Set<() => void>()

export function setDesign(design: Design) {
  current = design
  document.documentElement.dataset.design = design
  try {
    localStorage.setItem(STORAGE_KEY, design)
  } catch {
    // Not saved; the choice still applies until the page is reloaded
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useDesign(): Design {
  return useSyncExternalStore(subscribe, () => current)
}
