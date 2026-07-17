/** Секции прайса THLS — должны совпадать с ключами в price-pdf-parser.mjs */
export const PDF_IMPORT_SECTIONS = [
  { id: 'iPhone 17 Pro Max', label: 'iPhone 17 Pro Max', group: 'Apple iPhone' },
  { id: 'iPhone 17 Pro', label: 'iPhone 17 Pro', group: 'Apple iPhone' },
  { id: 'iPhone 17', label: 'iPhone 17', group: 'Apple iPhone' },
  { id: 'iPhone 16', label: 'iPhone 16', group: 'Apple iPhone' },
  { id: 'Apple iPad', label: 'Apple iPad', group: 'Apple iPad' },
  { id: 'Apple MacBook', label: 'Apple MacBook', group: 'Apple MacBook' },
  { id: 'Apple Watch S / SE', label: 'Apple Watch S / SE', group: 'Apple Watch' },
  { id: 'Apple Watch Ultra', label: 'Apple Watch Ultra', group: 'Apple Watch' },
  { id: 'Apple AirPods / Marshall', label: 'Apple AirPods / Marshall', group: 'Apple AirPods' },
  { id: 'Samsung Серия Z', label: 'Samsung Серия Z', group: 'Samsung' },
  { id: 'Samsung Серия S26', label: 'Samsung Серия S26', group: 'Samsung' },
  { id: 'Samsung Серия S25', label: 'Samsung Серия S25', group: 'Samsung' },
  { id: 'Samsung Watch', label: 'Samsung Watch', group: 'Samsung' },
  { id: 'Xiaomi', label: 'Xiaomi', group: 'Xiaomi' },
  { id: 'OnePlus', label: 'OnePlus', group: 'OnePlus' },
  { id: 'Huawei', label: 'Huawei', group: 'Huawei' },
  { id: 'Умные устройства Huawei', label: 'Huawei (умные устройства)', group: 'Huawei' },
]

export function groupPdfImportSections(sections = PDF_IMPORT_SECTIONS) {
  const groups = new Map()
  for (const s of sections) {
    if (!groups.has(s.group)) groups.set(s.group, [])
    groups.get(s.group).push(s)
  }
  return groups
}
