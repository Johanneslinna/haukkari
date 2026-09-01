export function hasMeaningfulRestrictionText(value: string) {
  const normalized = value.trim().toLocaleLowerCase('fi-FI')
  if (!normalized) return false
  return !/^(?:-|ei|ei ole|ei mitään|ei rajoitteita|ei sairauksia|ei vammoja|terve|none)$/u.test(
    normalized,
  )
}
