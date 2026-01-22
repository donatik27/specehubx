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
    // Fetch recent trades from Polymarket
    const tradesRes = await fetch(
      `https://data-api.polymarket.com/v1/trades?user=${address}&limit=100`
    );
    
    if (!tradesRes.ok) {
      return res.json({
        lastTrade: null,
        totalTrades: 0,
        activeDays: 0,
        categoryBreakdown: [],
      });
    }
    
    const trades = await tradesRes.json() as any[];
    
    // Calculate stats
    const lastTrade = trades.length > 0 ? trades[0].timestamp : null;
    const totalTrades = trades.length;
    
    // Count unique days with trades
    const tradeDays = new Set(
      trades.map((t: any) => new Date(t.timestamp).toDateString())
    );
    const activeDays = tradeDays.size;
    
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
      
      // Pop Culture
      if (t.includes('movie') || t.includes('oscars') || t.includes('grammy') ||
          t.includes('celebrity') || t.includes('box office')) {
        return 'Pop Culture';
      }
      
      return 'Other';
    };
    
    // Category breakdown from trades
    const categoryMap = new Map<string, { count: number; volume: number }>();
    
    for (const trade of trades) {
      const category = detectCategory(trade.title || '');
      const volume = parseFloat(trade.size || '0') * parseFloat(trade.price || '0');
      
      if (categoryMap.has(category)) {
        const existing = categoryMap.get(category)!;
        existing.count++;
        existing.volume += volume;
      } else {
        categoryMap.set(category, { count: 1, volume });
      }
    }
    
    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([category, stats]) => ({
        category,
        count: stats.count,
        volume: stats.volume,
        percentage: (stats.count / totalTrades) * 100,
      }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5); // Top 5 categories
    
    res.json({
      lastTrade,
      totalTrades,
      activeDays,
      categoryBreakdown,
    });
  } catch (error: any) {
    console.error('Error fetching activity:', error);
    res.json({
      lastTrade: null,
      totalTrades: 0,
      activeDays: 0,
      categoryBreakdown: [],
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
