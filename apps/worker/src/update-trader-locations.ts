import 'dotenv/config'
import { prisma } from '@polymarket/database'

// Trader locations from Twitter data
const TRADER_LOCATIONS: Record<string, string> = {
  '0x8dxd': 'New Zealand',
  'Nooserac': 'Canada',
  'tupac_poly': 'United States',
  'DigAssets01': 'United States',
  'Iridium1911': 'Japan',
  'MisTky007': 'Sweden',
  'ka_wa_wa': 'Canada',
  'Parz1valPM': 'Europe',
  'ThePrexpect': 'East Asia & Pacific',
  'yonezyb': 'Ecuador',
  'UjxTCYZZftijNq': 'Korea',
  'Jesterthegoose': 'North America',
  'imdatn_': 'Spain',
  'JustinClaborn1': 'Hong Kong',
  'DespinaWade9': 'Hong Kong',
  'mm_legitimate': 'United States',
  'gOaTbAnKeR.insidertrading.patron': 'Singapore',
  'Dropper': 'Brazil',
  'PolyMind-Victor': 'Hong Kong',
  'Nanavo': 'Brazil',
  'Roflan-ludoman': 'Uzbekistan',
  'Euan': 'Europe',
  'Macaco': 'United States',
  'ThanosChad': 'United States',
  'HazelProvencal': 'Hong Kong',
  'MEPP': 'Canada',
  'Scottilicious': 'Hong Kong',
  'ascetic': 'North America',
  'coinlaundry': 'United Arab Emirates',
  'Fridge': 'Europe',
  'thanksforshow_': 'Netherlands',
  'Viter': 'Ukraine',
  'Jahoda': 'Czech Republic',
  'BagCalls': 'North America',
  'Gr0wCrypt0': 'United States',
  'bhuo188': 'Taiwan',
  'MonteCarloSpam': 'Netherlands',
  'tsybka': 'Eastern Europe (Non-EU)',
  'Tenebrus87': 'Germany',
  'XPredictor': 'Morocco',
  'MassimoDelfini': 'Spain',
  'Purebet_io': 'Europe',
  'GohstPM': 'Netherlands',
  'world_blocks': 'Netherlands',
  'Nihaww_': 'France',
  'Frank3261939249': 'Hong Kong',
  'elucidxte': 'Australia',
  'alesia_kod96360': 'Japan',
  'tenad0me': 'North America',
  'dontoverfit': 'Brazil',
  'ebobc_eth': 'Argentina',
  'TheWolfOfPoly': 'Europe',
  'traderman222': 'Czech Republic',
  'Peregrine_u': 'Japan',
  'netrol_': 'Italy',
  'polyfirefly': 'South Asia',
  'samoHypebears': 'Ukraine',
  'Impi25': 'Canada',
  'DuraskinP': 'Hong Kong',
  'NestorK67460812': 'Hong Kong',
  'baiyunhea': 'Hong Kong',
  'pr1nas': 'Brazil',
  'Zalbeeeeeeeeng': 'Ireland',
  'rlverside0': 'Japan',
  'wuestenigel': 'Germany',
  'PredictaDamusX': 'United Kingdom',
  'seems1126': 'Japan',
  'nicoco89poly': 'Europe',
  'HollandKatyoann': 'Ukraine',
  'AlisaFox56572': 'Hong Kong',
  'zmzweb3': 'Japan',
  'Joker_Poly': 'Canada',
  'arun_14159': 'India',
  'ferrellcode': 'United States',
  'VespucciPM': 'Europe',
  'sherogog': 'Austria',
  'guhhhtradez': 'Croatia',
  // New batch
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
}

