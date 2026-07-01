import { formatPrice } from './store.js'

export function parseCommission(value) {
  const m = String(value ?? '').replace(',', '.').match(/([\d.]+)/)
  return m ? parseFloat(m[1]) : 0
}

export function calcInstallmentTotal(price, commissionPercent) {
  return Math.round(price * (1 + commissionPercent / 100))
}

export function calcInstallmentMonthly(price, months, commissionPercent) {
  if (!months || months <= 0) return 0
  return Math.ceil(calcInstallmentTotal(price, commissionPercent) / months)
}

export function calcDolyamiPayments(price, commissionPercent, parts = 4) {
  const total = calcInstallmentTotal(price, commissionPercent)
  const payment = Math.ceil(total / parts)
  return { total, payment, parts }
}

export function buildInstallmentRows(price, terms) {
  return terms.map((term) => {
    const commission = parseCommission(term.commission)
    const monthly = calcInstallmentMonthly(price, term.months, commission)
    const total = calcInstallmentTotal(price, commission)
    return {
      months: term.months,
      commission: term.commission,
      commissionNum: commission,
      monthly,
      total,
    }
  })
}

const DOLYAMI_LOGO = `
  <svg class="dolyami-widget__logo" viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16" r="16" fill="#111111"/>
    <rect x="8.5" y="10" width="2.8" height="12" rx="1.2" fill="#ffffff"/>
    <rect x="12.8" y="8" width="2.8" height="14" rx="1.2" fill="#ffffff"/>
    <rect x="17.1" y="11" width="2.8" height="11" rx="1.2" fill="#ffffff"/>
    <rect x="21.4" y="9" width="2.8" height="13" rx="1.2" fill="#ffffff"/>
  </svg>
`

const DOLYAMI_LABELS = ['Оплата сегодня', 'Через 2 недели', 'Через 4 недели', 'Через 6 недель']
const MAX_CALC_PRICE = 1000000

export function parsePriceInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return 0
  return Math.min(Number(digits), MAX_CALC_PRICE)
}

function formatPriceInput(raw) {
  return raw ? new Intl.NumberFormat('ru-RU').format(raw) : ''
}

function bindPriceInput(input, onChange) {
  input.addEventListener('input', () => {
    const raw = parsePriceInput(input.value)
    const formatted = formatPriceInput(raw)
    if (input.value !== formatted) input.value = formatted
    onChange()
  })
}

export function linkPriceInputs(inputs, onUpdates = []) {
  const fields = inputs.filter(Boolean)
  if (!fields.length) return

  let syncing = false

  const apply = (source) => {
    if (syncing) return
    syncing = true
    const raw = parsePriceInput(source.value)
    const formatted = formatPriceInput(raw)
    if (source.value !== formatted) source.value = formatted
    fields.forEach((inp) => {
      if (inp !== source) inp.value = formatted
    })
    onUpdates.forEach((fn) => fn?.())
    syncing = false
  }

  fields.forEach((input) => {
    input.addEventListener('input', () => apply(input))
  })
}

function animateAmount(el, nextValue, duration = 420) {
  if (!el) return
  const from = Number(el.dataset.value || 0)
  const to = Math.round(nextValue)
  if (from === to) {
    el.textContent = formatPrice(to)
    el.dataset.value = String(to)
    return
  }

  el.classList.add('amount-animate')
  const start = performance.now()

  const tick = (now) => {
    const progress = Math.min(1, (now - start) / duration)
    const eased = 1 - (1 - progress) ** 3
    const current = Math.round(from + (to - from) * eased)
    el.textContent = formatPrice(current)
    if (progress < 1) {
      requestAnimationFrame(tick)
    } else {
      el.textContent = formatPrice(to)
      el.dataset.value = String(to)
      el.classList.remove('amount-animate')
      el.classList.add('amount-pop')
      setTimeout(() => el.classList.remove('amount-pop'), 320)
    }
  }

  requestAnimationFrame(tick)
}

