import { Link } from 'react-router-dom'
import { HaukkariLogo } from '../../app/HaukkariLogo'

export function PrivacyPage() {
  const controllerName =
    import.meta.env.VITE_DATA_CONTROLLER_NAME?.trim() ||
    'Rekisterinpitäjän virallinen nimi puuttuu kehitysversiosta'
  const privacyContact =
    import.meta.env.VITE_PRIVACY_CONTACT?.trim() ||
    'Tietosuoja-asioiden yhteystieto puuttuu kehitysversiosta'
  return (
    <main className="content-page legal-page">
      <header className="page-header">
        <Link className="brand" to="/">
          <HaukkariLogo />
        </Link>
        <Link to="/asetukset">Takaisin</Link>
      </header>
      <article className="content-card prose">
        <p className="eyebrow">Tietojen käsittelyn kuvaus · 24.8.2026</p>
        <h1>Tietosuoja ja omat valinnat</h1>
        <p>
          Haukkari käsittelee antamiasi tietoja yksilöllisen harjoittelun, palautumisen,
          ravinnon ja kehityksen seurantaan. Sovellus ei tee diagnooseja eikä korvaa
          terveydenhuollon ammattilaista.
        </p>
        <h2>Rekisterinpitäjä ja yhteydenotto</h2>
        <p>
          Rekisterinpitäjä: <strong>{controllerName}</strong>. Tietosuoja-asioiden
          yhteystieto: <strong>{privacyContact}</strong>.
        </p>
        <h2>Käsiteltävät tiedot ja tarkoitus</h2>
        <p>
          Tili- ja profiilitietoja käytetään kirjautumiseen ja palvelun personointiin.
          Tavoitteet ja harjoitushistoria muodostavat ja säilyttävät suunnitelmasi.
          Kuntotarkistus- ja terveysseulontatietoja käytetään vain turvallisuusrajoihin ja
          päivän harjoitussuositukseen. Ravinto- ja kehomittauksia käytetään valitsemaasi
          seurantaan.
        </p>
        <h2>Erilliset vapaaehtoiset valinnat</h2>
        <p>
          Turvallisuusseulan terveystietojen käsittely vahvistetaan erikseen
          onboardingissa. Kuukautiskierron tiedot tallennetaan vain, kun otat niiden
          seurannan kyseisessä kuntotarkistuksessa käyttöön. Kehityskuva ladataan vain,
          kun hyväksyt kuvien erillisen valinnan ja valitset tiedoston itse. Näiden
          vapaaehtoisten tietojen pois jättäminen ei estä sovelluksen muuta käyttöä.
        </p>
        <p>
          Terveystietojen käsittely perustuu nimenomaiseen suostumukseen. Suostumuksen voi
          perua Omat tiedot -näkymässä yhtä helposti kuin sen antoi. Peruuttaminen
          lopettaa kyseiseen suostumukseen perustuvan käsittelyn eikä vaikuta ennen
          peruuttamista tehdyn käsittelyn lainmukaisuuteen.
        </p>
        <h2>Säilytys ja suojaus</h2>
        <p>
          Pysyvät tiedot tallennetaan Supabasen PostgreSQL-tietokantaan. Rivikohtaiset
          käyttöoikeudet eristävät käyttäjät toisistaan. Kehityskuvat ovat yksityisessä
          Storage-bucketissa käyttäjätunnukseen sidotulla polulla ja ne avataan vain
          lyhytikäisellä allekirjoitetulla URL-osoitteella. Liikenne käyttää HTTPS:ää ja
          palveluntarjoaja salaa tiedot levossa. Tiedot eivät ole päästä päähän salattuja.
        </p>
        <h2>Muistutukset ja Web Push</h2>
        <p>
          Sovelluksen sisäiset muistutukset ja ladattavat kalenteritiedostot ovat
          käyttäjän hallinnassa. Web Push on valinnainen, laitekohtainen kokeilu ja lupaa
          pyydetään vain erillisestä painikkeesta. Näkyvä push-teksti ei sisällä
          tavoitetta, mittauksia, oireita tai muuta terveystietoa.
        </p>
        <h2>Vienti, korjaaminen ja poistaminen</h2>
        <p>
          Omat tiedot -näkymästä voit ladata täydellisen JSON-viennin sekä jokaisen
          tietotaulun erillisen CSV-tiedoston. Voit poistaa yksittäisiä mittauksia ja
          kehityskuvia. Tilin vahvistettu poisto poistaa tietokantarivit, yksityiset
          kuvat, push-tilaukset ja Auth-käyttäjän sekä tyhjentää tämän laitteen
          paikallistiedot ja sovellusvälimuistit.
        </p>
        {(!import.meta.env.VITE_DATA_CONTROLLER_NAME ||
          !import.meta.env.VITE_PRIVACY_CONTACT) && (
          <p className="form-error">
            Tämä on kehitysversion tietosuojakuvaus. Rekisterinpitäjän virallinen nimi,
            yhteystieto, täsmälliset säilytysajat ja vastaanottajaluettelo on
            täydennettävä ennen julkaisua.
          </p>
        )}
      </article>
    </main>
  )
}
