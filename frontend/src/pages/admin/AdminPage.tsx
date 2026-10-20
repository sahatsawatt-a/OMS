import { useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/shared'
import { ALLERGEN_LABEL, DIETARY_LABEL } from '../../demo/dietary'
import { RESTAURANT_NAME } from '../../demo/mockData'
import { formatAUD } from '../../demo/money'
import { actions, newMenuItemId, useDemoState } from '../../demo/store'
import type { Allergen, DietaryTag, MenuCategory, MenuItem, OptionGroup } from '../../demo/types'
import ReportsView from './ReportsView'
import './admin.css'

const ALL = 'all'

export default function AdminPage() {
  const demo = useDemoState()
  const { categories, items } = demo.menu
  const [selected, setSelected] = useState<string>(ALL)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<MenuItem | 'new' | null>(null)
  const [categorySheet, setCategorySheet] = useState<MenuCategory | 'new' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'reports' ? 'reports' : 'menu'

  const category = categories.find((c) => c.id === selected)
  const ordered = useMemo(() => new Set(demo.orders.flatMap((o) => o.items.map((i) => i.menuItemId))), [demo.orders])
  const photos = useMemo(
    () => items.flatMap((m) => (m.image?.startsWith('/menu/') ? [{ name: m.name, url: m.image }] : [])),
    [items],
  )

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items
      .filter((m) => selected === ALL || m.categoryId === selected)
      .filter((m) => !q || `${m.name} ${m.description}`.toLowerCase().includes(q))
      .sort((a, b) => categories.findIndex((c) => c.id === a.categoryId) - categories.findIndex((c) => c.id === b.categoryId))
  }, [items, categories, selected, query])

  const flash = (text: string) => {
    setNotice(text)
    window.setTimeout(() => setNotice(null), 3000)
  }

  return (
    <div className="admin">
      <header className="topbar">
        <Link to="/" className="brand">
          OMS
        </Link>
        <span className="topbar-title">Admin</span>
        <nav>
          <Link to="/staff">
            Front of house <Icon name="arrowRight" size={16} />
          </Link>
        </nav>
      </header>

      <nav className="admin-tabs" aria-label="Admin sections">
        <button className={tab === 'menu' ? 'active' : ''} aria-current={tab === 'menu' ? 'page' : undefined} onClick={() => setParams({})}>
          Menu
        </button>
        <button
          className={tab === 'reports' ? 'active' : ''}
          aria-current={tab === 'reports' ? 'page' : undefined}
          onClick={() => setParams({ tab: 'reports' })}
        >
          Reports
        </button>
      </nav>

      {tab === 'reports' ? (
        <div className="admin-reports">
          <div className="admin-head">
            <div>
              <div className="admin-eyebrow">{RESTAURANT_NAME}</div>
              <h1>Reports</h1>
            </div>
          </div>
          <ReportsView state={demo} />
        </div>
      ) : (
        <div className="admin-body">
          <aside className="admin-cats" aria-label="Categories">
            <button className={selected === ALL ? 'active' : ''} onClick={() => setSelected(ALL)}>
              <span>All dishes</span>
              <span className="count">{items.length}</span>
            </button>
            {categories.map((c) => (
              <button key={c.id} className={selected === c.id ? 'active' : ''} onClick={() => setSelected(c.id)}>
                <span>{c.name}</span>
                <span className="count">{items.filter((m) => m.categoryId === c.id).length}</span>
              </button>
            ))}
            <button className="add-cat" onClick={() => setCategorySheet('new')}>
              <Icon name="plus" size={16} /> Add category
            </button>
          </aside>

          <main className="admin-main">
            <div className="admin-head">
              <div>
                <div className="admin-eyebrow">{RESTAURANT_NAME}</div>
                <h1>{category ? category.name : 'All dishes'}</h1>
              </div>
              {category && (
                <div className="row gap wrap">
                  <button className="btn btn-sm btn-outline" onClick={() => setCategorySheet(category)}>
                    <Icon name="pencil" size={15} /> Rename
                  </button>
                  <button
                    className="btn btn-sm btn-outline icon-only"
                    aria-label="Move category up"
                    disabled={categories[0]?.id === category.id}
                    onClick={() => actions.moveCategory(category.id, -1)}
                  >
                    <Icon name="chevronUp" size={16} />
                  </button>
                  <button
                    className="btn btn-sm btn-outline icon-only"
                    aria-label="Move category down"
                    disabled={categories[categories.length - 1]?.id === category.id}
                    onClick={() => actions.moveCategory(category.id, 1)}
                  >
                    <Icon name="chevronDown" size={16} />
                  </button>
                  <button
                    className="btn btn-sm btn-outline"
                    disabled={items.some((m) => m.categoryId === category.id)}
                    title={items.some((m) => m.categoryId === category.id) ? 'Move or delete its dishes first' : undefined}
                    onClick={async () => {
                      if (confirm(`Delete the category “${category.name}”?`) && (await actions.deleteCategory(category.id))) {
                        setSelected(ALL)
                        flash('Category deleted')
                      }
                    }}
                  >
                    <Icon name="trash" size={15} /> Delete
                  </button>
                </div>
              )}
            </div>

            <div className="admin-toolbar">
              <label className="admin-search">
                <Icon name="search" size={17} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a dish" aria-label="Find a dish" />
              </label>
              <button className="btn btn-primary" onClick={() => setEditing('new')} disabled={categories.length === 0}>
                <Icon name="plus" size={16} /> Add dish
              </button>
            </div>

            {shown.length === 0 ? (
              <p className="admin-empty">{query ? 'No dishes match.' : 'No dishes in this category yet.'}</p>
            ) : (
              <ul className="admin-list">
                {shown.map((m) => {
                  const out = demo.soldOut.includes(m.id)
                  return (
                    <li key={m.id} className={`admin-row ${m.hidden ? 'is-hidden' : ''}`}>
                      <button className="admin-row-main" onClick={() => setEditing(m)}>
                        {m.image ? <img src={m.image} alt="" loading="lazy" /> : <span className="no-photo"><Icon name="image" size={18} /></span>}
                        <span className="admin-row-text">
                          <span className="admin-row-name">
                            {m.name}
                            {m.recommended && <span className="tag">Popular</span>}
                          </span>
                          <span className="admin-row-meta">
                            {selected === ALL && <>{categories.find((c) => c.id === m.categoryId)?.name ?? 'No category'} · </>}
                            {m.description || 'No description'}
                          </span>
                        </span>
                        <span className="admin-row-price">{formatAUD(m.price)}</span>
                      </button>
                      <div className="admin-row-actions">
                        {m.hidden ? (
                          <span className="state state-hidden">Hidden</span>
                        ) : (
                          <button
                            className={`state-toggle ${out ? 'is-out' : ''}`}
                            onClick={() => actions.toggleSoldOut(m.id)}
                            aria-pressed={out}
                            title={out ? 'Mark as available' : 'Mark as sold out'}
                          >
                            {out ? 'Sold out' : 'Available'}
                          </button>
                        )}
                        <button className="icon-btn" aria-label={`Edit ${m.name}`} onClick={() => setEditing(m)}>
                          <Icon name="pencil" size={16} />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            <footer className="admin-foot">
              <p className="muted small">
                Changes are saved to the server and appear on every guest's menu within a few seconds.
              </p>
              <button
                className="btn btn-sm btn-ghost"
                onClick={async () => {
                  if (confirm('Put the sample menu back? Your menu changes will be lost.')) {
                    await actions.resetMenu()
                    setSelected(ALL)
                    flash('Sample menu restored')
                  }
                }}
              >
                Reset to sample menu
              </button>
            </footer>
          </main>
        </div>
      )}

      {editing && (
        <ItemEditor
          item={editing === 'new' ? undefined : editing}
          categories={categories}
          defaultCategory={selected === ALL ? categories[0]?.id : selected}
          soldOut={editing !== 'new' && demo.soldOut.includes(editing.id)}
          wasOrdered={editing !== 'new' && ordered.has(editing.id)}
          optionGroups={demo.menu.optionGroups ?? []}
          photos={photos}
          onClose={() => setEditing(null)}
          onSaved={(name, isNew) => {
            setEditing(null)
            flash(isNew ? `Added “${name}”` : `Saved “${name}”`)
          }}
          onDeleted={(name) => {
            setEditing(null)
            flash(`Deleted “${name}”`)
          }}
        />
      )}

      {categorySheet && (
        <CategorySheet
          category={categorySheet === 'new' ? undefined : categorySheet}
          onClose={() => setCategorySheet(null)}
          onSave={async (name) => {
            if (categorySheet === 'new') {
              const id = await actions.addCategory(name)
              if (id) setSelected(id)
            } else await actions.renameCategory(categorySheet.id, name)
            setCategorySheet(null)
          }}
        />
      )}

      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  )
}

function CategorySheet({ category, onClose, onSave }: { category?: MenuCategory; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(category?.name ?? '')
  const valid = name.trim().length > 0
  return (
    <Sheet
      title={category ? 'Rename category' : 'Add category'}
      onClose={onClose}
      footer={
        <button className="btn btn-primary btn-block" disabled={!valid} onClick={() => onSave(name.trim())}>
          {category ? 'Save' : 'Add category'}
        </button>
      }
    >
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus placeholder="e.g. Specials" />
      </label>
    </Sheet>
  )
}

const DIETARY: DietaryTag[] = ['gluten-free', 'spicy', 'vegetarian', 'vegan', 'vegetarian-option', 'halal']
const ALLERGENS: Allergen[] = ['dairy', 'peanuts', 'tree-nuts', 'shellfish', 'egg']

/** Read a photo file and shrink it to a small JPEG data URL, stored with the dish on the server */
function resizePhoto(file: File, maxSide = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That file is not a photo this browser can read.'))
    }
    img.src = url
  })
}

function ItemEditor({
  item,
  categories,
  defaultCategory,
  soldOut,
  wasOrdered,
  optionGroups,
  photos,
  onClose,
  onSaved,
  onDeleted,
}: {
  item?: MenuItem
  categories: MenuCategory[]
  defaultCategory?: string
  soldOut: boolean
  wasOrdered: boolean
  optionGroups: OptionGroup[]
  /** The restaurant's own dish photos, to reuse on another dish */
  photos: { name: string; url: string }[]
  onClose: () => void
  onSaved: (name: string, isNew: boolean) => void
  onDeleted: (name: string) => void
}) {
  const [name, setName] = useState(item?.name ?? '')
  const [nameTh, setNameTh] = useState(item?.nameTh ?? '')
  const [number, setNumber] = useState(item?.number ? String(item.number) : '')
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? defaultCategory ?? '')
  const [price, setPrice] = useState(item ? (item.price / 100).toFixed(2).replace(/\.00$/, '') : '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [image, setImage] = useState(item?.image ?? '')
  const [recommended, setRecommended] = useState(!!item?.recommended)
  const [dietary, setDietary] = useState<DietaryTag[]>(item?.dietary ?? [])
  const [allergens, setAllergens] = useState<Allergen[]>(item?.allergens ?? [])
  const [groups, setGroups] = useState<string[]>(item?.optionGroups?.map((g) => g.id) ?? [])
  const [out, setOut] = useState(soldOut)
  const [hidden, setHidden] = useState(!!item?.hidden)
  const [showSamples, setShowSamples] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const cents = Math.round(parseFloat(price.replace(/[^0-9.]/g, '')) * 100)
  const problems = [
    !name.trim() && 'Give the dish a name.',
    !categoryId && 'Choose a category.',
    !(cents > 0) && 'Enter a price above $0.',
  ].filter(Boolean) as string[]

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

  const save = async () => {
    if (problems.length) {
      setError(problems.join(' '))
      return
    }
    const next: MenuItem = {
      id: item?.id ?? newMenuItemId(name),
      categoryId,
      number: /^\d+$/.test(number.trim()) ? Number(number.trim()) : undefined,
      name: name.trim(),
      nameTh: nameTh.trim() || undefined,
      description: description.trim(),
      price: cents,
      image: image || undefined,
      recommended: recommended || undefined,
      optionGroups: optionGroups.filter((g) => groups.includes(g.id)),
      dietary: DIETARY.filter((d) => dietary.includes(d)),
      allergens: ALLERGENS.filter((a) => allergens.includes(a)),
      hidden: hidden || undefined,
    }
    setSaving(true)
    const saved = await actions.saveMenuItem(next, out)
    setSaving(false)
    if (!saved) {
      setError('The change was not saved. Check the message at the top of the page and try again.')
      return
    }
    onSaved(next.name, !item)
  }

  const onFile = async (file?: File) => {
    if (!file) return
    try {
      setImage(await resizePhoto(file))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Sheet
      title={item ? 'Edit dish' : 'Add dish'}
      onClose={onClose}
      footer={
        <div className="row gap editor-footer">
          {item && (
            <button
              className="btn btn-ghost danger"
              onClick={async () => {
                if (wasOrdered) {
                  setHidden(true)
                  setError('This dish is in past orders, so it can’t be deleted. It is set to hidden instead; press Save to keep that.')
                  return
                }
                if (confirm(`Delete “${item.name}”? This can’t be undone.`) && (await actions.deleteMenuItem(item.id))) onDeleted(item.name)
              }}
            >
              <Icon name="trash" size={16} /> Delete
            </button>
          )}
          <span className="grow" />
          <button className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : item ? 'Save' : 'Add dish'}
          </button>
        </div>
      }
    >
      <div className="editor">
        <div className="editor-photo">
          {image ? <img src={image} alt="" /> : <div className="no-photo big"><Icon name="image" size={28} /><span>No photo</span></div>}
          <div className="row gap wrap">
            <button className="btn btn-sm btn-outline" onClick={() => fileInput.current?.click()}>
              <Icon name="upload" size={15} /> Upload photo
            </button>
            <button className="btn btn-sm btn-outline" onClick={() => setShowSamples((s) => !s)}>
              <Icon name="image" size={15} /> Menu photos
            </button>
            {image && (
              <button className="btn btn-sm btn-ghost" onClick={() => setImage('')}>
                Remove
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              void onFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          {showSamples && (
            <div className="sample-grid" role="listbox" aria-label="Sample photos">
              {photos.map((p) => (
                <button
                  key={p.url}
                  className={image === p.url ? 'active' : ''}
                  title={p.name}
                  aria-label={p.name}
                  onClick={() => {
                    setImage(p.url)
                    setShowSamples(false)
                  }}
                >
                  <img src={p.url} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Larb gai" />
        </label>
        <div className="editor-two">
          <label className="field">
            <span>Thai name</span>
            <input value={nameTh} onChange={(e) => setNameTh(e.target.value)} maxLength={80} lang="th" placeholder="e.g. ลาบไก่" />
          </label>
          <label className="field">
            <span>Number on the printed menu</span>
            <input value={number} onChange={(e) => setNumber(e.target.value)} inputMode="numeric" maxLength={4} placeholder="e.g. 27" />
          </label>
        </div>
        <div className="editor-two">
          <label className="field">
            <span>Category</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {!categoryId && <option value="">Choose…</option>}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Price (AUD, incl. GST)</span>
            <div className="price-input">
              <span>$</span>
              <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="0.00" />
            </div>
          </label>
        </div>
        <label className="field">
          <span>Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={160} rows={2} placeholder="A short line for the menu" />
        </label>

        <fieldset className="editor-group">
          <legend>On the menu</legend>
          <label className="check">
            <input type="checkbox" checked={recommended} onChange={(e) => setRecommended(e.target.checked)} /> Show as Popular
          </label>
          <label className="check">
            <input type="checkbox" checked={out} onChange={(e) => setOut(e.target.checked)} /> Sold out today
          </label>
          <label className="check">
            <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> Hidden from the menu
          </label>
        </fieldset>

        <fieldset className="editor-group">
          <legend>Dietary</legend>
          <div className="check-grid">
            {DIETARY.map((d) => (
              <label key={d} className="check">
                <input type="checkbox" checked={dietary.includes(d)} onChange={() => setDietary((l) => toggle(l, d))} /> {DIETARY_LABEL[d]}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="editor-group">
          <legend>Contains</legend>
          <div className="check-grid">
            {ALLERGENS.map((a) => (
              <label key={a} className="check">
                <input type="checkbox" checked={allergens.includes(a)} onChange={() => setAllergens((l) => toggle(l, a))} />{' '}
                {ALLERGEN_LABEL[a].charAt(0).toUpperCase() + ALLERGEN_LABEL[a].slice(1)}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="editor-group">
          <legend>Choices for guests</legend>
          {optionGroups.map((g) => (
            <label key={g.id} className="check">
              <input type="checkbox" checked={groups.includes(g.id)} onChange={() => setGroups((l) => toggle(l, g.id))} />
              <span>
                {g.name}
                <span className="muted small">
                  {' '}
                  · {g.choices.map((c) => (c.price ? `${c.name} +${formatAUD(c.price)}` : c.name)).join(', ')}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        {error && <p className="editor-error">{error}</p>}
      </div>
    </Sheet>
  )
}
