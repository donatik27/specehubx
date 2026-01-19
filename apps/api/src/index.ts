import express from 'express';
import { prisma } from '@polymarket/database';

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3001;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
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

    const formattedTraders = Array.from(deduped.values())
      .sort((a, b) => Number(b.totalPnl) - Number(a.totalPnl))
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

app.get('/api/smart-markets', async (_req, res) => {
  try {
    const stats = await prisma.marketSmartStats.findMany({
      where: {
        computedAt: {
          gte: new Date(Date.now() - 48 * 60 * 60 * 1000),
        },
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
            endDate: true,
            slug: true,
            eventSlug: true,
          },
        },
      },
    });

    const enriched = stats.map((stat: any) => ({
      marketId: stat.marketId,
      question: stat.market.question,
      category: stat.market.category || 'Uncategorized',
      volume: stat.market.volume ? Number(stat.market.volume) : 0,
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
    }));

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

    res.json(deduplicated);
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
      sorted.forEach((m: any) => {
        m.eventSlug = marketSlugMap.get(m.id) || null;
      });
    } catch (e) {
      console.warn('⚠️  Could not enrich with eventSlug', e);
    }

    res.json(sorted);
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
    const result = {
      marketId,
      outcomes: data.outcomes ? JSON.parse(data.outcomes) : ['Yes', 'No'],
      outcomePrices: data.outcomePrices ? JSON.parse(data.outcomePrices) : ['0.5', '0.5'],
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

app.listen(port, () => {
  console.log(`✅ API server running on port ${port}`);
});
