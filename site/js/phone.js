export function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '')
}

/** Формат: +7 (999) 123-45-67, максимум 11 цифр (7 + 10) */
export function formatRuPhone(value) {
  let digits = digitsOnly(value)
  if (!digits.length) return ''

  if (digits.startsWith('8')) digits = '7' + digits.slice(1)
  else if (!digits.startsWith('7')) digits = '7' + digits

  digits = digits.slice(0, 11)
  const local = digits.slice(1)

  let out = '+7'
  if (!local.length) return out

  out += ' (' + local.slice(0, 3)
  if (local.length <= 3) return out

  out += ') ' + local.slice(3, 6)
  if (local.length <= 6) return out

  out += '-' + local.slice(6, 8)
  if (local.length <= 8) return out

  out += '-' + local.slice(8, 10)
  return out
}

export function isValidRuPhone(value) {
  const digits = digitsOnly(value)
  return digits.length === 11 && digits.startsWith('7')
}

export function bindRuPhoneInput(input) {
  if (!input) return

  input.addEventListener('input', () => {
    const formatted = formatRuPhone(input.value)
    input.value = formatted
    input.setCustomValidity('')
  })

  input.addEventListener('blur', () => {
    if (!input.value.trim()) {
      input.setCustomValidity('')
      return
    }
    input.setCustomValidity(isValidRuPhone(input.value) ? '' : 'Введите номер в формате +7 (999) 123-45-67')
  })
}
