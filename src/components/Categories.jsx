import { categories } from '../data/products'

export default function Categories({ active, onChange }) {
  return (
    <section className="categories">
      <div className="container">
        <div className="categories__list">
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`category-btn${active === cat.id ? ' category-btn--active' : ''}`}
              onClick={() => onChange(cat.id)}
            >
              <span>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
