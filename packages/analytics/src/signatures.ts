export interface KnownSignature {
  name: string;
  type: 'PROXY' | 'SECURITY_SCANNER' | 'BOT';
  pattern: RegExp;
  humanProbability: number;
}

export const KNOWN_SIGNATURES: KnownSignature[] = [
  {
    name: 'GoogleImageProxy',
    type: 'PROXY',
    pattern: /GoogleImageProxy/i,
    humanProbability: 0.5, // Indeterminate: preloaded or recipient opened
  },
  {
    name: 'AppleMailProxy',
    type: 'PROXY',
    pattern: /AppleMailProxy/i,
    humanProbability: 0.5,
  },
  {
    name: 'YahooMailProxy',
    type: 'PROXY',
    pattern: /YahooMailProxy/i,
    humanProbability: 0.5,
  },
  {
    name: 'MicrosoftOfficeScanner',
    type: 'SECURITY_SCANNER',
    pattern: /Microsoft Office|Outlook-iOS|Outlook-Android/i,
    humanProbability: 0.3,
  },
  {
    name: 'ProofpointCrawler',
    type: 'SECURITY_SCANNER',
    pattern: /Proofpoint|urldefense/i,
    humanProbability: 0.05,
  },
  {
    name: 'BarracudaScanner',
    type: 'SECURITY_SCANNER',
    pattern: /Barracuda/i,
    humanProbability: 0.05,
  },
  {
    name: 'GenericSecurityBot',
    type: 'BOT',
    pattern: /curl|wget|python-requests|headlesschrome|phantomjs|ahrefsbot|googlebot/i,
    humanProbability: 0.0,
  },
];
