#!/usr/bin/env tsx
/**
 * Check what markets were discovered and why they're not showing in API
 */

import { prisma } from '@polymarket/database';

async function main() {
  console.log('🔍 Checking recently discovered markets...\n');

  // Get markets computed in last hour (from the discovery job)
  const recentStats = await prisma.marketSmartStats.findMany({
    where: {
      computedAt: {
        gte: new Date(Date.now() - 2 * 60 * 60 * 1000), // Last 2 hours
      },
      isPinned: false, // Only non-pinned (newly discovered)
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

  console.log(`📊 Found ${recentStats.length} recently computed market stats\n`);

  const now = new Date();
  let passCount = 0;
  let failCount = 0;

  for (const stat of recentStats) {
    const market = stat.market;
    const endDate = market.endDate ? new Date(market.endDate) : null;
    
    // Check if would pass API filters
    const statusOK = market.status === 'OPEN';
    const endDateOK = !endDate || endDate >= now;
    const passes = statusOK && endDateOK;

    if (passes) {
      passCount++;
      console.log(`✅ PASS: ${market.question.slice(0, 60)}...`);
      console.log(`   Status: ${market.status}, EndDate: ${endDate?.toISOString() || 'null'}`);
      console.log(`   SmartCount: ${stat.smartCount}, ComputedAt: ${stat.computedAt.toISOString()}\n`);
    } else {
      failCount++;
      console.log(`❌ FAIL: ${market.question.slice(0, 60)}...`);
      console.log(`   Status: ${market.status} (${statusOK ? 'OK' : 'BLOCKED'})`);
      console.log(`   EndDate: ${endDate?.toISOString() || 'null'} (${endDateOK ? 'OK' : 'BLOCKED - in past!'})`);
      console.log(`   SmartCount: ${stat.smartCount}, ComputedAt: ${stat.computedAt.toISOString()}\n`);
    }
  }

  console.log(`\n📈 SUMMARY:`);
  console.log(`   Pass API filters: ${passCount}`);
  console.log(`   Blocked by filters: ${failCount}`);
  console.log(`   Total: ${recentStats.length}\n`);

  // Also check total active markets
  const totalActive = await prisma.marketSmartStats.findMany({
    where: {
      computedAt: {
        gte: new Date(Date.now() - 48 * 60 * 60 * 1000),
      },
      market: {
        status: 'OPEN',
        endDate: {
          gte: new Date(),
        },
      },
    },
  });

  console.log(`📊 Total markets passing API filters (last 48h): ${totalActive.length}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
