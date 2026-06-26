document.querySelectorAll('.star-btn').forEach((btn) => {
  btn.addEventListener('mouseenter', () => highlightStars(Number(btn.dataset.rating)))
  btn.addEventListener('focus', () => highlightStars(Number(btn.dataset.rating)))

  btn.addEventListener('click', () => {
    const rating = Number(btn.dataset.rating)
    if (rating <= 3) {
      window.location.href = `review-negative.html?stars=${rating}`
    } else {
      window.location.href = `review-positive.html?stars=${rating}`
    }
  })
})

document.getElementById('stars').addEventListener('mouseleave', () => {
  document.querySelectorAll('.star-btn').forEach((b) => b.classList.remove('star-btn--active'))
})

function highlightStars(upTo) {
  document.querySelectorAll('.star-btn').forEach((b) => {
    b.classList.toggle('star-btn--active', Number(b.dataset.rating) <= upTo)
  })
}
