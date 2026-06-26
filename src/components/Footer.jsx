export default function Footer() {
  return (
    <footer className="footer" id="contacts">
      <div className="container">
        <div className="footer__grid">
          <div className="footer__brand">
            <a href="#" className="logo">
              <div className="logo__icon">✈</div>
              <span className="logo__text">АирДроп</span>
            </a>
            <p>
              Магазин оригинальной техники Apple и Samsung.
              Лучшие цены, быстрая доставка и официальная гарантия.
            </p>
          </div>

          <div className="footer__col">
            <h4>Каталог</h4>
            <ul>
              <li><a href="#catalog">iPhone</a></li>
              <li><a href="#catalog">iPad</a></li>
              <li><a href="#catalog">Samsung</a></li>
              <li><a href="#catalog">Apple Watch</a></li>
              <li><a href="#catalog">Samsung Watch</a></li>
            </ul>
          </div>

          <div className="footer__col">
            <h4>Покупателям</h4>
            <ul>
              <li><a href="#">Доставка и оплата</a></li>
              <li><a href="#">Гарантия</a></li>
              <li><a href="#">Обмен и возврат</a></li>
              <li><a href="#">Рассрочка</a></li>
            </ul>
          </div>

          <div className="footer__col">
            <h4>Контакты</h4>
            <ul>
              <li><a href="tel:+78001234567">8 (800) 123-45-67</a></li>
              <li><a href="mailto:info@airdrop.ru">info@airdrop.ru</a></li>
              <li><a href="#">Москва, ул. Тверская, 1</a></li>
              <li><a href="#">Пн–Вс: 10:00–21:00</a></li>
            </ul>
          </div>
        </div>

        <div className="footer__bottom">
          <span>© 2026 АирДроп. Все права защищены.</span>
          <span>Apple и Samsung — зарегистрированные торговые марки</span>
        </div>
      </div>
    </footer>
  )
}
