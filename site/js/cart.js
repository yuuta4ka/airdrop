const CART_KEY = 'airdrop_cart'

export function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || []
  } catch {
    return []
  }
}

export function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart))
}

export function getCartCount(cart) {
  return cart.reduce((s, i) => s + i.qty, 0)
}

export function getCartTotal(cart) {
  return cart.reduce((s, i) => s + i.price * i.qty, 0)
}
