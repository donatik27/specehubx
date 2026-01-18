// Static trader geolocation data
// This file contains pre-mapped traders with their coordinates

export interface MappedTrader {
  address: string;
  displayName: string;
  avatar: string;
  tier: 'S' | 'A' | 'B';
  xUsername?: string;
  latitude: number;
  longitude: number;
  country: string;
  totalPnl: number;
  winRate: number;
  rarityScore: number;
}

// Country coordinates with multiple cities for variety
const COUNTRY_COORDS: Record<string, { lat: number; lon: number }[]> = {
  'Germany': [
    { lat: 52.5200, lon: 13.4050 }, // Berlin
    { lat: 48.1351, lon: 11.5820 }, // Munich
    { lat: 50.1109, lon: 8.6821 },  // Frankfurt
  ],
  'Europe': [
    { lat: 48.8566, lon: 2.3522 },  // Paris
    { lat: 51.5074, lon: -0.1278 }, // London
    { lat: 52.3676, lon: 4.9041 },  // Amsterdam
  ],
  'Brazil': [
    { lat: -23.5505, lon: -46.6333 }, // São Paulo
    { lat: -22.9068, lon: -43.1729 }, // Rio
    { lat: -15.8267, lon: -47.9218 }, // Brasília
  ],
  'Italy': [
    { lat: 41.9028, lon: 12.4964 }, // Rome
    { lat: 45.4642, lon: 9.1900 },  // Milan
  ],
  'East Asia & Pacific': [
    { lat: 31.2304, lon: 121.4737 }, // Shanghai
    { lat: 39.9042, lon: 116.4074 }, // Beijing
    { lat: 35.6762, lon: 139.6503 }, // Tokyo
  ],
  'United States': [
    { lat: 40.7128, lon: -74.0060 }, // NYC
    { lat: 34.0522, lon: -118.2437 }, // LA
    { lat: 37.7749, lon: -122.4194 }, // SF
    { lat: 41.8781, lon: -87.6298 }, // Chicago
    { lat: 30.2672, lon: -97.7431 }, // Austin
    { lat: 25.7617, lon: -80.1918 }, // Miami
    { lat: 47.6062, lon: -122.3321 }, // Seattle
    { lat: 42.3601, lon: -71.0589 }, // Boston
  ],
  'Spain': [
    { lat: 40.4168, lon: -3.7038 }, // Madrid
    { lat: 41.3851, lon: 2.1734 },  // Barcelona
  ],
  'Australasia': [{ lat: -25.2744, lon: 133.7751 }],
  'Australia': [
    { lat: -33.8688, lon: 151.2093 }, // Sydney
    { lat: -37.8136, lon: 144.9631 }, // Melbourne
  ],
  'Hong Kong': [
    { lat: 22.3193, lon: 114.1694 },
    { lat: 22.2783, lon: 114.1747 },
    { lat: 22.3964, lon: 114.1095 },
  ],
  'United Kingdom': [
    { lat: 51.5074, lon: -0.1278 },  // London
    { lat: 53.4808, lon: -2.2426 },  // Manchester
  ],
  'Korea': [
    { lat: 37.5665, lon: 126.9780 }, // Seoul
    { lat: 35.1796, lon: 129.0756 }, // Busan
  ],
  'Japan': [
    { lat: 35.6762, lon: 139.6503 }, // Tokyo
    { lat: 34.6937, lon: 135.5023 }, // Osaka
    { lat: 35.0116, lon: 135.7681 }, // Kyoto
  ],
  'Lithuania': [{ lat: 54.6872, lon: 25.2797 }], // Vilnius
  'Canada': [
    { lat: 43.6532, lon: -79.3832 }, // Toronto
    { lat: 49.2827, lon: -123.1207 }, // Vancouver
    { lat: 45.5017, lon: -73.5673 },  // Montreal
  ],
  'Denmark': [{ lat: 55.6761, lon: 12.5683 }], // Copenhagen
  'Thailand': [{ lat: 13.7563, lon: 100.5018 }], // Bangkok
  'Slovakia': [{ lat: 48.1486, lon: 17.1077 }], // Bratislava
  'Morocco': [{ lat: 33.5731, lon: -7.5898 }], // Casablanca
  'Estonia': [{ lat: 59.4370, lon: 24.7536 }], // Tallinn
  'Turkey': [{ lat: 41.0082, lon: 28.9784 }], // Istanbul
  'Indonesia': [{ lat: -6.2088, lon: 106.8456 }], // Jakarta
  'West Asia': [
    { lat: 25.2048, lon: 55.2708 }, // Dubai
    { lat: 24.7136, lon: 46.6753 }, // Riyadh
  ],
  'Poland': [{ lat: 52.2297, lon: 21.0122 }], // Warsaw
  'Austria': [{ lat: 48.2082, lon: 16.3738 }], // Vienna
  'North America': [
    { lat: 43.6532, lon: -79.3832 }, // Toronto
    { lat: 40.7128, lon: -74.0060 }, // NYC
  ],
  'Netherlands': [
    { lat: 52.3676, lon: 4.9041 }, // Amsterdam
    { lat: 51.9225, lon: 4.4792 }, // Rotterdam
  ],
  'Ireland': [{ lat: 53.3498, lon: -6.2603 }], // Dublin
  'New Zealand': [{ lat: -36.8485, lon: 174.7633 }], // Auckland
  'Sweden': [{ lat: 59.3293, lon: 18.0686 }], // Stockholm
  'Ecuador': [{ lat: -0.1807, lon: -78.4678 }], // Quito
  'Singapore': [{ lat: 1.3521, lon: 103.8198 }],
  'Uzbekistan': [{ lat: 41.2995, lon: 69.2401 }], // Tashkent
  'United Arab Emirates': [{ lat: 25.2048, lon: 55.2708 }], // Dubai
  'Ukraine': [
    { lat: 50.4501, lon: 30.5234 }, // Kyiv
    { lat: 49.8397, lon: 24.0297 }, // Lviv
  ],
  'Czech Republic': [{ lat: 50.0755, lon: 14.4378 }], // Prague
  'Taiwan': [{ lat: 25.0330, lon: 121.5654 }], // Taipei
  'Eastern Europe (Non-EU)': [{ lat: 50.4501, lon: 30.5234 }],
  'France': [
    { lat: 48.8566, lon: 2.3522 },  // Paris
    { lat: 43.2965, lon: 5.3698 },  // Marseille
  ],
  'Argentina': [{ lat: -34.6037, lon: -58.3816 }], // Buenos Aires
  'South Asia': [
    { lat: 28.6139, lon: 77.2090 }, // Delhi
    { lat: 19.0760, lon: 72.8777 }, // Mumbai
  ],
  'India': [
    { lat: 28.6139, lon: 77.2090 }, // Delhi
    { lat: 19.0760, lon: 72.8777 }, // Mumbai
    { lat: 12.9716, lon: 77.5946 }, // Bangalore
  ],
  'Croatia': [{ lat: 45.8150, lon: 15.9819 }], // Zagreb
};

