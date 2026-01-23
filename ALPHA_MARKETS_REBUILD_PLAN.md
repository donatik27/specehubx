# 🔨 ALPHA MARKETS REBUILD PLAN

## 🚨 ПРОБЛЕМИ (Current State):

### 1. **Entry Price = 0.0%**
- Worker бачить правильні shares
- Але entryPrice розраховується неправильно
- Формула: `balance / totalShares * price`
- Проблема: `totalShares` може бути 0 або неправильним

### 2. **Amount = $0.0K**
- Формула: `shares * entryPrice`
- Якщо entryPrice = 0 → amount = 0

### 3. **SETTLED/CLOSED Markets відображаються**
- Market.closed = true → НЕ МАЄ відображатися
- Фільтр в worker існує але НЕ ПРАЦЮЄ для events

### 4. **Event Structure неправильна**
- Зараз: outcome question як market title
- Має бути: event title + outcomes в колонках

### 5. **Worker НЕ ЗАПУСКАЄТЬСЯ регулярно**
- Scheduler налаштований (кожні 30 хв)
- Але jobs НЕ виконуються
- Можливо BullMQ queue застряг

---

## ✅ РІШЕННЯ:

### **WORKER FIXES:**

1. **Fix Entry Price Calculation:**
```typescript
// OLD (неправильно):
entryPrice: balance / totalBalance * currentPrice

// NEW (правильно):
entryPrice: currentPrice // Використовувати ПОТОЧНУ ціну outcome
```

2. **Fix Amount Calculation:**
```typescript
// OLD (неправильно):
amount: shares * entryPrice

// NEW (правильно):
amount: balance * currentPrice // balance вже в shares
```

3. **Fix CLOSED Market Filter:**
```typescript
// В analyzeEvent():
const eventMarkets = eventData.markets.filter(m => 
  !m.closed &&              // НЕ закритий
  m.endDate > new Date() && // Ще не закінчився
  m.outcomePrices           // Має ціни
)
```

4. **Fix Event Structure:**
```typescript
// В saveEvent():
await prisma.market.upsert({
  create: {
    question: eventData.title,  // EVENT TITLE (не outcome question!)
    eventSlug: eventData.slug,
    // ... інші поля ...
  }
})
```

5. **Clear BullMQ Queue:**
```typescript
// Додати в index.ts при startup:
await queues.smartMarkets.obliterate({ force: true })
```

---

### **FRONTEND FIXES:**

1. **Detect Event vs Single Market:**
```typescript
function isEvent(market: any): boolean {
  return Array.isArray(market.topTraders) && 
         market.topTraders.length > 0 &&
         typeof market.topTraders[0] === 'object' &&
         'marketId' in market.topTraders[0] // Event має marketId в traders
}
```

2. **Display Event Title:**
```tsx
<h1>{market.eventTitle || market.question}</h1>
```

3. **Display Outcomes in Columns:**
```tsx
{market.topTraders.map((outcome) => (
  <div key={outcome.marketId}>
    <h3>{extractShortName(outcome.question)}</h3>
    {outcome.traders.map((trader) => (
      <div>
        {trader.displayName} [{trader.tier}]
        <span>{trader.side}</span>
        <span>Entry: {(trader.entryPrice * 100).toFixed(1)}%</span>
        <span>${(trader.shares * trader.entryPrice / 1000).toFixed(1)}K</span>
      </div>
    ))}
  </div>
))}
```

---

## 🎯 IMPLEMENTATION ORDER:

1. ✅ **CLEANUP DB** (CLEANUP_ALPHA_MARKETS.sql)
2. 🔧 **FIX WORKER** (smart-markets.worker.ts)
3. 🎨 **FIX FRONTEND** (page.tsx + [marketId]/page.tsx)
4. 🧪 **TEST MANUALLY**
5. 🚀 **DEPLOY**

---

## 📊 SUCCESS CRITERIA:

✅ Entry Price показує реальний %
✅ Amount показує реальну суму
✅ Closed markets НЕ відображаються
✅ Event title показується вгорі
✅ Outcomes в колонках
✅ YES/NO з правого боку
✅ Worker запускається кожні 30 хв
✅ Знаходить 10+ нових маркетів

---

## 🚀 READY TO START!

Чекаю підтвердження для початку виправлення!