// Country/Region coordinates with random offsets for variety
const COORDINATES: Record<string, () => { lat: number; lng: number; country: string }> = {
  'New Zealand': () => ({ lat: -41.2865 + rand(1), lng: 174.7762 + rand(2), country: 'New Zealand' }),
  'Canada': () => ({ lat: 56.1304 + rand(10), lng: -106.3468 + rand(20), country: 'Canada' }),
  'United States': () => ({ lat: 37.0902 + rand(10), lng: -95.7129 + rand(20), country: 'United States' }),
  'Japan': () => ({ lat: 36.2048 + rand(5), lng: 138.2529 + rand(5), country: 'Japan' }),
  'Sweden': () => ({ lat: 60.1282 + rand(5), lng: 18.6435 + rand(3), country: 'Sweden' }),
  'Europe': () => {
    // Random European country
    const countries = [
      { lat: 48.8566, lng: 2.3522, country: 'France' },
      { lat: 52.5200, lng: 13.4050, country: 'Germany' },
      { lat: 41.9028, lng: 12.4964, country: 'Italy' },
      { lat: 40.4168, lng: -3.7038, country: 'Spain' },
      { lat: 52.3676, lng: 4.9041, country: 'Netherlands' },
      { lat: 51.5074, lng: -0.1278, country: 'United Kingdom' },
    ]
    const country = countries[Math.floor(Math.random() * countries.length)]
    return { lat: country.lat + rand(2), lng: country.lng + rand(2), country: country.country }
  },
  'East Asia & Pacific': () => {
    const locations = [
      { lat: 35.6762, lng: 139.6503, country: 'Japan' },
      { lat: 37.5665, lng: 126.9780, country: 'South Korea' },
      { lat: 25.0330, lng: 121.5654, country: 'Taiwan' },
    ]
    const loc = locations[Math.floor(Math.random() * locations.length)]
    return { lat: loc.lat + rand(2), lng: loc.lng + rand(2), country: loc.country }
  },
  'Ecuador': () => ({ lat: -1.8312 + rand(2), lng: -78.1834 + rand(2), country: 'Ecuador' }),
  'Korea': () => ({ lat: 37.5665 + rand(1), lng: 126.9780 + rand(1), country: 'South Korea' }),
  'North America': () => {
    const locations = [
      { lat: 40.7128, lng: -74.0060, country: 'United States' },
      { lat: 43.6532, lng: -79.3832, country: 'Canada' },
      { lat: 34.0522, lng: -118.2437, country: 'United States' },
    ]
    const loc = locations[Math.floor(Math.random() * locations.length)]
    return { lat: loc.lat + rand(3), lng: loc.lng + rand(3), country: loc.country }
  },
  'Spain': () => ({ lat: 40.4168 + rand(6), lng: -3.7038 + rand(6), country: 'Spain' }),
  'Hong Kong': () => ({ lat: 22.3193 + rand(0.1), lng: 114.1694 + rand(0.1), country: 'Hong Kong' }),
  'Singapore': () => ({ lat: 1.3521 + rand(0.1), lng: 103.8198 + rand(0.1), country: 'Singapore' }),
  'Brazil': () => ({ lat: -14.2350 + rand(10), lng: -51.9253 + rand(10), country: 'Brazil' }),
  'Uzbekistan': () => ({ lat: 41.2995 + rand(2), lng: 69.2401 + rand(2), country: 'Uzbekistan' }),
  'United Arab Emirates': () => ({ lat: 25.2048 + rand(1), lng: 55.2708 + rand(1), country: 'United Arab Emirates' }),
  'Netherlands': () => ({ lat: 52.3676 + rand(4), lng: 4.9041 + rand(4), country: 'Netherlands' }),
  'Ukraine': () => ({ lat: 50.4501 + rand(6), lng: 30.5234 + rand(6), country: 'Ukraine' }),
  'Czech Republic': () => ({ lat: 50.0755 + rand(1), lng: 14.4378 + rand(1), country: 'Czech Republic' }),
  'Taiwan': () => ({ lat: 25.0330 + rand(1), lng: 121.5654 + rand(1), country: 'Taiwan' }),
  'Eastern Europe (Non-EU)': () => {
    const locations = [
      { lat: 50.4501, lng: 30.5234, country: 'Ukraine' },
      { lat: 47.4979, lng: 19.0402, country: 'Hungary' },
      { lat: 44.4268, lng: 26.1025, country: 'Romania' },
    ]
    const loc = locations[Math.floor(Math.random() * locations.length)]
    return { lat: loc.lat + rand(2), lng: loc.lng + rand(2), country: loc.country }
  },
  'Germany': () => ({ lat: 52.5200 + rand(6), lng: 13.4050 + rand(6), country: 'Germany' }),
  'Morocco': () => ({ lat: 33.9716 + rand(2), lng: -6.8498 + rand(2), country: 'Morocco' }),
  'France': () => ({ lat: 48.8566 + rand(6), lng: 2.3522 + rand(6), country: 'France' }),
  'Australia': () => ({ lat: -25.2744 + rand(10), lng: 133.7751 + rand(10), country: 'Australia' }),
  'Argentina': () => ({ lat: -38.4161 + rand(5), lng: -63.6167 + rand(5), country: 'Argentina' }),
  'Italy': () => ({ lat: 41.9028 + rand(6), lng: 12.4964 + rand(6), country: 'Italy' }),
  'South Asia': () => {
    const locations = [
      { lat: 28.6139, lng: 77.2090, country: 'India' },
      { lat: 23.8103, lng: 90.4125, country: 'Bangladesh' },
      { lat: 6.9271, lng: 79.8612, country: 'Sri Lanka' },
    ]
    const loc = locations[Math.floor(Math.random() * locations.length)]
    return { lat: loc.lat + rand(2), lng: loc.lng + rand(2), country: loc.country }
  },
  'Ireland': () => ({ lat: 53.3498 + rand(4), lng: -6.2603 + rand(4), country: 'Ireland' }),
  'United Kingdom': () => ({ lat: 51.5074 + rand(5), lng: -0.1278 + rand(5), country: 'United Kingdom' }),
  'India': () => ({ lat: 28.6139 + rand(5), lng: 77.2090 + rand(5), country: 'India' }),
  'Austria': () => ({ lat: 48.2082 + rand(1), lng: 16.3738 + rand(1), country: 'Austria' }),
  'Croatia': () => ({ lat: 45.8150 + rand(1), lng: 15.9819 + rand(1), country: 'Croatia' }),
  'Australasia': () => {
    const locations = [
      { lat: -25.2744, lng: 133.7751, country: 'Australia' },
      { lat: -41.2865, lng: 174.7762, country: 'New Zealand' },
    ]
    const loc = locations[Math.floor(Math.random() * locations.length)]
    return { lat: loc.lat + rand(5), lng: loc.lng + rand(5), country: loc.country }
  },
  'Lithuania': () => ({ lat: 54.6872 + rand(1), lng: 25.2797 + rand(1), country: 'Lithuania' }),
  'Denmark': () => ({ lat: 55.6761 + rand(1), lng: 12.5683 + rand(1), country: 'Denmark' }),
  'Slovakia': () => ({ lat: 48.1486 + rand(1), lng: 17.1077 + rand(1), country: 'Slovakia' }),
  'Thailand': () => ({ lat: 13.7563 + rand(2), lng: 100.5018 + rand(2), country: 'Thailand' }),
  'Estonia': () => ({ lat: 59.4370 + rand(1), lng: 24.7536 + rand(1), country: 'Estonia' }),
  'Turkey': () => ({ lat: 41.0082 + rand(6), lng: 28.9784 + rand(6), country: 'Turkey' }),
  'Indonesia': () => ({ lat: -6.2088 + rand(5), lng: 106.8456 + rand(5), country: 'Indonesia' }),
  'Poland': () => ({ lat: 52.2297 + rand(5), lng: 21.0122 + rand(5), country: 'Poland' }),
  'West Asia': () => {
    const locations = [
      { lat: 25.2048, lng: 55.2708, country: 'United Arab Emirates' },
      { lat: 24.7136, lng: 46.6753, country: 'Saudi Arabia' },
      { lat: 29.3759, lng: 47.9774, country: 'Kuwait' },
    ]
    const loc = locations[Math.floor(Math.random() * locations.length)]
    return { lat: loc.lat + rand(2), lng: loc.lng + rand(2), country: loc.country }
  },
}