export function renderInstallmentCalcHtml(price, installment, { compact = false } = {}) {
  const rows = buildInstallmentRows(price, installment.terms)
  const dolyamiCommission = parseCommission(installment.dolyami.commission)
  const dolyami = calcDolyamiPayments(price, dolyamiCommission)

  const priceBlock = compact
    ? `<p class="installment-calc__price">Стоимость: <strong>${formatPrice(price)}</strong></p>`
    : ''

  return `
    <div class="installment-calc${compact ? ' installment-calc--compact' : ''}">
      ${priceBlock}
      <h3 class="installment-calc__title">Рассрочка</h3>
      <div class="installment-calc__grid">
        ${rows.map((row) => `
          <div class="installment-calc__card">
            <span class="installment-calc__term">${row.months} мес.</span>
            <span class="installment-calc__monthly">${formatPrice(row.monthly)}<small>/мес</small></span>
            <span class="installment-calc__meta">комиссия ${row.commission} · итого ${formatPrice(row.total)}</span>
          </div>
        `).join('')}
      </div>
      <h3 class="installment-calc__title installment-calc__title--dolyami">${installment.dolyami.name}</h3>
      <div class="installment-calc__dolyami">
        <div class="installment-calc__dolyami-pay">
          <span>4 платежа по</span>
          <strong>${formatPrice(dolyami.payment)}</strong>
        </div>
        <span class="installment-calc__meta">комиссия ${installment.dolyami.commission} · итого ${formatPrice(dolyami.total)} · каждые 2 недели</span>
      </div>
    </div>
  `
}

export function mountInstallmentBankCalc(table, input, installment, { bindInput = true } = {}) {
  if (!table || !input) return () => {}

  const wrap = table.closest('.installment-table-wrap')
  const headTerms = table.querySelector('.installment-table__head-terms')
  const headCalc = table.querySelector('.installment-table__head-calc')
  const tbody = table.querySelector('tbody')

  const renderTerms = () => {
    table.dataset.mode = 'terms'
    headTerms?.removeAttribute('hidden')
    headCalc?.setAttribute('hidden', '')
    tbody.innerHTML = installment.terms.map((term) => `
      <tr>
        <td>${term.months} мес.</td>
        <td>${term.commission}</td>
      </tr>
    `).join('')
  }

  const renderCalc = (price) => {
    const rows = buildInstallmentRows(price, installment.terms)
    table.dataset.mode = 'calc'
    headTerms?.setAttribute('hidden', '')
    headCalc?.removeAttribute('hidden')
    tbody.innerHTML = rows.map((row) => `
      <tr>
        <td>${row.months} мес.</td>
        <td><span class="amount-cell" data-value="${row.monthly}">${formatPrice(row.monthly)}</span></td>
        <td><span class="amount-cell amount-cell--muted" data-value="${row.total}">${formatPrice(row.total)}</span></td>
      </tr>
    `).join('')
    wrap?.classList.add('installment-table-wrap--calc')
  }

  const update = () => {
    const price = parsePriceInput(input.value)
    if (price < 1000) {
      wrap?.classList.remove('installment-table-wrap--calc', 'is-animating')
      renderTerms()
      return
    }

    wrap?.classList.add('is-animating')
    const wasCalc = table.dataset.mode === 'calc'

    if (!wasCalc) {
      renderCalc(price)
      requestAnimationFrame(() => wrap?.classList.remove('is-animating'))
      return
    }

    const rows = buildInstallmentRows(price, installment.terms)
    const cells = tbody.querySelectorAll('.amount-cell')
    let i = 0
    rows.forEach((row) => {
      animateAmount(cells[i++], row.monthly)
      animateAmount(cells[i++], row.total)
    })
    requestAnimationFrame(() => wrap?.classList.remove('is-animating'))
  }

  if (bindInput) bindPriceInput(input, update)
  renderTerms()
  return update
}

