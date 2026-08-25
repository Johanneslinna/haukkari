import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { HaukkariLogo } from '../../app/HaukkariLogo'

export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <main className="auth-page">
      <section className="brand-panel" aria-label="Haukkari">
        <Link className="brand" to="/">
          <HaukkariLogo inverse />
        </Link>
        <div>
          <p className="eyebrow">Treeni, joka elää mukanasi</p>
          <h1>Harjoittele tavoitteellisesti. Palaudu järkevästi.</h1>
          <p>
            Yksilöllinen harjoittelu ja ravintoseuranta yhdessä asennettavassa
            sovelluksessa.
          </p>
        </div>
      </section>
      <section className="auth-card">
        <div className="auth-card-heading">
          <p className="eyebrow">Haukkari</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {children}
      </section>
    </main>
  )
}