// Random offset helper
function rand(range: number): number {
  return (Math.random() - 0.5) * range
}

async function updateTraderLocations() {
  console.log('🗺️  Starting trader location update...')
  
  // Fetch all traders from database with Twitter usernames
  const allTraders = await prisma.trader.findMany({
    select: {
      address: true,
      displayName: true,
      twitterUsername: true,
    }
  })
  console.log(`📊 Found ${allTraders.length} traders in database`)
  
  let updated = 0
  let notFound = 0
  
  for (const [twitterUsername, location] of Object.entries(TRADER_LOCATIONS)) {
    // Find trader by twitterUsername (case-insensitive, exact match)
    const trader = allTraders.find(t => {
      if (!t.twitterUsername) return false
      
      // Remove @ if present
      const cleanTwitter = t.twitterUsername.replace('@', '').toLowerCase()
      const cleanSearch = twitterUsername.replace('@', '').toLowerCase()
      
      return cleanTwitter === cleanSearch
    })
    
    if (!trader) {
      console.log(`   ⚠️  Trader not found: @${twitterUsername}`)
      notFound++
      continue
    }
    
    // Get coordinates for this location
    const coordsFn = COORDINATES[location]
    if (!coordsFn) {
      console.log(`   ⚠️  Unknown location: ${location} for ${twitterUsername}`)
      continue
    }
    
    const coords = coordsFn()
    
    // Update trader in database
    await prisma.trader.update({
      where: { address: trader.address },
      data: {
        latitude: coords.lat,
        longitude: coords.lng,
        country: coords.country,
      }
    })
    
    console.log(`   ✅ @${twitterUsername} (${trader.displayName}) → ${coords.country} (${coords.lat.toFixed(2)}, ${coords.lng.toFixed(2)})`)
    updated++
  }
  
  console.log('\n📊 Summary:')
  console.log(`   ✅ Updated: ${updated} traders`)
  console.log(`   ⚠️  Not found: ${notFound} traders`)
  console.log('✅ Location update complete!')
}

updateTraderLocations()
  .then(() => {
    console.log('✅ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