export function mountDolyamiWidget(mount, input, installment, { bindInput = true } = {}) {
  if (!mount || !input) return () => {}

  const commission = parseCommission(installment.dolyami.commission)
  const defaultPrice = 4000

  mount.innerHTML = `
    <div class="dolyami-widget" id="dolyami-widget">
      <div class="dolyami-widget__header">
        <div class="dolyami-widget__brand">
          ${DOLYAMI_LOGO}
          <span class="dolyami-widget__name">${installment.dolyami.name}</span>
        </div>
        <div class="dolyami-widget__purchase">
          <span class="dolyami-widget__purchase-label">Сумма покупки:</span>
          <strong class="dolyami-widget__total" data-value="${defaultPrice}">${formatPrice(defaultPrice)}</strong>
        </div>
      </div>
      <div class="dolyami-widget__grid">
        ${DOLYAMI_LABELS.map((label, index) => `
          <div class="dolyami-widget__col${index === 0 ? ' dolyami-widget__col--active' : ''}">
            <span class="dolyami-widget__label">${label}</span>
            <strong class="dolyami-widget__amount" data-value="${defaultPrice / 4}">${formatPrice(defaultPrice / 4)}</strong>
            <span class="dolyami-widget__bar"><span class="dolyami-widget__bar-fill"></span></span>
          </div>
        `).join('')}
      </div>
      <p class="dolyami-widget__note">Комиссия ${installment.dolyami.commission} уже учтена в расчёте</p>
    </div>
  `

  const widget = mount.querySelector('#dolyami-widget')
  const totalEl = mount.querySelector('.dolyami-widget__total')
  const amountEls = mount.querySelectorAll('.dolyami-widget__amount')

  const update = () => {
    const raw = parsePriceInput(input.value)

    if (raw < 1000) {
      widget.classList.remove('dolyami-widget--live')
      animateAmount(totalEl, defaultPrice)
      amountEls.forEach((el) => animateAmount(el, defaultPrice / 4))
      return
    }

    const { total, payment } = calcDolyamiPayments(raw, commission)
    widget.classList.add('dolyami-widget--live')
    animateAmount(totalEl, total)
    amountEls.forEach((el) => animateAmount(el, payment))
  }

  if (bindInput) bindPriceInput(input, update)
  return update
}

function renderProductDolyamiWidgetHtml(price, installment) {
  const commission = parseCommission(installment.dolyami.commission)
  const { total, payment } = calcDolyamiPayments(price, commission)

  return `
    <div class="dolyami-widget dolyami-widget--product dolyami-widget--live" id="product-dolyami-widget">
      <div class="dolyami-widget__header">
        <div class="dolyami-widget__brand">
          ${DOLYAMI_LOGO}
          <span class="dolyami-widget__name">${installment.dolyami.name}</span>
        </div>
        <div class="dolyami-widget__purchase">
          <span class="dolyami-widget__purchase-label">Сумма покупки:</span>
          <strong class="dolyami-widget__total" data-value="${total}">${formatPrice(total)}</strong>
        </div>
      </div>
      <div class="dolyami-widget__grid">
        ${DOLYAMI_LABELS.map((label, index) => `
          <div class="dolyami-widget__col${index === 0 ? ' dolyami-widget__col--active' : ''}">
            <span class="dolyami-widget__label">${label}</span>
            <strong class="dolyami-widget__amount" data-value="${payment}">${formatPrice(payment)}</strong>
            <span class="dolyami-widget__bar"><span class="dolyami-widget__bar-fill"></span></span>
          </div>
        `).join('')}
      </div>
    </div>
  `
}

export function mountProductInstallmentCalc(container, price, installment) {
  if (!container || !price) return

  const rows = buildInstallmentRows(price, installment.terms)
  const dolyami = calcDolyamiPayments(price, parseCommission(installment.dolyami.commission))

  if (!container.querySelector('.product-pay-calc')) {
    container.innerHTML = `
      <div class="product-pay-calc">
        <p class="product-pay-calc__note">
          Также можно оформить рассрочку или оплату «Долями». Заранее предупредите менеджера о способе оплаты
          и приходите с телефоном, в котором установлена ваша SIM-карта.
        </p>
        <h3 class="installment-calc__title">Рассрочка</h3>
        <div class="installment-calc__scroll" tabindex="0" aria-label="Варианты рассрочки">
          <div class="installment-calc__scroll-track">
            ${rows.map((row) => `
              <div class="installment-calc__card installment-calc__card--slide">
                <span class="installment-calc__term">${row.months} мес.</span>
                <span class="installment-calc__monthly">
                  <span class="installment-calc__amount" data-value="${row.monthly}">${formatPrice(row.monthly)}</span>
                  <small>/мес</small>
                </span>
              </div>
            `).join('')}
          </div>
        </div>
        <h3 class="installment-calc__title installment-calc__title--dolyami">${installment.dolyami.name}</h3>
        ${renderProductDolyamiWidgetHtml(price, installment)}
      </div>
    `
    return
  }

  container.querySelectorAll('.installment-calc__card--slide .installment-calc__amount').forEach((el, i) => {
    if (rows[i]) animateAmount(el, rows[i].monthly)
  })

  animateAmount(container.querySelector('.dolyami-widget__total'), dolyami.total)
  container.querySelectorAll('.dolyami-widget__amount').forEach((el) => {
    animateAmount(el, dolyami.payment)
  })
}
