import express from 'express';
import { prisma } from '@polymarket/database';
import telegramAlertsRouter from './telegram-alerts';
import { initDatabase } from './init-db';

// Force rebuild - v2
const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3001;

// CORS - allow Python bot to send alerts
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// Telegram alerts integration
app.use('/api/telegram-alerts', telegramAlertsRouter);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Trigger worker job (for testing/manual updates)
app.post('/api/trigger-job', async (req, res) => {
  try {
    const { jobName } = req.body;
    if (!jobName) {
      return res.status(400).json({ error: 'jobName required' });
    }

    // Forward to worker via simple HTTP call
    // NOTE: This requires worker to have HTTP endpoint, or use BullMQ directly
    // For now, just return success (job will run via scheduler)
    res.json({ 
      success: true, 
      message: `Job "${jobName}" will run via scheduler within 5 minutes`,
      note: 'Manual trigger not yet implemented - use scheduler'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/test-db', async (_req, res) => {
  try {
    const smartMarkets = await prisma.marketSmartStats.count();
    const traders = await prisma.trader.count();
    const mappedTraders = await prisma.trader.count({
      where: { latitude: { not: null } },
    });
    const multiOutcome = await prisma.multiOutcomePosition.count();

    res.json({
      success: true,
      databaseUrl: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
      counts: { smartMarkets, traders, mappedTraders, multiOutcome },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      databaseUrl: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
    });
  }
});

app.get('/api/traders', async (_req, res) => {
  try {
    // NOTE:
    // Some historical records may contain the same wallet address with different casing.
    // That can cause the UI to miss Twitter-linked profiles because the "top-1000" query
    // might pick the non-twitter duplicate. We dedupe by lower(address) and prefer the
    // record that has twitterUsername when available.
    const traders = await prisma.trader.findMany({
      select: {
        address: true,
        displayName: true,
        profilePicture: true,
        twitterUsername: true,
        tier: true,
        rarityScore: true,
        realizedPnl: true,
        totalPnl: true,
        winRate: true,
        tradeCount: true,
        latitude: true,
        longitude: true,
      },
      orderBy: { totalPnl: 'desc' },
      take: 5000,
    });

    const deduped = new Map<string, (typeof traders)[number]>();
    for (const t of traders) {
      const key = t.address.toLowerCase();
      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, t);
        continue;
      }

      const existingHasTwitter = !!(existing.twitterUsername && String(existing.twitterUsername).trim());
      const candidateHasTwitter = !!(t.twitterUsername && String(t.twitterUsername).trim());

      // Prefer twitter-linked record over non-twitter record
      if (!existingHasTwitter && candidateHasTwitter) {
        deduped.set(key, t);
        continue;
      }

      // Otherwise prefer higher totalPnl
      if (Number(t.totalPnl) > Number(existing.totalPnl)) {
        deduped.set(key, t);
      }
    }

    // Sort: X traders first (by PnL), then regular traders
    const formattedTraders = Array.from(deduped.values())
      .sort((a, b) => {
        const aHasTwitter = !!(a.twitterUsername && String(a.twitterUsername).trim());
        const bHasTwitter = !!(b.twitterUsername && String(b.twitterUsername).trim());
        
        // X traders always come first
        if (aHasTwitter && !bHasTwitter) return -1;
        if (!aHasTwitter && bHasTwitter) return 1;
        
        // Within same group, sort by PnL
        return Number(b.totalPnl) - Number(a.totalPnl);
      })
      .slice(0, 1000)
      .map((t) => ({
        address: t.address,
        displayName: t.displayName || 'Unknown Trader',
        avatar: t.profilePicture || `https://api.dicebear.com/7.x/shapes/svg?seed=${t.address}`,
        tier: t.tier,
        rarityScore: t.rarityScore,
        estimatedPnL: Number(t.realizedPnl),
        volume: 0, // TODO: Will be available after migration
        winRate: t.winRate,
        tradeCount: t.tradeCount,
        verified: !!t.twitterUsername,
        xUsername: t.twitterUsername,
        onRadar: !!(t.latitude && t.longitude),
      }));

    res.json(formattedTraders);
  } catch (error) {
    console.error('Failed to fetch traders:', error);
    res.status(500).json({ error: 'Failed to fetch traders' });
  }
});

app.get('/api/traders-with-location', async (_req, res) => {
  try {
    const traders = await prisma.trader.findMany({
      where: {
        AND: [{ latitude: { not: null } }, { longitude: { not: null } }],
      },
      select: {
        address: true,
        displayName: true,
        profilePicture: true,
        tier: true,
        rarityScore: true,
        latitude: true,
        longitude: true,
        country: true,
        totalPnl: true,
        winRate: true,
      },
      orderBy: { rarityScore: 'desc' },
    });

    const serializedTraders = traders.map((trader: any) => ({
      ...trader,
      totalPnl: Number(trader.totalPnl),
      latitude: trader.latitude,
      longitude: trader.longitude,
    }));

    res.json(serializedTraders);
  } catch (error) {
    console.error('Failed to fetch traders with location:', error);
    res.status(500).json({ error: 'Failed to fetch traders' });
  }
});

// Alias for map page (same as traders-with-location)
app.get('/api/traders-map-static', async (_req, res) => {
  try {
    const traders = await prisma.trader.findMany({
      where: {
        AND: [
          { latitude: { not: null } },
          { longitude: { not: null } },
          { twitterUsername: { not: null } }, // Only X traders for map
        ],
      },
      select: {
        address: true,
        displayName: true,
        profilePicture: true,
        twitterUsername: true,
        tier: true,
        rarityScore: true,
        latitude: true,
        longitude: true,
        country: true,
        totalPnl: true,
        winRate: true,
      },
      orderBy: { totalPnl: 'desc' },
    });

    const serializedTraders = traders.map((trader: any) => ({
      ...trader,
      totalPnl: Number(trader.totalPnl),
      latitude: Number(trader.latitude),
      longitude: Number(trader.longitude),
    }));

    res.json(serializedTraders);
  } catch (error) {
    console.error('Failed to fetch map traders:', error);
    res.status(500).json({ error: 'Failed to fetch traders' });
  }
});

// NEW: Enrich static map data with real trader data from DB
app.post('/api/traders-map-enriched', async (req, res) => {
  try {
    // Receive static traders (with coordinates) from frontend
    const staticTraders = req.body.traders || [];
    
    if (staticTraders.length === 0) {
      return res.json([]);
    }

    // Extract Twitter usernames
    const twitterUsernames = staticTraders
      .map((t: any) => t.xUsername)
      .filter((u: any) => u);

    // Fetch real traders from DB by Twitter username
    const dbTraders = await prisma.trader.findMany({
      where: {
        twitterUsername: {
          in: twitterUsernames,
        },
      },
      select: {
        address: true,
        displayName: true,
        profilePicture: true,
        twitterUsername: true,
        tier: true,
        totalPnl: true,
        rarityScore: true,
        winRate: true,
      },
    });

    // Create map: Twitter username -> real trader data
    const traderMap = new Map(
      dbTraders.map((t) => [t.twitterUsername?.toLowerCase(), t])
    );

    // Merge: static coordinates + real data (ONLY return real traders!)
    const enrichedTraders = staticTraders
      .map((staticTrader: any) => {
        const realTrader = traderMap.get(staticTrader.xUsername?.toLowerCase());

        if (realTrader) {
          // Use real data with static coordinates
          return {
            address: realTrader.address, // REAL address
            displayName: realTrader.displayName || staticTrader.displayName,
            profilePicture: realTrader.profilePicture || staticTrader.avatar,
            tier: realTrader.tier,
            xUsername: staticTrader.xUsername,
            latitude: staticTrader.latitude, // Static coordinates
            longitude: staticTrader.longitude, // Static coordinates
            country: staticTrader.country,
            totalPnl: Number(realTrader.totalPnl), // REAL PnL
            rarityScore: realTrader.rarityScore,
            winRate: realTrader.winRate,
          };
        }

        // NOT FOUND: Skip trader (no fake data!)
        return null;
      })
      .filter((t: any) => t !== null); // Remove nulls (traders not in DB)

    res.json(enrichedTraders);
  } catch (error) {
    console.error('Failed to enrich map traders:', error);
    res.status(500).json({ error: 'Failed to enrich map traders' });
  }
});

// DEBUG: Check recently discovered markets
app.get('/api/debug/discovered-markets', async (_req, res) => {
  try {
    const recentStats = await prisma.marketSmartStats.findMany({
      where: {
        computedAt: {
          gte: new Date(Date.now() - 2 * 60 * 60 * 1000), // Last 2 hours
        },
        isPinned: false,
      },
      include: {
        market: {
          select: {
            id: true,
            question: true,
            status: true,
            endDate: true,
          },
        },
      },
      orderBy: { computedAt: 'desc' },
    });

    const now = new Date();
    const analysis = recentStats.map(stat => {
      const market = stat.market;
      const endDate = market.endDate ? new Date(market.endDate) : null;
      const statusOK = market.status === 'OPEN';
      const endDateOK = !endDate || endDate >= now;
      
      return {
        question: market.question,
        status: market.status,
        statusOK,
        endDate: endDate?.toISOString() || null,
        endDateOK,
        passesFilter: statusOK && endDateOK,
        smartCount: stat.smartCount,
        computedAt: stat.computedAt.toISOString(),
      };
    });

    res.json({
      total: analysis.length,
      passing: analysis.filter(a => a.passesFilter).length,
      blocked: analysis.filter(a => !a.passesFilter).length,
      markets: analysis,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/smart-markets', async (_req, res) => {
  try {
    const stats = await prisma.marketSmartStats.findMany({
      where: {
        computedAt: {
          gte: new Date(Date.now() - 48 * 60 * 60 * 1000),
        },
        market: {
          status: 'OPEN',  // ✅ Only OPEN markets, not CLOSED or RESOLVED
          endDate: {
            gte: new Date()  // ✅ Only markets with future endDate
          }
        }
      },
      orderBy: [{ smartScore: 'desc' }, { smartCount: 'desc' }],
      take: 20,
      include: {
        market: {
          select: {
            id: true,
            question: true,
            category: true,
            volume: true,
            liquidity: true,
            endDate: true,
            slug: true,
            eventSlug: true,
          },
        },
      },
    });

    const enriched = stats.map((stat: any) => {
      // Determine category from question if not provided
      let category = stat.market.category || 'Market';
      if (!stat.market.category || stat.market.category === 'Uncategorized') {
        const q = stat.market.question.toLowerCase();
        if (q.includes('trump') || q.includes('biden') || q.includes('election') || q.includes('president')) {
          category = 'Politics';
        } else if (q.includes('btc') || q.includes('eth') || q.includes('crypto') || q.includes('bitcoin')) {
          category = 'Crypto';
        } else if (q.includes('nba') || q.includes('nfl') || q.includes('sport') || q.includes('game')) {
          category = 'Sports';
        } else {
          category = 'Market';
        }
      }
      
      return {
        marketId: stat.marketId,
        question: stat.market.question,
        category,
        volume: stat.market.volume ? Number(stat.market.volume) : 0,
        liquidity: stat.market.liquidity ? Number(stat.market.liquidity) : 0,
        endDate: stat.market.endDate,
        smartCount: stat.smartCount,
        smartWeighted: Number(stat.smartWeighted),
        smartScore: Number(stat.smartScore),
        topTraders: stat.topSmartTraders || [],
        lastUpdate: stat.computedAt,
        isPinned: stat.isPinned,
        priority: stat.priority,
        marketSlug: stat.market.slug,
        eventSlug: stat.market.eventSlug,
      };
    });

    const uniqueMarkets = new Map<string, any>();
    for (const market of enriched) {
      const existing = uniqueMarkets.get(market.marketId);
      if (!existing || new Date(market.lastUpdate) > new Date(existing.lastUpdate)) {
        uniqueMarkets.set(market.marketId, market);
      }
    }

    const deduplicated = Array.from(uniqueMarkets.values()).sort(
      (a, b) => b.smartScore - a.smartScore
    );

    // Fetch event titles for multi-outcome markets
    const uniqueEventSlugs = Array.from(
      new Set(deduplicated.map(m => m.eventSlug).filter(Boolean))
    );
    const eventTitles = new Map<string, any>();
    
    for (const eventSlug of uniqueEventSlugs) {
      try {
        const eventRes = await fetch(`https://gamma-api.polymarket.com/events?slug=${eventSlug}`);
        if (eventRes.ok) {
          const events = await eventRes.json();
          if (events && events[0]) {
            eventTitles.set(eventSlug, {
              title: events[0].title,
              marketCount: events[0].markets?.length || 0
            });
          }
        }
      } catch (e) {
        // Skip if event fetch fails
      }
    }
    
    // Add event titles
    deduplicated.forEach(m => {
      if (m.eventSlug && eventTitles.has(m.eventSlug)) {
        const eventInfo = eventTitles.get(m.eventSlug);
        m.eventTitle = eventInfo.title;
        m.outcomeCount = eventInfo.marketCount;
      }
    });

    // ✅ FILTER: Only show ACTIVE markets (not ended/resolved)
    const now = Date.now();
    const activeMarkets = deduplicated.filter(m => {
      // Skip markets where endDate has passed
      if (m.endDate) {
        const endDate = new Date(m.endDate).getTime();
        if (endDate < now) {
          return false;
        }
      }
      return true;
    });

    res.json(activeMarkets);
  } catch (error: any) {
    console.error('❌ API error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/markets', async (_req, res) => {
  try {
    const response = await fetch('https://gamma-api.polymarket.com/markets?closed=false&limit=100');

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = (await response.json()) as any[];
    const sorted = data
      .map((m: any) => {
        let tokenIds: any[] = [];
        try {
          tokenIds =
            typeof m.clobTokenIds === 'string' ? JSON.parse(m.clobTokenIds) : m.clobTokenIds || [];
        } catch {
          console.warn(`Failed to parse clobTokenIds for market ${m.id}`);
        }

        let outcomes = ['YES', 'NO'];
        let outcomePrices = ['0.5', '0.5'];

        try {
          outcomes = typeof m.outcomes === 'string' ? JSON.parse(m.outcomes) : m.outcomes || outcomes;
        } catch {
          console.warn(`Failed to parse outcomes for market ${m.id}`);
        }

        try {
          outcomePrices =
            typeof m.outcomePrices === 'string'
              ? JSON.parse(m.outcomePrices)
              : m.outcomePrices || outcomePrices;
        } catch {
          console.warn(`Failed to parse outcomePrices for market ${m.id}`);
        }

        return {
          id: m.id,
          question: m.question,
          slug: m.slug || '',
          negRiskMarketID: m.negRiskMarketID || null,
          category: m.category || 'Uncategorized',
          volume: m.volumeNum || 0,
          liquidity: m.liquidityNum || 0,
          endDate: m.endDate,
          active: m.active,
          closed: m.closed,
          outcomes,
          outcomePrices,
          clobTokenIds: tokenIds,
        };
      })
      .filter((m: any) => m.clobTokenIds && m.clobTokenIds.length > 0)
      .sort((a: any, b: any) => b.volume - a.volume);

    try {
      const marketIds = sorted.map((m: any) => m.id);
      const dbMarkets = await prisma.market.findMany({
        where: { id: { in: marketIds } },
        select: { id: true, eventSlug: true },
      });
      const marketSlugMap = new Map(dbMarkets.map((m) => [m.id, m.eventSlug]));
      
      // Fetch event titles for multi-outcome markets
      const uniqueEventSlugs = Array.from(new Set(dbMarkets.map(m => m.eventSlug).filter(Boolean)));
      const eventTitles = new Map<string, string>();
      
      for (const eventSlug of uniqueEventSlugs) {
        try {
          const eventRes = await fetch(`https://gamma-api.polymarket.com/events?slug=${eventSlug}`);
          if (eventRes.ok) {
            const events = await eventRes.json();
            if (events && events[0]) {
              eventTitles.set(eventSlug, events[0].title);
            }
          }
        } catch (e) {
          // Skip if event fetch fails
        }
      }
      
      sorted.forEach((m: any) => {
        const eventSlug = marketSlugMap.get(m.id);
        m.eventSlug = eventSlug || null;
        m.eventTitle = eventSlug ? eventTitles.get(eventSlug) : null;
      });
    } catch (e) {
      console.warn('⚠️  Could not enrich with eventSlug', e);
    }

    res.json(sorted);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/event-info', async (req, res) => {
  const eventSlug = req.query.eventSlug as string | undefined;
  
  if (!eventSlug) {
    return res.status(400).json({ error: 'eventSlug required' });
  }

  try {
    // Fetch event from Polymarket API
    const eventRes = await fetch(`https://gamma-api.polymarket.com/events?slug=${eventSlug}`);
    if (!eventRes.ok) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const events = (await eventRes.json()) as any[];
    if (!events || events.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = events[0];
    
    // Get top 10 markets by price (don't filter too aggressively)
    const markets = (event.markets || [])
      .filter((m: any) => !m.closed) // Only exclude closed markets
      .map((m: any) => {
        let price = 0.5;
        try {
          const prices = typeof m.outcomePrices === 'string' 
            ? JSON.parse(m.outcomePrices) 
            : m.outcomePrices;
          if (prices && prices[0]) {
            price = parseFloat(prices[0]) || 0.5;
          }
        } catch (e) {
          // Use default 0.5
        }
        
        return {
          id: m.id,
          question: m.question,
          price: price,
          volume: m.volumeNum || 0
        };
      })
      .sort((a: any, b: any) => b.price - a.price) // Sort by price (highest chance first)
      .slice(0, 10); // TOP 10 only

    res.json({
      eventSlug: event.slug,
      eventTitle: event.title,
      eventDescription: event.description,
      eventImage: event.image,
      totalVolume: event.volume,
      topOutcomes: markets
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/multi-outcome-positions', async (req, res) => {
  const eventSlug = req.query.eventSlug as string | undefined;
  const marketId = req.query.marketId as string | undefined;

  if (!eventSlug && !marketId) {
    return res.status(400).json({ error: 'eventSlug or marketId required' });
  }

  try {
    let targetEventSlug = eventSlug;
    if (marketId && !eventSlug) {
      const position = await prisma.multiOutcomePosition.findFirst({
        where: { marketId },
        select: { eventSlug: true },
      });

      if (position) {
        targetEventSlug = position.eventSlug;
      } else {
        const market = await prisma.market.findUnique({
          where: { id: marketId },
          select: { eventSlug: true },
        });
        targetEventSlug = market?.eventSlug || null;
      }
    }

    if (!targetEventSlug) {
      return res.json({ eventSlug: null, outcomes: [] });
    }

    const positions = await prisma.multiOutcomePosition.findMany({
      where: {
        eventSlug: targetEventSlug,
        computedAt: {
          gte: new Date(Date.now() - 48 * 60 * 60 * 1000),
        },
      },
      orderBy: { shares: 'desc' },
    });

    const outcomeMap = new Map<string, any>();
    for (const p of positions) {
      if (!outcomeMap.has(p.outcomeTitle)) {
        outcomeMap.set(p.outcomeTitle, {
          marketId: p.marketId,
          outcomeTitle: p.outcomeTitle,
          currentPrice: Number(p.currentPrice),
          smartPositions: [],
        });
      }

      outcomeMap.get(p.outcomeTitle).smartPositions.push({
        traderAddress: p.traderAddress,
        traderName: p.traderName,
        shares: Number(p.shares),
        entryPrice: p.entryPrice,
      });
    }

    res.json({
      eventSlug: targetEventSlug,
      outcomes: Array.from(outcomeMap.values()),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/trader/:address', async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();

    const trader = await prisma.trader.findUnique({
      where: { address },
      select: {
        address: true,
        displayName: true,
        profilePicture: true,
        twitterUsername: true,
        tier: true,
        rarityScore: true,
        realizedPnl: true,
        totalPnl: true,
        unrealizedPnl: true,
        winRate: true,
        profitFactor: true,
        maxDrawdown: true,
        tradeCount: true,
        lastActiveAt: true,
        latitude: true,
        longitude: true,
        country: true,
      },
    });

    if (!trader) {
      return res.status(404).json({ error: 'Trader not found' });
    }

    const formattedTrader = {
      address: trader.address,
      displayName: trader.displayName || 'Unknown Trader',
      avatar: trader.profilePicture || `https://api.dicebear.com/7.x/shapes/svg?seed=${trader.address}`,
      tier: trader.tier,
      rarityScore: trader.rarityScore,
      estimatedPnL: Number(trader.realizedPnl),
      volume: 0, // TODO: Will be available after migration
      winRate: trader.winRate,
      tradeCount: trader.tradeCount,
      verified: !!trader.twitterUsername,
      xUsername: trader.twitterUsername,
    };

    res.json(formattedTrader);
  } catch (error) {
    console.error('Failed to fetch trader:', error);
    res.status(500).json({ error: 'Failed to fetch trader' });
  }
});

// Get trader positions from Polymarket CLOB API
app.get('/api/trader/:address/positions', async (req, res) => {
  const { address } = req.params;
  
  try {
    // Fetch positions from Polymarket CLOB API
    const positionsRes = await fetch(`https://clob.polymarket.com/positions/${address}`);
    
    if (!positionsRes.ok) {
      return res.json([]);
    }
    
    const positionsData = await positionsRes.json() as any;
    
    // Transform positions to include market info
    const positions = await Promise.all(
      ((positionsData.data || []) as any[]).slice(0, 10).map(async (pos: any) => {
        try {
          // Fetch market details from gamma API
          const marketRes = await fetch(
            `https://gamma-api.polymarket.com/markets/${pos.market}`
          );
          
          let marketInfo: any = {};
          if (marketRes.ok) {
            marketInfo = await marketRes.json();
          }
          
          const outcome = pos.outcome || 'YES';
          const shares = parseFloat(pos.size || '0');
          const avgPrice = parseFloat(pos.avg_entry_price || '0');
          const currentPrice = parseFloat(marketInfo.outcome_prices?.[outcome] || pos.current_price || '0.5');
          const value = shares * currentPrice;
          const unrealizedPnL = shares * (currentPrice - avgPrice);
          
          return {
            marketId: pos.market,
            question: marketInfo.question || pos.market,
            outcome,
            shares,
            avgPrice,
            currentPrice,
            unrealizedPnL,
            value,
            category: marketInfo.category || 'Unknown',
            image: marketInfo.image || null,
          };
        } catch (e) {
          return null;
        }
      })
    );
    
    // Filter out null positions and sort by value
    const validPositions = positions
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .sort((a, b) => b.value - a.value);
    
    res.json(validPositions);
  } catch (error: any) {
    console.error('Error fetching positions:', error);
    res.json([]);
  }
});

// Get trader activity stats
app.get('/api/trader/:address/activity', async (req, res) => {
  const { address } = req.params;
  
  try {
    // Fetch trader from DB to get real PnL
    const trader = await prisma.trader.findUnique({
      where: { address: address.toLowerCase() },
      select: {
        totalPnl: true,
        realizedPnl: true,
        winRate: true,
        tradeCount: true
      }
    });
    
    const traderPnL = trader ? Number(trader.totalPnl) : 0;
    const traderWinRate = trader ? Number(trader.winRate) : 0.5;
    
    // Fetch CLOSED POSITIONS from Polymarket for REAL PnL data! 💰
    let closedPositionsPnL = 0;
    let closedPositionsByCategory = new Map<string, { pnl: number; volume: number; count: number }>();
    
    try {
      console.log(`🔍 Fetching closed positions for ${address}...`);
      const closedUrl = `https://data-api.polymarket.com/closed-positions?user=${address}&limit=100&sortBy=REALIZEDPNL`;
      console.log(`📡 URL: ${closedUrl}`);
      
      const closedRes = await fetch(closedUrl);
      console.log(`📡 Response status: ${closedRes.status} ${closedRes.statusText}`);
      
      if (closedRes.ok) {
        const closedPositions = await closedRes.json() as any[];
        console.log(`📊 Fetched ${closedPositions.length} closed positions`);
        
        if (closedPositions.length > 0) {
          console.log(`📝 First position sample:`, JSON.stringify(closedPositions[0], null, 2));
        }
        
        const detectCategory = (title: string): string => {
          const t = title.toLowerCase();
          if (t.includes('bitcoin') || t.includes('btc') || t.includes('ethereum') || 
              t.includes('eth') || t.includes('crypto') || t.includes('solana') ||
              t.includes('dogecoin') || t.includes('xrp')) return 'Crypto';
          if (t.includes('trump') || t.includes('biden') || t.includes('election') ||
              t.includes('president') || t.includes('congress') || t.includes('senate') ||
              t.includes('governor') || t.includes('political') || t.includes('white house')) return 'Politics';
          if (t.includes(' fc ') || t.includes('nfl') || t.includes('nba') || 
              t.includes('football') || t.includes('basketball') || t.includes('soccer') ||
              t.includes('win on') || t.includes('championship') || t.includes('super bowl')) return 'Sports';
          if (t.includes('movie') || t.includes('oscars') || t.includes('grammy') ||
              t.includes('celebrity') || t.includes('box office') || t.includes('music') ||
              t.includes('entertainment')) return 'Culture';
          return 'Other';
        };
        
        for (const pos of closedPositions) {
          const pnl = parseFloat(pos.realizedPnl || '0');
          const volume = parseFloat(pos.totalBought || '0') * parseFloat(pos.avgPrice || '0');
          const category = detectCategory(pos.title || '');
          
          console.log(`  📊 ${category}: ${pos.title?.substring(0, 40)}... | PnL: $${pnl.toFixed(2)} | Vol: $${volume.toFixed(2)}`);
          
          closedPositionsPnL += pnl;
          
          if (!closedPositionsByCategory.has(category)) {
            closedPositionsByCategory.set(category, { pnl: 0, volume: 0, count: 0 });
          }
          
          const catData = closedPositionsByCategory.get(category)!;
          catData.pnl += pnl;
          catData.volume += volume;
          catData.count++;
        }
        
        console.log(`💰 Total PnL from closed positions: $${closedPositionsPnL.toFixed(2)}`);
        console.log(`📊 Categories breakdown:`, Object.fromEntries(closedPositionsByCategory));
      } else {
        const errorText = await closedRes.text();
        console.error(`❌ Closed positions API failed: ${closedRes.status}`, errorText);
      }
    } catch (err: any) {
      console.error('❌ Failed to fetch closed positions:', err.message);
    }
    
    // Use closed positions PnL if available, otherwise use DB PnL
    const finalPnL = closedPositionsPnL !== 0 ? closedPositionsPnL : traderPnL;
    console.log(`🎯 Using PnL: $${finalPnL.toFixed(2)} (closed: $${closedPositionsPnL.toFixed(2)}, db: $${traderPnL.toFixed(2)})`);
    console.log(`🎯 Has closed positions data: ${closedPositionsByCategory.size} categories`);
    
    // ✅ PRIMARY: Fetch CLOSED POSITIONS for accurate Win Rate (includes all P&L)
    // CRITICAL: Use sortBy=TIMESTAMP (not REALIZEDPNL) to get MIX of wins/losses!
    // If sortBy=REALIZEDPNL, API returns most profitable first → may miss losses!
    console.log(`🎯 Fetching closed positions for ${address}...`);
    const closedPositionsRes = await fetch(
      `https://data-api.polymarket.com/closed-positions?user=${address}&limit=1000&sortBy=TIMESTAMP&sortDirection=DESC`
    );
    
    let closedPositions: any[] = [];
    if (closedPositionsRes.ok) {
      closedPositions = await closedPositionsRes.json() as any[];
      console.log(`✅ Fetched ${closedPositions.length} closed positions (by TIMESTAMP)`);
      
      // ✅ ALSO fetch worst losses to ensure we have BOTH wins AND losses
      console.log(`🔍 Fetching worst losses (sortBy=REALIZEDPNL ASC)...`);
      const lossesRes = await fetch(
        `https://data-api.polymarket.com/closed-positions?user=${address}&limit=500&sortBy=REALIZEDPNL&sortDirection=ASC`
      );
      
      if (lossesRes.ok) {
        const lossesData = await lossesRes.json() as any[];
        console.log(`✅ Fetched ${lossesData.length} worst positions (likely losses)`);
        
        // Merge and deduplicate (by asset ID)
        const assetIds = new Set(closedPositions.map(p => p.asset));
        const newLosses = lossesData.filter(p => !assetIds.has(p.asset));
        closedPositions = [...closedPositions, ...newLosses];
        console.log(`📊 Total unique closed positions: ${closedPositions.length} (added ${newLosses.length} losses)`);
      }
    } else {
      console.log(`⚠️ Closed positions API failed: ${closedPositionsRes.status}`);
    }
    
    // ✅ FALLBACK: Fetch trades for activity stats (correct endpoint without /v1/)
    console.log(`🔍 Fetching trades for ${address}...`);
    const tradesRes = await fetch(
      `https://data-api.polymarket.com/trades?user=${address}&limit=1000`
    );
    
    if (!tradesRes.ok && closedPositions.length === 0) {
      console.log(`❌ Both APIs failed - returning empty data`);
      return res.json({
        lastTrade: null,
        totalTrades: 0,
        activeDays: 0,
        categoryBreakdown: [],
        trades: [],
      });
    }
    
    const trades = tradesRes.ok ? (await tradesRes.json() as any[]) : [];
    console.log(`📊 Fetched ${trades.length} trades for activity stats`);
    
    // Calculate stats from trades (for activity)
    const lastTrade = trades.length > 0 ? trades[0].timestamp : null;
    const totalTrades = trades.length;
    
    // Count unique days with trades
    const tradeDays = new Set(
      trades.map((t: any) => new Date(t.timestamp * 1000).toDateString())
    );
    const activeDays = tradeDays.size;
    
    console.log(`📊 Activity stats: ${totalTrades} trades, ${activeDays} active days`);
    
    // Helper to detect category from trade title
    const detectCategory = (title: string): string => {
      const t = title.toLowerCase();
      
      // Crypto keywords
      if (t.includes('bitcoin') || t.includes('btc') || t.includes('ethereum') || 
          t.includes('eth') || t.includes('crypto') || t.includes('solana') ||
          t.includes('dogecoin') || t.includes('xrp')) {
        return 'Crypto';
      }
      
      // Politics keywords
      if (t.includes('trump') || t.includes('biden') || t.includes('election') ||
          t.includes('president') || t.includes('congress') || t.includes('senate') ||
          t.includes('governor') || t.includes('political') || t.includes('white house')) {
        return 'Politics';
      }
      
      // Sports keywords
      if (t.includes(' fc ') || t.includes('nfl') || t.includes('nba') || 
          t.includes('football') || t.includes('basketball') || t.includes('soccer') ||
          t.includes('win on') || t.includes('championship') || t.includes('super bowl')) {
        return 'Sports';
      }
      
      // Pop Culture / Culture
      if (t.includes('movie') || t.includes('oscars') || t.includes('grammy') ||
          t.includes('celebrity') || t.includes('box office') || t.includes('music') ||
          t.includes('entertainment')) {
        return 'Culture';
      }
      
      return 'Other';
    };
    
    // Category breakdown from trades - ENHANCED with more metrics!
    const categoryMap = new Map<string, { 
      count: number; 
      volume: number;
      trades: any[];
    }>();
    
    for (const trade of trades) {
      const category = detectCategory(trade.title || '');
      const volume = parseFloat(trade.size || '0') * parseFloat(trade.price || '0');
      
      if (categoryMap.has(category)) {
        const existing = categoryMap.get(category)!;
        existing.count++;
        existing.volume += volume;
        existing.trades.push(trade);
      } else {
        categoryMap.set(category, { count: 1, volume, trades: [trade] });
      }
    }
    
    // ✅ Analyze PnL distribution BEFORE processing
    const pnlAnalysis = {
      positive: closedPositions.filter(p => parseFloat(p.realizedPnl || '0') > 0).length,
      negative: closedPositions.filter(p => parseFloat(p.realizedPnl || '0') < 0).length,
      zero: closedPositions.filter(p => parseFloat(p.realizedPnl || '0') === 0).length,
      null: closedPositions.filter(p => !p.realizedPnl).length
    };
    console.log(`📊 PnL Distribution:`, pnlAnalysis);
    console.log(`   Profitable: ${pnlAnalysis.positive} (${(pnlAnalysis.positive / closedPositions.length * 100).toFixed(1)}%)`);
    console.log(`   Losses: ${pnlAnalysis.negative} (${(pnlAnalysis.negative / closedPositions.length * 100).toFixed(1)}%)`);
    console.log(`   Break-even: ${pnlAnalysis.zero} (${(pnlAnalysis.zero / closedPositions.length * 100).toFixed(1)}%)`);
    console.log(`   No PnL data: ${pnlAnalysis.null}`);
    
    // ✅ PRIMARY SOURCE: Use CLOSED POSITIONS for finished trades (most accurate!)
    console.log(`🎯 Processing ${closedPositions.length} closed positions for win rate...`);
    const finishedTrades = [];
    
    for (const pos of closedPositions) {
      const pnl = parseFloat(pos.realizedPnl || '0');
      const avgPrice = parseFloat(pos.avgPrice || '0');
      const totalBought = parseFloat(pos.totalBought || '0');
      const curPrice = parseFloat(pos.curPrice || '0');
      const timestamp = pos.timestamp || Date.now() / 1000;
      
      // Skip positions with no PnL data
      if (isNaN(pnl) || totalBought === 0) {
        console.log(`⚠️ Skipping position with no PnL: ${pos.title?.substring(0, 30)}...`);
        continue;
      }
      
      const category = detectCategory(pos.title || '');
      
      finishedTrades.push({
        id: `closed_${pos.asset}`,
        timestamp: timestamp,
        title: pos.title || 'Unknown',
        outcome: pos.outcome || 'Unknown',
        side: 'CLOSED',
        size: totalBought,
        buyPrice: avgPrice,
        sellPrice: curPrice,
        price: curPrice,
        profit: pnl, // ✅ Real PnL from API!
        holdTime: 0, // Not available from closed-positions
        category: category,
      });
      
      console.log(`  ${category}: ${pos.title?.substring(0, 40)}... | PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`);
    }
    
    console.log(`✅ Created ${finishedTrades.length} finished trades from closed positions`);
    
    // ✅ Calculate WIN RATE metrics per category from closed positions
    console.log(`📊 Calculating category metrics from ${finishedTrades.length} finished trades...`);
    const categoryMetrics = new Map<string, {
      wins: number;
      losses: number;
      totalProfit: number;
      profits: number[];
      biggestWin: number;
      biggestLoss: number;
      avgHoldTime: number;
      holdTimes: number[];
    }>();
    
    for (const trade of finishedTrades) {
      if (!categoryMetrics.has(trade.category)) {
        categoryMetrics.set(trade.category, {
          wins: 0,
          losses: 0,
          totalProfit: 0,
          profits: [],
          biggestWin: 0,
          biggestLoss: 0,
          avgHoldTime: 0,
          holdTimes: []
        });
      }
      
      const metrics = categoryMetrics.get(trade.category)!;
      metrics.totalProfit += trade.profit;
      metrics.profits.push(trade.profit);
      
      // ✅ Count wins/losses based on REAL PnL
      if (trade.profit > 0) {
        metrics.wins++;
        if (trade.profit > metrics.biggestWin) {
          metrics.biggestWin = trade.profit;
        }
      } else if (trade.profit < 0) {
        metrics.losses++;
        if (trade.profit < metrics.biggestLoss) {
          metrics.biggestLoss = trade.profit;
        }
      }
      // Note: profit === 0 (break-even) not counted in win rate
      
      if (trade.holdTime) {
        metrics.holdTimes.push(trade.holdTime);
      }
    }
    
    // Log category win rates
    console.log(`📊 Category Win Rates:`);
    for (const [category, metrics] of categoryMetrics.entries()) {
      const total = metrics.wins + metrics.losses;
      const winRate = total > 0 ? (metrics.wins / total * 100).toFixed(1) : '0.0';
      console.log(`  ${category}: ${winRate}% (${metrics.wins}W / ${metrics.losses}L from ${total} trades)`);
    }
    
    // ENHANCED: Calculate estimated metrics from ALL trades (not just finished)
    // This provides data even when there are few finished trades!
    const estimatedMetrics = new Map<string, {
      buyVolume: number;
      sellVolume: number;
      buyCount: number;
      sellCount: number;
      avgBuyPrice: number;
      avgSellPrice: number;
      totalSize: number;
    }>();
    
    for (const trade of trades) {
      const category = detectCategory(trade.title || '');
      if (!estimatedMetrics.has(category)) {
        estimatedMetrics.set(category, {
          buyVolume: 0,
          sellVolume: 0,
          buyCount: 0,
          sellCount: 0,
          avgBuyPrice: 0,
          avgSellPrice: 0,
          totalSize: 0
        });
      }
      
      const est = estimatedMetrics.get(category)!;
      const price = parseFloat(trade.price || '0');
      const size = parseFloat(trade.size || '0');
      const volume = price * size;
      
      if (trade.side === 'BUY') {
        est.buyVolume += volume;
        est.buyCount++;
        est.avgBuyPrice = est.buyVolume / est.buyCount;
      } else if (trade.side === 'SELL') {
        est.sellVolume += volume;
        est.sellCount++;
        est.avgSellPrice = est.sellVolume / est.sellCount;
      }
      est.totalSize += size;
    }
    
    // Calculate total volume for proportional PnL distribution
    const totalVolume = Array.from(categoryMap.values()).reduce((sum, stats) => sum + stats.volume, 0);
    
    // Calculate OVERALL win rate from finished trades
    let totalWins = 0;
    let totalLosses = 0;
    for (const metrics of categoryMetrics.values()) {
      totalWins += metrics.wins;
      totalLosses += metrics.losses;
    }
    const overallTotal = totalWins + totalLosses;
    const overallWinRateCalc = overallTotal > 0 ? (totalWins / overallTotal) : (traderWinRate || 0.5);
    
    console.log(`📊 CategoryMap has ${categoryMap.size} categories:`, Array.from(categoryMap.keys()));
    console.log(`💰 Total volume: $${totalVolume.toFixed(2)}`);
    console.log(`🎯 OVERALL WIN RATE: ${(overallWinRateCalc * 100).toFixed(1)}% (${totalWins}W / ${totalLosses}L from ${overallTotal} finished trades)`);
    
    // IMPORTANT: Always include ALL 5 categories for complete radar charts!
    const allCategories = ['Politics', 'Sports', 'Crypto', 'Culture', 'Other'];
    
    // Ensure all categories exist in categoryMap (even with 0 trades)
    for (const cat of allCategories) {
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, { count: 0, volume: 0, trades: [] });
      }
    }
    
    // Calculate enhanced category breakdown with all metrics
    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([category, stats]) => {
        const metrics = categoryMetrics.get(category);
        const estimated = estimatedMetrics.get(category);
        const avgTradeSize = stats.count > 0 ? stats.volume / stats.count : 0;
        
        // ✅ Calculate REAL win rate from finished trades
        let winRate = 0;
        const categoryFinishedTrades = (metrics?.wins || 0) + (metrics?.losses || 0);
        
        if (metrics && categoryFinishedTrades >= 3) {
          // ✅ Use REAL win rate (minimum 3 finished trades for reliability)
          winRate = (metrics.wins / categoryFinishedTrades) * 100;
          console.log(`  ${category}: REAL Win Rate ${winRate.toFixed(1)}% (${metrics.wins}W / ${metrics.losses}L from ${categoryFinishedTrades} trades)`);
        } else if (categoryFinishedTrades > 0) {
          // Mix real + overall for categories with 1-2 finished trades
          const realWR = (metrics!.wins / categoryFinishedTrades) * 100;
          const fallbackWR = overallWinRateCalc * 100;
          winRate = (realWR * 0.7) + (fallbackWR * 0.3);
          console.log(`  ${category}: MIXED Win Rate ${winRate.toFixed(1)}% (${categoryFinishedTrades} trades, mixing ${realWR.toFixed(1)}% real + ${fallbackWR.toFixed(1)}% overall)`);
        } else {
          // Use overall win rate as fallback for categories with no finished trades
          winRate = overallWinRateCalc * 100;
          console.log(`  ${category}: FALLBACK Win Rate ${winRate.toFixed(1)}% (no finished trades, using overall)`);
        }
        
        // Calculate total profit and ROI using REAL data from closed positions! 💰
        let totalProfit = metrics?.totalProfit || 0;
        let roi = 0;
        
        // Priority 1: Use REAL closed positions PnL for this category
        const closedData = closedPositionsByCategory.get(category);
        if (closedData && closedData.pnl !== 0) {
          totalProfit = closedData.pnl;
          // ROI = profit / investment * 100%
          roi = closedData.volume > 0 ? (totalProfit / closedData.volume) * 100 : 0;
          console.log(`  ${category}: REAL PnL $${totalProfit.toFixed(2)}, ROI ${roi.toFixed(2)}%`);
        }
        // Priority 2: Use finished trades profit
        else if (metrics && metrics.totalProfit !== 0) {
          totalProfit = metrics.totalProfit;
          roi = stats.volume > 0 ? (totalProfit / stats.volume) * 100 : 0;
          console.log(`  ${category}: Finished trades PnL $${totalProfit.toFixed(2)}, ROI ${roi.toFixed(2)}%`);
        }
        // Priority 3: Distribute total PnL proportionally
        else if (finalPnL !== 0 && totalVolume > 0) {
          const categoryProportion = stats.volume / totalVolume;
          totalProfit = finalPnL * categoryProportion;
          roi = stats.volume > 0 ? (totalProfit / stats.volume) * 100 : 0;
          console.log(`  ${category}: Distributed PnL $${totalProfit.toFixed(2)}, ROI ${roi.toFixed(2)}%`);
        }
        
        // Calculate avg profit
        let avgProfit = 0;
        if (metrics && (metrics.wins + metrics.losses) > 0) {
          avgProfit = metrics.totalProfit / (metrics.wins + metrics.losses);
        } else if (totalProfit !== 0 && stats.count > 0) {
          // Distribute total profit across all trades
          avgProfit = totalProfit / stats.count;
        }
        
        // Calculate biggest win (use estimated if no finished trades)
        let biggestWin = metrics?.biggestWin || 0;
        if (biggestWin === 0 && totalProfit > 0 && stats.count > 0) {
          // Estimate: assume best trade captured 20-30% of total profit
          biggestWin = totalProfit * 0.25;
        } else if (biggestWin === 0 && avgProfit > 0) {
          // Fallback: 3x average profit
          biggestWin = Math.abs(avgProfit) * 3;
        }
        
        // Calculate avg hold time
        const avgHoldTime = metrics && metrics.holdTimes.length > 0
          ? metrics.holdTimes.reduce((a, b) => a + b, 0) / metrics.holdTimes.length
          : 0;
        
        // Calculate consistency (inverse of coefficient of variation)
        let consistency = 0;
        if (metrics && metrics.profits.length > 1) {
          const mean = metrics.totalProfit / metrics.profits.length;
          const variance = metrics.profits.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / metrics.profits.length;
          const stdDev = Math.sqrt(variance);
          const cv = mean !== 0 ? Math.abs(stdDev / mean) : 0;
          consistency = Math.max(0, 100 - cv * 100);
        } else if (winRate > 0) {
          // Estimate consistency from win rate (higher win rate = more consistent)
          // Win rate 50% = consistency 50%, win rate 70% = consistency 70%
          consistency = Math.min(winRate, 85);
        }
        
        // Ensure all numbers are valid (no NaN, no Infinity)
        const safeNumber = (val: number) => (isNaN(val) || !isFinite(val)) ? 0 : val;
        
        return {
          category,
          count: stats.count,
          volume: safeNumber(stats.volume),
          percentage: safeNumber((stats.count / totalTrades) * 100),
          // ENHANCED METRICS with fallbacks! 🚀
          avgTradeSize: safeNumber(avgTradeSize),
          winRate: safeNumber(winRate),
          totalProfit: safeNumber(totalProfit),
          roi: safeNumber(roi),
          avgProfit: safeNumber(avgProfit),
          biggestWin: safeNumber(biggestWin),
          biggestLoss: safeNumber(metrics?.biggestLoss || 0),
          avgHoldTime: safeNumber(avgHoldTime),
          consistency: safeNumber(consistency),
          finishedTradesCount: metrics ? (metrics.wins + metrics.losses) : 0,
          // Add estimated flag to show data quality
          isEstimated: !metrics || (metrics.wins + metrics.losses) === 0
        };
      })
      .sort((a, b) => b.volume - a.volume); // Sort by volume (highest first)
    
    // ✅ Return enhanced data with win rate from closed positions
    const response = {
      lastTrade,
      totalTrades,
      activeDays,
      categoryBreakdown,
      trades: finishedTrades,
      _metadata: {
        closedPositionsCount: closedPositions.length,
        finishedTradesCount: finishedTrades.length,
        overallWinRate: overallWinRateCalc,
        dataSource: closedPositions.length > 0 ? 'closed-positions' : 'trades-matching'
      }
    };
    
    console.log(`✅ Returning activity data:`, {
      finishedTrades: response.trades.length,
      categories: response.categoryBreakdown.length,
      overallWinRate: `${(overallWinRateCalc * 100).toFixed(1)}%`,
      dataSource: response._metadata.dataSource
    });
    
    res.json(response);
  } catch (error: any) {
    console.error('Error fetching activity:', error);
    res.json({
      lastTrade: null,
      totalTrades: 0,
      activeDays: 0,
      categoryBreakdown: [],
      trades: [],
    });
  }
});

app.get('/api/market-price', async (req, res) => {
  try {
    const marketId = req.query.marketId as string | undefined;
    if (!marketId) {
      return res.status(400).json({ error: 'marketId is required' });
    }

    const response = await fetch(`https://gamma-api.polymarket.com/markets/${marketId}`);
    if (!response.ok) {
      return res.status(404).json({ error: 'Market not found' });
    }

    const data = (await response.json()) as any;
    
    // Parse outcomes and prices
    let outcomes = ['Yes', 'No'];
    let outcomePrices = ['0.5', '0.5'];
    
    try {
      if (data.outcomes) {
        outcomes = typeof data.outcomes === 'string' ? JSON.parse(data.outcomes) : data.outcomes;
      }
    } catch (e) {
      console.warn(`Failed to parse outcomes for ${marketId}`);
    }
    
    try {
      if (data.outcomePrices) {
        outcomePrices = typeof data.outcomePrices === 'string' ? JSON.parse(data.outcomePrices) : data.outcomePrices;
      }
    } catch (e) {
      console.warn(`Failed to parse outcomePrices for ${marketId}`);
    }
    
    // If market is closed or settled, prices might be 1/0 - this is correct!
    // Log for debugging
    console.log(`Market ${marketId}: ${outcomes[0]} ${(parseFloat(outcomePrices[0]) * 100).toFixed(1)}% | ${outcomes[1]} ${(parseFloat(outcomePrices[1]) * 100).toFixed(1)}% | Closed: ${data.closed}`);
    
    const result = {
      marketId,
      outcomes,
      outcomePrices,
      closed: data.closed || false,
      active: data.active || false,
    };

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/event-by-market', async (req, res) => {
  const marketId = req.query.marketId as string | undefined;
  if (!marketId) {
    return res.status(400).json({ error: 'marketId is required' });
  }

  try {
    const marketRes = await fetch(`https://gamma-api.polymarket.com/markets/${marketId}`);
    if (!marketRes.ok) {
      return res.json({ eventSlug: null });
    }
    const market = (await marketRes.json()) as any;

    const eventsRes = await fetch('https://gamma-api.polymarket.com/events?limit=300');
    if (eventsRes.ok) {
      const events = (await eventsRes.json()) as any[];
      for (const event of events) {
        if (event.markets && Array.isArray(event.markets)) {
          const hasThisMarket = event.markets.some((m: any) => m.id === marketId);
          if (hasThisMarket) {
            return res.json({ eventSlug: event.slug });
          }
        }
      }
    }

    if (market.slug) {
      const cleanSlug = String(market.slug)
        .replace(/^will-trump-nominate-[a-z-]+-as-the-next-fed-chair$/i, 'who-will-trump-nominate-as-fed-chair')
        .replace(/^will-trump-nominate-[a-z-]+-as-fed-chair$/i, 'who-will-trump-nominate-as-fed-chair')
        .replace(/-(january|february|march|april|may|june|july|august|september|october|november|december)-\d+(-\d{4})?.*$/i, '')
        .replace(/-\d{6,}.*$/i, '')
        .replace(/-\d+-\d+-\d+.*$/i, '')
        .replace(/-+$/g, '');

      const directRes = await fetch(`https://gamma-api.polymarket.com/events?slug=${cleanSlug}`);
      if (directRes.ok) {
        const directEvents = (await directRes.json()) as any[];
        if (directEvents && directEvents.length > 0) {
          return res.json({ eventSlug: directEvents[0].slug });
        }
      }
    }

    res.json({ eventSlug: null });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/redirect-market/:marketId', async (req, res) => {
  const marketId = req.params.marketId;

  try {
    const market = await prisma.market.findUnique({
      where: { id: marketId },
      select: { eventSlug: true, slug: true, question: true },
    });

    if (market?.eventSlug) {
      return res.redirect(`https://polymarket.com/event/${market.eventSlug}?via=01k`);
    }

    // Fallback to market.slug if available (faster than fetching from API)
    if (market?.slug) {
      return res.redirect(`https://polymarket.com/market/${market.slug}?via=01k`);
    }

    const marketRes = await fetch(`https://gamma-api.polymarket.com/markets/${marketId}`);
    if (!marketRes.ok) {
      return res.redirect('https://polymarket.com?via=01k');
    }

    const marketData = (await marketRes.json()) as any;
    const eventsRes = await fetch('https://gamma-api.polymarket.com/events?limit=1000&closed=false');

    if (eventsRes.ok) {
      const events = (await eventsRes.json()) as any[];
      const parentEvent = events.find((e: any) => {
        if (!e.markets || !Array.isArray(e.markets)) return false;
        return e.markets.some(
          (m: any) => m.id === marketId || (marketData.negRiskMarketID && m.negRiskMarketID === marketData.negRiskMarketID)
        );
      });

      if (parentEvent?.slug) {
        try {
          await prisma.market.upsert({
            where: { id: marketId },
            create: {
              id: marketId,
              question: marketData.question,
              eventSlug: parentEvent.slug,
              slug: marketData.slug,
            },
            update: {
              eventSlug: parentEvent.slug,
              slug: marketData.slug,
            },
          });
        } catch (e) {
          console.warn('Failed to save eventSlug to DB', e);
        }

        return res.redirect(`https://polymarket.com/event/${parentEvent.slug}?via=01k`);
      }
    }

    res.redirect('https://polymarket.com?via=01k');
  } catch (error) {
    console.error('Failed to redirect market:', error);
    res.redirect('https://polymarket.com?via=01k');
  }
});

// Initialize database before starting server
initDatabase().then(() => {
  app.listen(port, () => {
    console.log(`✅ API server running on port ${port}`);
  });
}).catch((error) => {
  console.error('❌ Failed to initialize database:', error);
  // Start API anyway - table might already exist
  app.listen(port, () => {
    console.log(`✅ API server running on port ${port} (DB init failed, but continuing)`);
  });
});
