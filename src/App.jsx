import { useState, useCallback } from 'react'
import Header from './components/Header'
import Hero from './components/Hero'
import Categories from './components/Categories'
import ProductCard from './components/ProductCard'
import Cart from './components/Cart'
import Features from './components/Features'
import Footer from './components/Footer'
import { products } from './data/products'

export default function App() {
  const [category, setCategory] = useState('all')
  const [cartOpen, setCartOpen] = useState(false)
  const [cart, setCart] = useState([])
  const [toast, setToast] = useState('')

  const filtered = category === 'all'
    ? products
    : products.filter((p) => p.category === category)

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0)

  const showToast = useCallback((message) => {
    setToast(message)
    setTimeout(() => setToast(''), 2500)
  }, [])

  const addToCart = useCallback((product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, qty: item.qty + 1 }
            : item
        )
      }
      return [...prev, { product, qty: 1 }]
    })
    showToast(`${product.name} добавлен в корзину`)
  }, [showToast])

  const updateQty = useCallback((id, qty) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((item) => item.product.id !== id))
    } else {
      setCart((prev) =>
        prev.map((item) =>
          item.product.id === id ? { ...item, qty } : item
        )
      )
    }
  }, [])

  const removeFromCart = useCallback((id) => {
    setCart((prev) => prev.filter((item) => item.product.id !== id))
  }, [])

  const isInCart = (id) => cart.some((item) => item.product.id === id)

  return (
    <>
      <Header cartCount={cartCount} onCartOpen={() => setCartOpen(true)} />
      <main>
        <Hero />
        <Categories active={category} onChange={setCategory} />
        <section className="products" id="catalog">
          <div className="container">
            <div className="products__header">
              <h2 className="products__title">Каталог</h2>
              <span className="products__count">{filtered.length} товаров</span>
            </div>
            <div className="products__grid">
              {filtered.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  inCart={isInCart(product.id)}
                  onAdd={addToCart}
                />
              ))}
            </div>
          </div>
        </section>
        <Features />
      </main>
      <Footer />

      <Cart
        isOpen={cartOpen}
        items={cart}
        onClose={() => setCartOpen(false)}
        onUpdateQty={updateQty}
        onRemove={removeFromCart}
      />

      <div className={`toast${toast ? ' toast--visible' : ''}`}>
        {toast}
      </div>
    </>
  )
}
