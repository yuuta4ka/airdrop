import { formatPrice } from '../data/products'

function badgeClass(badge) {
  if (badge === 'Скидка') return 'product-card__badge product-card__badge--sale'
  if (badge === 'Премиум') return 'product-card__badge product-card__badge--premium'
  return 'product-card__badge'
}

export default function ProductCard({ product, inCart, onAdd }) {
  return (
    <article className="product-card">
      <div
        className="product-card__image"
        style={{ background: `linear-gradient(160deg, ${product.color}33 0%, ${product.color}11 100%)` }}
      >
        {product.badge && (
          <span className={badgeClass(product.badge)}>{product.badge}</span>
        )}
        <span className="product-card__emoji">{product.emoji}</span>
      </div>

      <div className="product-card__body">
        <div className="product-card__brand">{product.brand}</div>
        <h3 className="product-card__name">{product.name}</h3>

        <div className="product-card__specs">
          {product.specs.map((spec) => (
            <span key={spec} className="product-card__spec">{spec}</span>
          ))}
        </div>

        <div className="product-card__footer">
          <div className="product-card__prices">
            <span className="product-card__price">{formatPrice(product.price)}</span>
            {product.oldPrice && (
              <span className="product-card__old-price">{formatPrice(product.oldPrice)}</span>
            )}
          </div>
          <button
            className={`product-card__add${inCart ? ' product-card__add--added' : ''}`}
            onClick={() => onAdd(product)}
          >
            {inCart ? '✓ В корзине' : 'В корзину'}
          </button>
        </div>
      </div>
    </article>
  )
}
