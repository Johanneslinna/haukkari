type HaukkariLogoProps = {
  compact?: boolean
  inverse?: boolean
}

/**
 * Väliaikainen Haukkari-wordmark. Merkki käyttää public/favicon.svg-assetia,
 * kunnes lopullinen brändiassetti toimitetaan.
 */
export function HaukkariLogo({ compact = false, inverse = false }: HaukkariLogoProps) {
  return (
    <span
      className={`haukkari-logo${compact ? ' is-compact' : ''}${inverse ? ' is-inverse' : ''}`}
    >
      <img className="haukkari-logo-mark" src="/favicon.svg" alt="" />
      <span className="haukkari-logo-copy">
        <span className="haukkari-wordmark">HAUKKARI</span>
        <span className="haukkari-beta-label">INTERNAL BETA</span>
      </span>
    </span>
  )
}
