# Meridian

A personal financial intelligence dashboard covering macro, equities, crypto, commodities, and geopolitics.

![Meridian](https://img.shields.io/badge/status-live-brightgreen)
![GitHub Pages](https://img.shields.io/badge/deployed-GitHub%20Pages-blue)

## Sections

| Section | Coverage |
|---------|----------|
| **Overview** | Mixed feed, everything at a glance |
| **Macro** | Central banks, rates, inflation, employment, GDP, bonds |
| **Equities** | Stocks, indices, earnings, sectors, IPOs |
| **Crypto** | Bitcoin, Ethereum, DeFi, regulation, on-chain |
| **Commodities & FX** | Oil, gold, metals, agriculture, currencies |

## Design

Dark theme inspired by Bloomberg Terminal meets Financial Times. Data-dense, authoritative, clean.

- **Typography**: Source Serif 4 (headlines), Inter (body), JetBrains Mono (data)
- **Colors**: Institutional blue accent on warm dark backgrounds
- **Responsive**: Full desktop sidebar, collapsible on mobile

## Data Sources

- Reuters, Bloomberg (RSS), MarketWatch, CNBC
- CoinDesk, The Block, Decrypt, Cointelegraph
- Seeking Alpha, Yahoo Finance, Investing.com

## Quick Start

```bash
# Fetch latest news
python3 src/newsfetch.py

# Serve locally
python3 -m http.server 8000 -d docs
# Open http://localhost:8000
```

## Automation

GitHub Actions rebuilds the news feed every 3 hours and auto-commits to `docs/data/news.json`. GitHub Pages serves the updated site automatically.

## Structure

```
News/
├── docs/
│   ├── index.html          # Main dashboard
│   ├── css/meridian.css    # Design system
│   ├── js/app.js           # Application logic
│   └── data/news.json      # Generated news data
├── src/
│   └── newsfetch.py        # RSS fetcher + classifier
├── .github/workflows/
│   └── update-news.yml     # Auto-rebuild cron
└── README.md
```

## License

Personal use.
