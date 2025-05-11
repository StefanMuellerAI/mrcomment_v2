import React from 'react';

const ImpressumPage: React.FC = () => {
  return (
    <div className='p-4 md:p-8 max-w-4xl mx-auto'>
      <h1 className='text-3xl font-bold text-gray-800 dark:text-white mb-6'>Impressum</h1>
      <div className='prose dark:prose-invert max-w-none'>
        
        <p>
          Stefan Müller<br />
          StefanAI – Research & Development<br />
          Graeffstr. 22<br />
          50823 Köln
        </p>

        <h2>Kontakt</h2>
        <p>
          Telefon: 0221/5702984<br />
          E-Mail: info@stefanai.de
        </p>

        <h2>Umsatzsteuer-ID</h2>
        <p>
          Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz:<br />
          DE347707954
        </p>

        <h2>Redaktionell verantwortlich</h2>
        <p>
          Stefan Müller<br />
          Graeffstr. 22<br />
          50823 Köln
        </p>

        <h2>EU-Streitschlichtung</h2>
        <p>
          Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">https://ec.europa.eu/consumers/odr/</a>.<br />
          Unsere E-Mail-Adresse finden Sie oben im Impressum.
        </p>

        <h2>Verbraucher­streit­beilegung/Universal­schlichtungs­stelle</h2>
        <p>
          Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
        </p>

      </div>
    </div>
  );
};

export default ImpressumPage; 