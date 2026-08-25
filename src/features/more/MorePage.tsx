import { Link } from 'react-router-dom'

const links = [
  {
    to: '/laji',
    title: 'Laji ja kilpailut',
    text: 'Kiinteät harjoitukset ja tapahtumat',
  },
  { to: '/ravinto', title: 'Ravinto', text: 'Päivän ateriat ja tavoiteohjaus' },
  { to: '/historia', title: 'Harjoitushistoria', text: 'Toteutuneet harjoitukset' },
  {
    to: '/kehityskuvat',
    title: 'Yksityiset kehityskuvat',
    text: 'Vapaaehtoiset kuvat ja yksittäinen poistaminen',
  },
  {
    to: '/tavoitejaksot',
    title: 'Tavoitejaksot',
    text: 'Suunnitelmaversioiden aikajana',
  },
  { to: '/muistutukset', title: 'Muistutukset', text: 'Ajat ja kalenterimerkinnät' },
  { to: '/synkronointi', title: 'Synkronointi', text: 'Laitteet ja ristiriidat' },
  { to: '/asenna', title: 'Asenna sovellus', text: 'Android- ja iPhone-ohjeet' },
  { to: '/asetukset', title: 'Asetukset', text: 'Teema, tietosuoja ja tili' },
]

export function MorePage() {
  return (
    <div className="page-stack">
      <header className="section-heading">
        <p className="eyebrow">Haukkari</p>
        <h1>Lisää</h1>
        <p>Seuranta, lajikalenteri ja sovelluksen asetukset yhdessä paikassa.</p>
      </header>
      <div className="link-card-grid">
        {links.map((item) => (
          <Link className="link-card" key={item.to} to={item.to}>
            <strong>{item.title}</strong>
            <span>{item.text}</span>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
