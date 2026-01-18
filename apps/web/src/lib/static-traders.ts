// Static trader geolocation data
// This file contains pre-mapped traders with their coordinates

export interface MappedTrader {
  address: string;
  displayName: string;
  avatar: string;
  tier: 'S' | 'A' | 'B' | 'C' | 'D' | 'E';
  xUsername?: string;
  latitude: number;
  longitude: number;
  country: string;
  totalPnl: number;
  winRate: number;
  rarityScore: number;
}

// Country coordinates
const COUNTRY_COORDS: Record<string, { lat: number; lon: number }> = {
  'Germany': { lat: 51.1657, lon: 10.4515 },
  'Europe': { lat: 50.0, lon: 10.0 },
  'Brazil': { lat: -14.2350, lon: -51.9253 },
  'Italy': { lat: 41.8719, lon: 12.5674 },
  'East Asia & Pacific': { lat: 35.0, lon: 105.0 },
  'United States': { lat: 37.0902, lon: -95.7129 },
  'Spain': { lat: 40.4637, lon: -3.7492 },
  'Australasia': { lat: -25.0, lon: 135.0 },
  'Australia': { lat: -25.2744, lon: 133.7751 },
  'Hong Kong': { lat: 22.3193, lon: 114.1694 },
  'United Kingdom': { lat: 55.3781, lon: -3.4360 },
  'Korea': { lat: 37.5665, lon: 126.9780 },
  'Japan': { lat: 36.2048, lon: 138.2529 },
  'Lithuania': { lat: 55.1694, lon: 23.8813 },
  'Canada': { lat: 56.1304, lon: -106.3468 },
  'Denmark': { lat: 56.2639, lon: 9.5018 },
  'Thailand': { lat: 15.8700, lon: 100.9925 },
  'Slovakia': { lat: 48.6690, lon: 19.6990 },
  'Morocco': { lat: 31.7917, lon: -7.0926 },
  'Estonia': { lat: 58.5953, lon: 25.0136 },
  'Turkey': { lat: 38.9637, lon: 35.2433 },
  'Indonesia': { lat: -0.7893, lon: 113.9213 },
  'West Asia': { lat: 29.0, lon: 53.0 },
  'Poland': { lat: 51.9194, lon: 19.1451 },
  'Austria': { lat: 47.5162, lon: 14.5501 },
  'North America': { lat: 54.5260, lon: -105.2551 },
  'Netherlands': { lat: 52.1326, lon: 5.2913 },
  'Ireland': { lat: 53.4129, lon: -8.2439 },
};

