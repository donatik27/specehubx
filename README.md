# SpaceHub - Polymarket Smart Money Tracker

🛸 Космічна система відстеження "розумних грошей" на Polymarket. Відслідковує найкращих трейдерів, їх позиції та alpha markets з pixelated alien design.

## 🏗️ Архітектура

Проєкт використовує монорепо (Turborepo + pnpm) з наступною структурою:

```
polymarket-smart-money/
├── apps/
│   ├── api/          # NestJS API сервер
│   ├── web/          # Next.js фронтенд
│   └── worker/       # BullMQ worker для ingestion та обчислень
├── packages/
│   ├── database/     # Prisma schema та клієнт
│   └── shared/       # Спільні типи та константи
└── docker-compose.yml
```

## 📋 Вимоги

- **Node.js**: >= 18.0.0
- **pnpm**: >= 8.0.0
- **Docker**: для PostgreSQL та Redis

## 🚀 Швидкий старт

### 1. Встановлення залежностей

```bash
pnpm install
```

### 2. Запуск інфраструктури (PostgreSQL + Redis)

```bash
docker-compose up -d
```

Перевірте статус:
```bash
docker-compose ps
```

### 3. Налаштування бази даних

Згенеруйте Prisma клієнт:
```bash
pnpm db:generate
```

Виконайте міграції:
```bash
pnpm db:migrate
```

Заповніть тестовими даними (опціонально):
```bash
cd packages/database
pnpm prisma:seed
```

### 4. Запуск всіх сервісів

```bash
pnpm dev
```

Це запустить одночасно:
- **API**: http://localhost:3001
- **Web UI**: http://localhost:3000
- **Worker**: консольний вивід логів

### 5. Доступ до сервісів

- **Веб-інтерфейс**: http://localhost:3000
- **API**: http://localhost:3001
- **Swagger документація**: http://localhost:3001/api/docs
- **Prisma Studio** (перегляд БД): `pnpm db:studio`

## 📦 Структура пакетів

### `apps/api` - NestJS API

REST API з наступними endpoint'ами:

- `GET /health` - статус системи
- `GET /api/traders` - список трейдерів з фільтрами
- `GET /api/traders/:id` - профіль трейдера
- `GET /api/markets/smart` - smart markets рейтинг
- `GET /api/markets/:id` - деталі ринку

### `apps/web` - Next.js UI

Веб-інтерфейс з темною темою та наступними сторінками:

- **Overview** - загальна статистика
- **Traders** - таблиця трейдерів з фільтрацією
- **Smart Markets** - ринки з концентрацією smart money
- **Markets** - всі ринки
- **Health** - стан системи

### `apps/worker` - Background Jobs

Worker з BullMQ для:

- **Ingestion jobs**: синхронізація leaderboard, markets, trades, positions
- **Scoring jobs**: розрахунок rarity scores та tier'ів
- **Smart markets jobs**: розрахунок smart market scores

Розклад (cron):
- Leaderboard sync: кожні 5 хвилин
- Markets sync: кожні 10 хвилин
- Rarity scores: кожні 30 хвилин
- Smart markets: кожну годину

### `packages/database` - Prisma

Схема БД містить:

- **Trader** - трейдери з метриками PnL, tier, rarity
- **Market** - ринки Polymarket
- **Trade** - історія торгів
- **PositionSnapshot** - знімки позицій
- **MarketSmartStats** - статистика smart money по ринках
- **IngestionState** - стан інкрементальної синхронізації

### `packages/shared` - Спільний код

Типи, константи та утиліти для всіх сервісів.

## 🎯 Концепція: Rarity Score & Tiers

### Rarity Score (0-99999)

Комбінований показник якості трейдера:

- **Базова метрика**: перцентиль realized PnL (log scale)
- **Бонуси**: winRate, profitFactor, стабільність
- **Штрафи**: maxDrawdown, концентрація в одному ринку

### Tier система

- **S**: top 0.1% (найкращі з найкращих)
- **A**: next 0.9% (top 1%)
- **B**: next 4% (top 5%)
- **C**: next 15% (top 20%)
- **D**: next 30% (top 50%)
- **E**: решта

## 🔍 Smart Markets

Ринки ранжуються за **Smart Score**:

```
smartScore = smartWeighted × log(1 + liquidity/volume)
```

Де:
- `smartCount` - кількість трейдерів tier S/A з позиціями
- `smartWeighted` - зважена сума (наприклад, √realizedPnL)
- `smartShare` - частка smart money від загальної

## 🛠️ Команди для розробки

```bash
# Встановлення залежностей
pnpm install

# Запуск всіх сервісів в dev режимі
pnpm dev

# Білд всіх пакетів
pnpm build

# Лінтинг
pnpm lint

# Очистка build артефактів
pnpm clean

# Prisma команди
pnpm db:generate      # Генерація клієнта
pnpm db:migrate       # Міграції
pnpm db:studio        # UI для БД
```

## 🐳 Docker

```bash
# Запуск PostgreSQL + Redis
docker-compose up -d

# Зупинка
docker-compose down

# Логи
docker-compose logs -f

# Перезапуск
docker-compose restart
```

## 🔧 Конфігурація

Всі налаштування в `.env` файлі:

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_HOST/PORT` - Redis конфігурація
- `API_PORT` - порт для NestJS API
- `WORKER_CONCURRENCY` - кількість паралельних jobs
- `POLYMARKET_API_BASE_URL` - base URL Polymarket API
- `RATE_LIMIT_*` - налаштування rate limiting

## 📊 Наступні кроки (Phase 1+)

Поточна реалізація - це **Phase 0**: базова структура з моками.

Наступні етапи:

1. **Phase 1**: Реалізація Polymarket API клієнта
2. **Phase 2**: Реальна ingestion trades/positions
3. **Phase 3**: Алгоритм scoring (rarity + tier)
4. **Phase 4**: Smart markets обчислення
5. **Phase 5**: UI з таблицями, графіками, фільтрами

## 🧪 Тестування

```bash
# TODO: Add tests
# pnpm test
```

## 📝 Ліцензія

Private project

## 👨‍💻 Підтримка

При виникненні проблем:

1. Перевірте логи: `docker-compose logs -f`
2. Перевірте статус БД: `pnpm db:studio`
3. Перевірте здоров'я API: http://localhost:3001/health

---

**Status**: Phase 0 - Infrastructure Ready ✅

Наступний крок: реалізація Polymarket API клієнта та ingestion логіки.

# Database populated
