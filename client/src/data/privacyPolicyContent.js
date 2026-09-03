export const privacyPolicyContent = [
  {
    id: 'intro',
    type: 'paragraph',
    text: 'This Privacy Policy is provided in English for convenience. It is issued in accordance with German law (§ 5 TMG).'
  },
  {
    id: 'controller',
    type: 'section',
    heading: '1. Controller',
    blocks: [
      ['Technonex GmbH'],
      ['Tal 44'],
      ['80331 Munich'],
      ['Germany'],
      ['Telephone: 089 244 1065 00'],
      ['Email: info@technonex.de']
    ],
    items: [
      { label: 'Email', value: 'info@technonex.de', href: 'mailto:info@technonex.de' }
    ]
  },
  {
    id: 'collection',
    type: 'section',
    heading: '2. Collection and storage of personal data',
    paragraphs: [
      'When you visit our website, information is transmitted automatically by your browser and stored in server log files. This comprises: browser type and version, operating system used, referrer URL, host name of the accessing computer, time of the server request, and IP address. This data cannot be attributed to any specific person and is not merged with other data sources.'
    ]
  },
  {
    id: 'contact-form',
    type: 'section',
    heading: '3. Contact form',
    paragraphs: [
      'When you use our contact form, the data you provide (name, email, company, message) is stored in order to process your enquiry. We do not pass this data on without your consent. Processing is carried out on the basis of Art. 6 (1) (b) GDPR.'
    ]
  },
  {
    id: 'cookies',
    type: 'section',
    heading: '4. Cookies',
    paragraphs: [
      'Our website uses cookies. Further information can be found in our ',
      'Cookie Policy.'
    ],
    customLink: {
      text: 'Cookie Policy',
      href: '/cookies'
    }
  },
  {
    id: 'rights',
    type: 'section',
    heading: '5. Your rights',
    paragraphs: [
      'You have the right to information, rectification, erasure, restriction of processing, data portability and objection. To exercise your rights, please contact: info@technonex.de'
    ],
    items: [
      { label: 'Contact', value: 'info@technonex.de', href: 'mailto:info@technonex.de' }
    ]
  },
  {
    id: 'complaint',
    type: 'section',
    heading: '6. Right to lodge a complaint',
    paragraphs: [
      'You have the right to lodge a complaint with a data protection supervisory authority regarding the processing of your personal data. Competent supervisory authority: Bayerisches Landesamt für Datenschutzaufsicht (BayLDA).'
    ]
  },
  {
    id: 'as-of',
    type: 'paragraph',
    text: 'As at: February 2024'
  }
];
