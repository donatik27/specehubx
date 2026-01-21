import 'dotenv/config';
import { prisma } from '@polymarket/database';
import { logger } from './lib/logger';

// City coordinates for better distribution (not country centers!)
const CITY_COORDS: Record<string, { lat: number; lon: number; name: string }> = {
  // USA Cities - spread across the country
  'US_NYC': { lat: 40.7128, lon: -74.0060, name: 'New York' },
  'US_LA': { lat: 34.0522, lon: -118.2437, name: 'Los Angeles' },
  'US_CHICAGO': { lat: 41.8781, lon: -87.6298, name: 'Chicago' },
  'US_MIAMI': { lat: 25.7617, lon: -80.1918, name: 'Miami' },
  'US_HOUSTON': { lat: 29.7604, lon: -95.3698, name: 'Houston' },
  'US_SF': { lat: 37.7749, lon: -122.4194, name: 'San Francisco' },
  'US_SEATTLE': { lat: 47.6062, lon: -122.3321, name: 'Seattle' },
  'US_BOSTON': { lat: 42.3601, lon: -71.0589, name: 'Boston' },
  'US_DC': { lat: 38.9072, lon: -77.0369, name: 'Washington DC' },
  'US_ATLANTA': { lat: 33.7490, lon: -84.3880, name: 'Atlanta' },
  'US_PHOENIX': { lat: 33.4484, lon: -112.0740, name: 'Phoenix' },
  'US_DENVER': { lat: 39.7392, lon: -104.9903, name: 'Denver' },
  
  // Europe Cities - spread across continent
  'EU_LONDON': { lat: 51.5074, lon: -0.1278, name: 'London' },
  'EU_PARIS': { lat: 48.8566, lon: 2.3522, name: 'Paris' },
  'EU_BERLIN': { lat: 52.5200, lon: 13.4050, name: 'Berlin' },
  'EU_MADRID': { lat: 40.4168, lon: -3.7038, name: 'Madrid' },
  'EU_ROME': { lat: 41.9028, lon: 12.4964, name: 'Rome' },
  'EU_AMSTERDAM': { lat: 52.3676, lon: 4.9041, name: 'Amsterdam' },
  'EU_BARCELONA': { lat: 41.3851, lon: 2.1734, name: 'Barcelona' },
  'EU_MUNICH': { lat: 48.1351, lon: 11.5820, name: 'Munich' },
  'EU_VIENNA': { lat: 48.2082, lon: 16.3738, name: 'Vienna' },
  'EU_ZURICH': { lat: 47.3769, lon: 8.5417, name: 'Zurich' },
  
  // UK Cities
  'UK_LONDON': { lat: 51.5074, lon: -0.1278, name: 'London' },
  'UK_MANCHESTER': { lat: 53.4808, lon: -2.2426, name: 'Manchester' },
  'UK_EDINBURGH': { lat: 55.9533, lon: -3.1883, name: 'Edinburgh' },
  
  // Asian Cities
  'ASIA_TOKYO': { lat: 35.6762, lon: 139.6503, name: 'Tokyo' },
  'ASIA_OSAKA': { lat: 34.6937, lon: 135.5023, name: 'Osaka' },
  'ASIA_HK': { lat: 22.3193, lon: 114.1694, name: 'Hong Kong' },
  'ASIA_SEOUL': { lat: 37.5665, lon: 126.9780, name: 'Seoul' },
  'ASIA_BUSAN': { lat: 35.1796, lon: 129.0756, name: 'Busan' },
  'ASIA_SINGAPORE': { lat: 1.3521, lon: 103.8198, name: 'Singapore' },
  'ASIA_SHANGHAI': { lat: 31.2304, lon: 121.4737, name: 'Shanghai' },
  'ASIA_BEIJING': { lat: 39.9042, lon: 116.4074, name: 'Beijing' },
  
  // Canada Cities
  'CA_TORONTO': { lat: 43.6532, lon: -79.3832, name: 'Toronto' },
  'CA_VANCOUVER': { lat: 49.2827, lon: -123.1207, name: 'Vancouver' },
  'CA_MONTREAL': { lat: 45.5017, lon: -73.5673, name: 'Montreal' },
  
  // Australia Cities
  'AU_SYDNEY': { lat: -33.8688, lon: 151.2093, name: 'Sydney' },
  'AU_MELBOURNE': { lat: -37.8136, lon: 144.9631, name: 'Melbourne' },
  'AU_BRISBANE': { lat: -27.4698, lon: 153.0251, name: 'Brisbane' },
  
  // Other
  'BRAZIL_SP': { lat: -23.5505, lon: -46.6333, name: 'São Paulo' },
  'BRAZIL_RIO': { lat: -22.9068, lon: -43.1729, name: 'Rio de Janeiro' },
  'SPAIN_MADRID': { lat: 40.4168, lon: -3.7038, name: 'Madrid' },
  'SPAIN_BARCELONA': { lat: 41.3851, lon: 2.1734, name: 'Barcelona' },
  'GERMANY_BERLIN': { lat: 52.5200, lon: 13.4050, name: 'Berlin' },
  'GERMANY_MUNICH': { lat: 48.1351, lon: 11.5820, name: 'Munich' },
  'ITALY_ROME': { lat: 41.9028, lon: 12.4964, name: 'Rome' },
  'ITALY_MILAN': { lat: 45.4642, lon: 9.1900, name: 'Milan' },
  'DENMARK_CPH': { lat: 55.6761, lon: 12.5683, name: 'Copenhagen' },
  'NETHERLANDS_AMS': { lat: 52.3676, lon: 4.9041, name: 'Amsterdam' },
  'POLAND_WARSAW': { lat: 52.2297, lon: 21.0122, name: 'Warsaw' },
  'AUSTRIA_VIENNA': { lat: 48.2082, lon: 16.3738, name: 'Vienna' },
  'LITHUANIA_VILNIUS': { lat: 54.6872, lon: 25.2797, name: 'Vilnius' },
  'SLOVAKIA_BRATISLAVA': { lat: 48.1486, lon: 17.1077, name: 'Bratislava' },
  'ESTONIA_TALLINN': { lat: 59.4370, lon: 24.7536, name: 'Tallinn' },
  'TURKEY_ISTANBUL': { lat: 41.0082, lon: 28.9784, name: 'Istanbul' },
  'TURKEY_ANKARA': { lat: 39.9334, lon: 32.8597, name: 'Ankara' },
  'THAILAND_BANGKOK': { lat: 13.7563, lon: 100.5018, name: 'Bangkok' },
  'INDONESIA_JAKARTA': { lat: -6.2088, lon: 106.8456, name: 'Jakarta' },
  'MOROCCO_CASA': { lat: 33.5731, lon: -7.5898, name: 'Casablanca' },
  'WESTASIA_DUBAI': { lat: 25.2048, lon: 55.2708, name: 'Dubai' },
  'IRELAND_DUBLIN': { lat: 53.3498, lon: -6.2603, name: 'Dublin' },
};

