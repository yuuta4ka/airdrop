import { formatPrice } from '../data/products'

export default function Cart({ isOpen, items, onClose, onUpdateQty, onRemove }) {
  const total = items.reduce((sum, item) => sum + item.product.price * item.qty, 0)
  const totalCount = items.reduce((sum, item) => sum + item.qty, 0)

  return (
    <>
      <div
        className={`cart-overlay${isOpen ? ' cart-overlay--open' : ''}`}
        onClick={onClose}
      />
      <aside className={`cart${isOpen ? ' cart--open' : ''}`}>
        <div className="cart__header">
          <h2 className="cart__title">Корзина {totalCount > 0 && `(${totalCount})`}</h2>
          <button className="cart__close" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>

        <div className="cart__items">
          {items.length === 0 ? (
            <div className="cart__empty">
              <div className="cart__empty-icon">🛒</div>
              <p>Корзина пуста</p>
              <p style={{ fontSize: '0.85rem', marginTop: 8 }}>Добавьте товары из каталога</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.product.id} className="cart-item">
                <div className="cart-item__emoji">{item.product.emoji}</div>
                <div className="cart-item__info">
                  <div className="cart-item__name">{item.product.name}</div>
                  <div className="cart-item__price">{formatPrice(item.product.price)}</div>
                  <div className="cart-item__controls">
                    <button
                      className="cart-item__qty-btn"
                      onClick={() => onUpdateQty(item.product.id, item.qty - 1)}
                    >
                      −
                    </button>
                    <span className="cart-item__qty">{item.qty}</span>
                    <button
                      className="cart-item__qty-btn"
                      onClick={() => onUpdateQty(item.product.id, item.qty + 1)}
                    >
                      +
                    </button>
                    <button
                      className="cart-item__remove"
                      onClick={() => onRemove(item.product.id)}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="cart__footer">
          <div className="cart__total">
            <span className="cart__total-label">Итого</span>
            <span className="cart__total-value">{formatPrice(total)}</span>
          </div>
          <button className="cart__checkout" disabled={items.length === 0}>
            Оформить заказ
          </button>
        </div>
      </aside>
    </>
  )
}