// Twitter username → location mapping
const TRADER_LOCATIONS: Record<string, { country: string; displayName: string; tier: 'S' | 'A' | 'B' }> = {
  // Original list
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
  'ColeBartiromo': { country: 'United States', displayName: 'Cole Bartiromo', tier: 'S' },
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
  
  // New batch
  '0x8dxd': { country: 'New Zealand', displayName: '0x8dxd', tier: 'S' },
  'Nooserac': { country: 'Canada', displayName: 'Nooserac', tier: 'S' },
  'tupac_poly': { country: 'United States', displayName: 'tupac_poly', tier: 'S' },
  'DigAssets01': { country: 'United States', displayName: 'DigAssets01', tier: 'S' },
  'Iridium1911': { country: 'Japan', displayName: 'Iridium1911', tier: 'S' },
  'MisTky007': { country: 'Sweden', displayName: 'MisTky007', tier: 'S' },
  'ka_wa_wa': { country: 'Canada', displayName: 'ka_wa_wa', tier: 'S' },
  'Parz1valPM': { country: 'Europe', displayName: 'Parz1valPM', tier: 'S' },
  'ThePrexpect': { country: 'East Asia & Pacific', displayName: 'ThePrexpect', tier: 'S' },
  'yonezyb': { country: 'Ecuador', displayName: 'yonezyb', tier: 'A' },
  'UjxTCYZZftijNq': { country: 'Korea', displayName: 'UjxTCYZZftijNq', tier: 'S' },
  'Jesterthegoose': { country: 'North America', displayName: 'Jesterthegoose', tier: 'A' },
  'imdatn_': { country: 'Spain', displayName: 'imdatn_', tier: 'A' },
  'JustinClaborn1': { country: 'Hong Kong', displayName: 'JustinClaborn1', tier: 'S' },
  'DespinaWade9': { country: 'Hong Kong', displayName: 'DespinaWade9', tier: 'A' },
  'mm_legitimate': { country: 'United States', displayName: 'mm_legitimate', tier: 'S' },
  'Dropper': { country: 'Brazil', displayName: 'Dropper', tier: 'A' },
  'Nanavo': { country: 'Brazil', displayName: 'Nanavo', tier: 'A' },
  'Euan': { country: 'Europe', displayName: 'Euan', tier: 'A' },
  'Macaco': { country: 'United States', displayName: 'Macaco', tier: 'S' },
  'ThanosChad': { country: 'United States', displayName: 'ThanosChad', tier: 'S' },
  'HazelProvencal': { country: 'Hong Kong', displayName: 'HazelProvencal', tier: 'A' },
  'MEPP': { country: 'Canada', displayName: 'MEPP', tier: 'A' },
  'Scottilicious': { country: 'Hong Kong', displayName: 'Scottilicious', tier: 'A' },
  'ascetic': { country: 'North America', displayName: 'ascetic', tier: 'A' },
  'coinlaundry': { country: 'United Arab Emirates', displayName: 'coinlaundry', tier: 'A' },
  'Fridge': { country: 'Europe', displayName: 'Fridge', tier: 'A' },
  'thanksforshow_': { country: 'Netherlands', displayName: 'thanksforshow_', tier: 'A' },
  'Viter': { country: 'Ukraine', displayName: 'Viter', tier: 'A' },
  'Jahoda': { country: 'Czech Republic', displayName: 'Jahoda', tier: 'A' },
  'BagCalls': { country: 'North America', displayName: 'BagCalls', tier: 'A' },
  'Gr0wCrypt0': { country: 'United States', displayName: 'Gr0wCrypt0', tier: 'A' },
  'bhuo188': { country: 'Taiwan', displayName: 'bhuo188', tier: 'A' },
  'MonteCarloSpam': { country: 'Netherlands', displayName: 'MonteCarloSpam', tier: 'A' },
  'tsybka': { country: 'Eastern Europe (Non-EU)', displayName: 'tsybka', tier: 'B' },
  'Tenebrus87': { country: 'Germany', displayName: 'Tenebrus87', tier: 'A' },
  'XPredictor': { country: 'Morocco', displayName: 'XPredictor', tier: 'A' },
  'MassimoDelfini': { country: 'Spain', displayName: 'MassimoDelfini', tier: 'A' },
  'Purebet_io': { country: 'Europe', displayName: 'Purebet_io', tier: 'B' },
  'GohstPM': { country: 'Netherlands', displayName: 'GohstPM', tier: 'A' },
  'world_blocks': { country: 'Netherlands', displayName: 'world_blocks', tier: 'A' },
  'Nihaww_': { country: 'France', displayName: 'Nihaww_', tier: 'A' },
  'Frank3261939249': { country: 'Hong Kong', displayName: 'Frank3261939249', tier: 'B' },
  'elucidxte': { country: 'Australia', displayName: 'elucidxte', tier: 'A' },
  'alesia_kod96360': { country: 'Japan', displayName: 'alesia_kod96360', tier: 'B' },
  'tenad0me': { country: 'North America', displayName: 'tenad0me', tier: 'A' },
  'dontoverfit': { country: 'Brazil', displayName: 'dontoverfit', tier: 'A' },
  'ebobc_eth': { country: 'Argentina', displayName: 'ebobc_eth', tier: 'A' },
  'TheWolfOfPoly': { country: 'Europe', displayName: 'TheWolfOfPoly', tier: 'A' },
  'traderman222': { country: 'Czech Republic', displayName: 'traderman222', tier: 'A' },
  'Peregrine_u': { country: 'Japan', displayName: 'Peregrine_u', tier: 'A' },
  'netrol_': { country: 'Italy', displayName: 'netrol_', tier: 'A' },
  'polyfirefly': { country: 'South Asia', displayName: 'polyfirefly', tier: 'B' },
  'samoHypebears': { country: 'Ukraine', displayName: 'samoHypebears', tier: 'A' },
  'Impi25': { country: 'Canada', displayName: 'Impi25', tier: 'A' },
  'DuraskinP': { country: 'Hong Kong', displayName: 'DuraskinP', tier: 'B' },
  'NestorK67460812': { country: 'Hong Kong', displayName: 'NestorK67460812', tier: 'B' },
  'baiyunhea': { country: 'Hong Kong', displayName: 'baiyunhea', tier: 'B' },
  'pr1nas': { country: 'Brazil', displayName: 'pr1nas', tier: 'A' },
  'Zalbeeeeeeeeng': { country: 'Ireland', displayName: 'Zalbeeeeeeeeng', tier: 'A' },
  'rlverside0': { country: 'Japan', displayName: 'rlverside0', tier: 'B' },
  'wuestenigel': { country: 'Germany', displayName: 'wuestenigel', tier: 'A' },
  'PredictaDamusX': { country: 'United Kingdom', displayName: 'PredictaDamusX', tier: 'A' },
  'seems1126': { country: 'Japan', displayName: 'seems1126', tier: 'B' },
  'nicoco89poly': { country: 'Europe', displayName: 'nicoco89poly', tier: 'B' },
  'HollandKatyoann': { country: 'Ukraine', displayName: 'HollandKatyoann', tier: 'B' },
  'AlisaFox56572': { country: 'Hong Kong', displayName: 'AlisaFox56572', tier: 'B' },
  'zmzweb3': { country: 'Japan', displayName: 'zmzweb3', tier: 'B' },
  'Joker_Poly': { country: 'Canada', displayName: 'Joker_Poly', tier: 'A' },
  'arun_14159': { country: 'India', displayName: 'arun_14159', tier: 'A' },
  'ferrellcode': { country: 'United States', displayName: 'ferrellcode', tier: 'A' },
  'VespucciPM': { country: 'Europe', displayName: 'VespucciPM', tier: 'A' },
  'sherogog': { country: 'Austria', displayName: 'sherogog', tier: 'A' },
  'guhhhtradez': { country: 'Croatia', displayName: 'guhhhtradez', tier: 'B' },
};

// MAP TEMPORARILY DISABLED - will be populated manually after finding public traders
export const STATIC_MAPPED_TRADERS: MappedTrader[] = [];