// Region to city pools (for random distribution)
const REGION_CITY_POOLS: Record<string, string[]> = {
  'United States': ['US_NYC', 'US_LA', 'US_CHICAGO', 'US_MIAMI', 'US_HOUSTON', 'US_SF', 'US_SEATTLE', 'US_BOSTON', 'US_DC', 'US_ATLANTA', 'US_PHOENIX', 'US_DENVER'],
  'Europe': ['EU_LONDON', 'EU_PARIS', 'EU_BERLIN', 'EU_MADRID', 'EU_ROME', 'EU_AMSTERDAM', 'EU_BARCELONA', 'EU_MUNICH', 'EU_VIENNA', 'EU_ZURICH'],
  'United Kingdom': ['UK_LONDON', 'UK_MANCHESTER', 'UK_EDINBURGH'],
  'Germany': ['GERMANY_BERLIN', 'GERMANY_MUNICH'],
  'Spain': ['SPAIN_MADRID', 'SPAIN_BARCELONA'],
  'Italy': ['ITALY_ROME', 'ITALY_MILAN'],
  'Japan': ['ASIA_TOKYO', 'ASIA_OSAKA'],
  'Korea': ['ASIA_SEOUL', 'ASIA_BUSAN'],
  'Hong Kong': ['ASIA_HK'],
  'Canada': ['CA_TORONTO', 'CA_VANCOUVER', 'CA_MONTREAL'],
  'Australia': ['AU_SYDNEY', 'AU_MELBOURNE', 'AU_BRISBANE'],
  'Australasia': ['AU_SYDNEY', 'AU_MELBOURNE'],
  'Brazil': ['BRAZIL_SP', 'BRAZIL_RIO'],
  'Denmark': ['DENMARK_CPH'],
  'Netherlands': ['NETHERLANDS_AMS'],
  'Poland': ['POLAND_WARSAW'],
  'Austria': ['AUSTRIA_VIENNA'],
  'Lithuania': ['LITHUANIA_VILNIUS'],
  'Slovakia': ['SLOVAKIA_BRATISLAVA'],
  'Estonia': ['ESTONIA_TALLINN'],
  'Turkey': ['TURKEY_ISTANBUL', 'TURKEY_ANKARA'],
  'Thailand': ['THAILAND_BANGKOK'],
  'Indonesia': ['INDONESIA_JAKARTA'],
  'Morocco': ['MOROCCO_CASA'],
  'West Asia': ['WESTASIA_DUBAI'],
  'East Asia & Pacific': ['ASIA_TOKYO', 'ASIA_HK', 'ASIA_SINGAPORE', 'ASIA_SHANGHAI'],
  'North America': ['US_NYC', 'US_LA', 'CA_TORONTO', 'CA_VANCOUVER'],
  'Ireland': ['IRELAND_DUBLIN'],
};

