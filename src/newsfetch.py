#!/usr/bin/env python3
"""
Meridian News Fetcher
Pulls from multiple RSS feeds across macro, equities, crypto, commodities.
Outputs structured JSON for the frontend.
"""

import json
import re
import sys
import hashlib
from datetime import datetime, timezone, timedelta
from pathlib import Path

try:
    import feedparser
except ImportError:
    print("feedparser not installed, installing...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "feedparser", "-q"])
    import feedparser

try:
    import requests
except ImportError:
    print("requests not installed, installing...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests", "-q"])
    import requests


# ============================================================
# FEED SOURCES — organized by category
# ============================================================
FEEDS = {
    "macro": [
        ("Reuters Business", "https://feeds.reuters.com/reuters/businessNews"),
        ("MarketWatch Top", "https://feeds.content.dowjones.io/public/rss/mw_topstories"),
        ("MarketWatch Economy", "https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines"),
        ("CNBC Economy", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258"),
        ("Yahoo Finance", "https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC,^IXIC,^DJI&region=US&lang=en-US"),
    ],
    "equities": [
        ("CNBC Markets", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258"),
        ("CNBC Finance", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664"),
        ("Seeking Alpha", "https://seekingalpha.com/market_currents.xml"),
    ],
    "crypto": [
        ("CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss/"),
        ("The Block", "https://www.theblock.co/rss.xml"),
        ("Decrypt", "https://decrypt.co/feed"),
        ("Cointelegraph", "https://cointelegraph.com/rss"),
    ],
    "commodities": [
        ("CNBC Commodities", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000324"),
        ("Investing.com Commodities", "https://www.investing.com/rss/news_14.rss"),
    ],
    "geopolitical": [
        ("CNBC World", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100727362"),
        ("Reuters World", "https://feeds.reuters.com/reuters/worldNews"),
    ],
}

# Category keywords for auto-classification
CATEGORY_KEYWORDS = {
    "macro": [
        "fed", "federal reserve", "interest rate", "inflation", "gdp", "unemployment",
        "jobs", "payroll", "cpi", "pce", "treasury", "bond", "yield", "monetary policy",
        "fiscal", "deficit", "debt ceiling", "recession", "central bank", "ecb", "boj",
        "rate hike", "rate cut", "quantitative", "stimulus", "economic growth",
    ],
    "equities": [
        "stock", "equity", "s&p", "nasdaq", "dow jones", "earnings", "ipo", "ipo price",
        "wall street", "shares", "dividend", "buyback", "sector", "tech stocks",
        "apple", "microsoft", "nvidia", "google", "amazon", "tesla", "meta",
        "semiconductor", "chip stock", "analyst upgrade", "analyst downgrade",
    ],
    "crypto": [
        "bitcoin", "btc", "ethereum", "eth", "crypto", "defi", "nft", "stablecoin",
        "solana", "sol", "binance", "coinbase", "blockchain", "token", "altcoin",
        "memecoin", "dogecoin", "doge", "xrp", "ripple", "mining", "halving",
        "web3", "dao", "dex", "swap", "on-chain", "onchain",
    ],
    "commodities": [
        "oil", "crude", "brent", "wti", "gold", "silver", "copper", "platinum",
        "commodity", "commodities", "natural gas", "lng", "opec", "agriculture",
        "wheat", "corn", "soybean", "forex", "dollar", "euro", "yen", "yuan",
        "currency", "fx", "exchange rate", "dxy",
    ],
    "geopolitical": [
        "war", "conflict", "sanction", "tariff", "trade war", "election", "geopolit",
        "nato", "military", "missile", "nuclear", "peace", "ceasefire", "invasion",
        "diplomacy", "embargo", "regulation", "legislation", "congress", "senate",
    ],
}


def classify_article(title, description, source_name):
    """Classify an article into a category based on keywords."""
    text = f"{title} {description} {source_name}".lower()

    scores = {}
    for cat, keywords in CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            scores[cat] = score

    if not scores:
        return "macro"  # default

    return max(scores, key=scores.get)


def assess_impact(title, description):
    """Simple impact assessment based on keywords."""
    text = f"{title} {description}".lower()

    high_impact = [
        "fed", "federal reserve", "rate hike", "rate cut", "crash", "collapse",
        "jobs report", "payroll", "inflation", "cpi", "recession", "war",
        "invasion", "sanction", "bitcoin", "ethereum", "ipo", "bank failure",
        "default", "crisis", "emergency", "record high", "record low",
        "tariff", "trade war", "geopolit",
    ]

    medium_impact = [
        "earnings", "gdp", "unemployment", "oil", "gold", "treasury",
        "yield", "bond", "sector", "regulation", "legislation", "upgrade",
        "downgrade", "buyback", "dividend", "merger", "acquisition",
    ]

    high_count = sum(1 for kw in high_impact if kw in text)
    medium_count = sum(1 for kw in medium_impact if kw in text)

    if high_count >= 2:
        return "high"
    elif high_count >= 1 or medium_count >= 2:
        return "medium"
    return "low"


def clean_html(text):
    """Strip HTML tags."""
    if not text:
        return ""
    return re.sub(r'<[^>]+>', '', text).strip()


def parse_date(entry):
    """Parse feed entry date into ISO format."""
    for field in ['published_parsed', 'updated_parsed']:
        parsed = entry.get(field)
        if parsed:
            try:
                dt = datetime(*parsed[:6], tzinfo=timezone.utc)
                return dt.isoformat()
            except Exception as e:
                logging.warning(f"Date parse failed: {e}")
                pass

    for field in ['published', 'updated']:
        raw = entry.get(field)
        if raw:
            try:
                # Try common formats
                for fmt in [
                    '%a, %d %b %Y %H:%M:%S %z',
                    '%a, %d %b %Y %H:%M:%S %Z',
                    '%Y-%m-%dT%H:%M:%S%z',
                    '%Y-%m-%dT%H:%M:%SZ',
                ]:
                    try:
                        return datetime.strptime(raw.strip(), fmt).isoformat()
                    except ValueError:
                        continue
            except Exception as e:
                logging.warning(f"Date parse failed for raw: {e}")
                pass

    return datetime.now(timezone.utc).isoformat()


def deduplicate(articles):
    """Remove duplicates by title similarity."""
    seen = set()
    unique = []
    for article in articles:
        # Simple dedup by title hash
        title_key = re.sub(r'[^a-z0-9]', '', article['title'].lower())
        title_hash = hashlib.md5(title_key.encode()).hexdigest()[:12]

        if title_hash not in seen:
            seen.add(title_hash)
            unique.append(article)

    return unique


def fetch_feeds():
    """Fetch all RSS feeds and return structured articles."""
    articles = []

    for category, sources in FEEDS.items():
        for source_name, url in sources:
            try:
                feed = feedparser.parse(url)
                for entry in feed.entries[:15]:  # Max 15 per source
                    title = clean_html(entry.get('title', ''))
                    if not title:
                        continue

                    description = ''
                    # Try multiple fields for summary
                    for desc_field in ['summary', 'description']:
                        raw = entry.get(desc_field, '')
                        if raw:
                            description = clean_html(raw)
                            break
                    if not description and entry.get('content'):
                        try:
                            description = clean_html(entry['content'][0].get('value', ''))
                        except (IndexError, AttributeError, TypeError):
                            pass

                    # Truncate description
                    if len(description) > 300:
                        description = description[:297] + '...'

                    # Classify and assess
                    auto_category = classify_article(title, description, source_name)
                    impact = assess_impact(title, description)

                    # Use feed category if it's a primary source, otherwise auto-classify
                    final_category = category if category != "geopolitical" else auto_category
                    if category == "geopolitical" and auto_category != "geopolitical":
                        final_category = auto_category

                    article = {
                        "title": title,
                        "summary": description,
                        "url": entry.get('link', ''),
                        "source": source_name,
                        "category": final_category,
                        "impact": impact,
                        "published": parse_date(entry),
                    }
                    articles.append(article)

            except Exception as e:
                print(f"  Error fetching {source_name}: {e}", file=sys.stderr)

    # Deduplicate
    articles = deduplicate(articles)

    # Sort by date (newest first)
    articles.sort(key=lambda a: a.get('published', ''), reverse=True)

    return articles


def main():
    print("Meridian News Fetcher")
    print("=" * 50)

    articles = fetch_feeds()

    output = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "count": len(articles),
        "sources": list(set(a["source"] for a in articles)),
        "articles": articles,
    }

    # Write to data directory
    output_path = Path("docs/data/news.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\nFetched {len(articles)} articles")
    print(f"Sources: {', '.join(output['sources'])}")
    print(f"Output: {output_path}")

    # Category breakdown
    cats = {}
    for a in articles:
        cat = a['category']
        cats[cat] = cats.get(cat, 0) + 1
    print(f"Categories: {cats}")


if __name__ == "__main__":
    main()
