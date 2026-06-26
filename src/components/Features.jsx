const features = [
  {
    icon: '✓',
    title: '100% оригинал',
    text: 'Только официальная техника Apple и Samsung с серийными номерами',
  },
  {
    icon: '📦',
    title: 'Под заказ 3–4 дня',
    text: 'Все устройства привозим под заказ. Отправка по всей России',
  },
  {
    icon: '🛡',
    title: 'Гарантия 12 месяцев',
    text: 'Официальная гарантия производителя и сервисное обслуживание',
  },
  {
    icon: '💳',
    title: 'Удобная оплата',
    text: 'Наличные, карта, рассрочка 0% до 24 месяцев',
  },
]

export default function Features() {
  return (
    <section className="features" id="features">
      <div className="container">
        <div className="features__grid">
          {features.map((f) => (
            <div key={f.title} className="feature">
              <div className="feature__icon">{f.icon}</div>
              <h3 className="feature__title">{f.title}</h3>
              <p className="feature__text">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
