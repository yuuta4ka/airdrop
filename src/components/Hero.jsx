export default function Hero() {
  return (
    <section className="hero">
      <div className="container hero__content">
        <div className="hero__badge">
          <span className="hero__badge-dot" />
          Оригинальная техника с гарантией
        </div>

        <h1 className="hero__title">
          Техника Apple & Samsung<br />
          <span>под заказ за 3–4 дня</span>
        </h1>

        <p className="hero__subtitle">
          iPhone, iPad, Samsung Galaxy, Apple Watch и Samsung Watch —
          только оригинал, лучшие цены и официальная гарантия в магазине АирДроп.
          Все устройства привозим под заказ.
        </p>

        <div className="hero__stats">
          <div className="hero__stat">
            <div className="hero__stat-value">17+</div>
            <div className="hero__stat-label">моделей в каталоге</div>
          </div>
          <div className="hero__stat">
            <div className="hero__stat-value">3–4 дня</div>
            <div className="hero__stat-label">под заказ</div>
          </div>
          <div className="hero__stat">
            <div className="hero__stat-value">12 мес.</div>
            <div className="hero__stat-label">гарантия</div>
          </div>
          <div className="hero__stat">
            <div className="hero__stat-value">4.9 ★</div>
            <div className="hero__stat-label">рейтинг клиентов</div>
          </div>
        </div>
      </div>
    </section>
  )
}
