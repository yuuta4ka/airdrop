import { formatPrice } from '../data/products'

export default function Header({ cartCount, onCartOpen }) {
  return (
    <header className="header">
      <div className="container header__inner">
        <a href="#" className="logo">
          <div className="logo__icon">✈</div>
          <span className="logo__text">АирДроп</span>
        </a>

        <nav className="nav">
          <a href="#catalog" className="nav__link">Каталог</a>
          <a href="#features" className="nav__link">Преимущества</a>
          <a href="#contacts" className="nav__link">Контакты</a>
        </nav>

        <div className="header__actions">
          <button className="cart-btn" onClick={onCartOpen} aria-label="Корзина">
            🛒
            {cartCount > 0 && (
              <span className="cart-btn__badge">{cartCount}</span>
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