// Twitter username → location mapping
const TRADER_LOCATIONS: Record<string, { country: string; displayName: string; tier: 'S' | 'A' | 'B' }> = {
  '0xTactic': { country: 'Germany', displayName: 'Tactic', tier: 'S' },
  '0xTrinity': { country: 'Europe', displayName: '0xTrinity.eth', tier: 'S' },
  'AbrahamKurland': { country: 'Brazil', displayName: 'Abe Kurland', tier: 'S' },
  'AnjunPoly': { country: 'Italy', displayName: 'Anjun', tier: 'S' },
  'AnselFang': { country: 'East Asia & Pacific', displayName: '孤狼资本', tier: 'S' },
  'BeneGesseritPM': { country: 'United States', displayName: 'BeneGesseritVoice', tier: 'S' },
  'Betwick1': { country: 'Spain', displayName: 'Betwick', tier: 'S' },
  'BitalikWuterin': { country: 'Australasia', displayName: 'manan', tier: 'S' },
  'BrokieTrades': { country: 'United States', displayName: 'brokie', tier: 'S' },
  'CUTNPASTE4': { country: 'Australia', displayName: 'CUTNPASTE', tier: 'S' },
  'Cabronidus': { country: 'Spain', displayName: 'Omuss.hl (THE GOAT)', tier: 'S' },
  'CarOnPolymarket': { country: 'Europe', displayName: 'Car', tier: 'S' },
  'ColeBartiromo': { country: 'United States', displayName: 'Cole Bartiromo the Dollar Scholar', tier: 'S' },
  'Domahhhh': { country: 'Ireland', displayName: 'Domer', tier: 'S' },
  'Dyor_0x': { country: 'United Kingdom', displayName: 'DYOR.eth', tier: 'S' },
  'Eltonma': { country: 'Hong Kong', displayName: 'Elton Ma', tier: 'S' },
  'EricZhu06': { country: 'United States', displayName: 'Eric Zhu', tier: 'S' },
  'Ferzinhagianola': { country: 'United Kingdom', displayName: 'gabriella fernanda', tier: 'A' },
  'Foster': { country: 'United States', displayName: 'Foster', tier: 'S' },
  'HanRiverVictim': { country: 'Korea', displayName: 'JM', tier: 'A' },
  'HarveyMackinto2': { country: 'Japan', displayName: 'YatSen', tier: 'A' },
  'IceFrosst': { country: 'Lithuania', displayName: 'IceFrost.base.eth', tier: 'A' },
  'Impij25': { country: 'Canada', displayName: 'Padda', tier: 'A' },
  'IqDegen': { country: 'Germany', displayName: 'IQ=degen', tier: 'A' },
  'JJo3999': { country: 'Australia', displayName: 'JJo', tier: 'A' },
  'Junk3383': { country: 'Korea', displayName: 'christophe de cuijpe', tier: 'A' },
  'LegenTrader86': { country: 'Hong Kong', displayName: 'DimSumboiiiiiiiii', tier: 'A' },
  'MiSTkyGo': { country: 'Europe', displayName: 'MisTKy', tier: 'S' },
  'MrOziPM': { country: 'Denmark', displayName: 'mr.ozi', tier: 'A' },
  'ParkDae_gangnam': { country: 'Thailand', displayName: 'Dit_s', tier: 'A' },
  'PatroclusPoly': { country: 'Canada', displayName: 'Patroclus', tier: 'A' },
  'SnoorrrasonPoly': { country: 'Slovakia', displayName: 'Snoorrason', tier: 'A' },
  'UjxTCY7Z7ftjiNq': { country: 'Korea', displayName: 'SynapseAlpha.eth', tier: 'S' },
  'XPredicter': { country: 'Morocco', displayName: 'X', tier: 'A' },
  'biancalianne418': { country: 'Japan', displayName: 'Bianca', tier: 'A' },
  'bitcoinzhang1': { country: 'Japan', displayName: '马踢橘子', tier: 'A' },
  'cripes3': { country: 'Spain', displayName: 'too eazy1', tier: 'B' },
  'cynical_reason': { country: 'Estonia', displayName: 'sigh', tier: 'B' },
  'debased_PM': { country: 'Turkey', displayName: 'debased', tier: 'B' },
  'denizz_poly': { country: 'Indonesia', displayName: 'denizz', tier: 'B' },
  'drewlivanos': { country: 'United States', displayName: 'drew', tier: 'A' },
  'dw8998': { country: 'East Asia & Pacific', displayName: 'David', tier: 'A' },
  'evan_semet': { country: 'United States', displayName: 'Thanos Chad', tier: 'S' },
  'feverpromotions': { country: 'Japan', displayName: 'Fever Promotions', tier: 'B' },
  'fortaellinger': { country: 'West Asia', displayName: 'stone cold ape', tier: 'B' },
  'holy_moses7': { country: 'West Asia', displayName: 'Moses', tier: 'B' },
  'hypsterlo': { country: 'Poland', displayName: 'hypsterlo', tier: 'B' },
  'johnleftman': { country: 'United States', displayName: 'John Leftman', tier: 'A' },
  'jongpatori': { country: 'Korea', displayName: 'donjo', tier: 'B' },
  'joselebetis2': { country: 'Australia', displayName: 'josele.sol', tier: 'B' },
  'love_u_4ever': { country: 'Hong Kong', displayName: '0xp3nny', tier: 'B' },
  'one8tyfive': { country: 'Austria', displayName: 'Dominikas S.', tier: 'A' },
  'smdx_btc': { country: 'United States', displayName: 'Magics', tier: 'A' },
  'tulipking': { country: 'North America', displayName: 'Tulip King', tier: 'A' },
  'vacoolaaaa': { country: 'Netherlands', displayName: 'vacoola', tier: 'B' },
  'videlake': { country: 'Hong Kong', displayName: 'Teribleble', tier: 'B' },
  'wkmfa57': { country: 'Hong Kong', displayName: 'wkmfa57', tier: 'B' },
};

// Generate static traders with coordinates
export const STATIC_MAPPED_TRADERS: MappedTrader[] = Object.entries(TRADER_LOCATIONS).map(([xUsername, data]) => {
  const coords = COUNTRY_COORDS[data.country];
  
  // Add small random offset to avoid exact overlap
  const latOffset = (Math.random() - 0.5) * 2;
  const lonOffset = (Math.random() - 0.5) * 2;
  
  // Generate fake address based on username
  const fakeAddress = `0x${xUsername.slice(0, 8).padEnd(40, '0')}`;
  
  return {
    address: fakeAddress,
    displayName: data.displayName,
    avatar: `https://api.dicebear.com/7.x/shapes/svg?seed=${xUsername}`,
    tier: data.tier,
    xUsername,
    latitude: coords.lat + latOffset,
    longitude: coords.lon + lonOffset,
    country: data.country,
    totalPnl: data.tier === 'S' ? 100000 : data.tier === 'A' ? 50000 : 25000,
    winRate: data.tier === 'S' ? 0.65 : data.tier === 'A' ? 0.58 : 0.52,
    rarityScore: data.tier === 'S' ? 80000 : data.tier === 'A' ? 60000 : 40000,
  };
});