// Twitter username to location mapping
const TRADER_LOCATIONS: Record<string, string> = {
  '0xTactic': 'Germany',
  '0xTrinity': 'Europe',
  'AbrahamKurland': 'Brazil',
  'AnjunPoly': 'Italy',
  'AnselFang': 'East Asia & Pacific',
  'BeneGesseritPM': 'United States',
  'Betwick1': 'Spain',
  'BitalikWuterin': 'Australasia',
  'BrokieTrades': 'United States',
  'CUTNPASTE4': 'Australia',
  'Cabronidus': 'Spain',
  'CarOnPolymarket': 'Europe',
  'ColeBartiromo': 'United States',
  'Domahhhh': 'Ireland',
  'Dyor_0x': 'United Kingdom',
  'Eltonma': 'Hong Kong',
  'EricZhu06': 'United States',
  'Ferzinhagianola': 'United Kingdom',
  'Foster': 'United States',
  'HanRiverVictim': 'Korea',
  'HarveyMackinto2': 'Japan',
  'IceFrosst': 'Lithuania',
  'Impij25': 'Canada',
  'IqDegen': 'Germany',
  'JJo3999': 'Australia',
  'Junk3383': 'Korea',
  'LegenTrader86': 'Hong Kong',
  'MiSTkyGo': 'Europe',
  'MrOziPM': 'Denmark',
  'ParkDae_gangnam': 'Thailand',
  'PatroclusPoly': 'Canada',
  'SnoorrrasonPoly': 'Slovakia',
  'UjxTCY7Z7ftjiNq': 'Korea',
  'XPredicter': 'Morocco',
  'biancalianne418': 'Japan',
  'bitcoinzhang1': 'Japan',
  'cripes3': 'Spain',
  'cynical_reason': 'Estonia',
  'debased_PM': 'Turkey',
  'denizz_poly': 'Indonesia',
  'drewlivanos': 'United States',
  'dw8998': 'East Asia & Pacific',
  'evan_semet': 'United States',
  'feverpromotions': 'Japan',
  'fortaellinger': 'West Asia',
  'holy_moses7': 'West Asia',
  'hypsterlo': 'Poland',
  'johnleftman': 'United States',
  'jongpatori': 'Korea',
  'joselebetis2': 'Australia',
  'love_u_4ever': 'Hong Kong',
  'one8tyfive': 'Austria',
  'smdx_btc': 'United States',
  'tulipking': 'North America',
  'vacoolaaaa': 'Netherlands',
  'videlake': 'Hong Kong',
  'wkmfa57': 'Hong Kong',
};

async function addGeolocation() {
  logger.info('🗺️  Adding geolocation to traders...');
  
  try {
    // Fetch all traders with Twitter usernames
    const traders = await prisma.trader.findMany({
      where: {
        twitterUsername: {
          not: null,
        },
      },
      select: {
        address: true,
        twitterUsername: true,
        latitude: true,
        longitude: true,
        country: true,
      },
    });
    
    logger.info(`📥 Found ${traders.length} traders with Twitter usernames`);
    
    let updated = 0;
    let skipped = 0;
    
    for (const trader of traders) {
      if (!trader.twitterUsername) continue;
      
      // Check if location already exists
      if (trader.latitude && trader.longitude) {
        skipped++;
        continue;
      }
      
      // Find region for this Twitter username
      const region = TRADER_LOCATIONS[trader.twitterUsername];
      
      if (!region) {
        continue;
      }
      
      // Get city pool for this region
      const cityPool = REGION_CITY_POOLS[region];
      
      if (!cityPool || cityPool.length === 0) {
        logger.warn({ username: trader.twitterUsername, region }, 'No cities for region');
        continue;
      }
      
      // Pick random city from pool
      const randomCity = cityPool[Math.floor(Math.random() * cityPool.length)];
      const cityCoords = CITY_COORDS[randomCity];
      
      if (!cityCoords) {
        logger.warn({ username: trader.twitterUsername, city: randomCity }, 'Unknown city');
        continue;
      }
      
      // Add SMALL random offset to avoid exact overlap (±0.3 degrees ≈ 33km)
      const latOffset = (Math.random() - 0.5) * 0.6; // ±0.3 degree
      const lonOffset = (Math.random() - 0.5) * 0.6;
      
      await prisma.trader.update({
        where: { address: trader.address },
        data: {
          latitude: cityCoords.lat + latOffset,
          longitude: cityCoords.lon + lonOffset,
          country: cityCoords.name, // Store city name instead of region
        },
      });
      
      updated++;
      
      if (updated % 10 === 0) {
        logger.info(`   Updated ${updated} traders...`);
      }
    }
    
    logger.info(`✅ Geolocation complete!`);
    logger.info(`   Updated: ${updated}`);
    logger.info(`   Skipped (already has location): ${skipped}`);
    logger.info(`   Total with location: ${updated + skipped}`);
    
    process.exit(0);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Geolocation failed');
    process.exit(1);
  }
}

addGeolocation();
