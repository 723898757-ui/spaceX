/**
 * spaceX 市场数据引擎
 * 数据来源：
 *   - 加密货币：CoinGecko API (免费, 无需Key)
 *   - 股市/大宗商品：Yahoo Finance 非官方API
 *   - 新闻：Yahoo Finance RSS
 *   - AI 分析：基于数据的规则引擎 + LLM分析建议
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('📊 市场数据引擎启动...');
  initTabs();
  initTicker();
  loadAllData();
  setInterval(loadAllData, 5 * 60 * 1000); // 每5分钟刷新
  setInterval(updateTickerTime, 1000);     // 每秒更新时间
});

// ============================================
// 全局数据状态
// ============================================
const MarketState = {
  crypto: [],
  stocks: {},
  commodities: {},
  forex: {},
  news: [],
  lastUpdate: null,
};

// ============================================
// 标签页切换
// ============================================
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${tab}`)?.classList.add('active');
    });
  });
}

// ============================================
// 顶部价格滚动条
// ============================================
let tickerInterval;
let tickerHTML = '';

function initTicker() {
  tickerHTML = '';
  document.getElementById('tickerInner').innerHTML =
    '<span class="ticker-loading">⏳ 正在连接市场数据...</span>';
}

function buildTickerHTML() {
  const items = [];

  // 加密货币
  MarketState.crypto.slice(0, 6).forEach(coin => {
    const up = coin.price_change_percentage_24h >= 0;
    items.push(`<span class="ticker-item">
      <span class="ticker-name">${coin.symbol.toUpperCase()}</span>
      <span class="ticker-price">$${formatPrice(coin.current_price)}</span>
      <span class="ticker-change ${up ? 'up' : 'down'}">${up ? '+' : ''}${coin.price_change_percentage_24h?.toFixed(2) ?? '0'}%</span>
    </span>`);
  });

  // 股票
  Object.entries(MarketState.stocks).forEach(([name, data]) => {
    if (!data.price) return;
    const up = data.change >= 0;
    items.push(`<span class="ticker-item">
      <span class="ticker-name">${name}</span>
      <span class="ticker-price">${data.price}</span>
      <span class="ticker-change ${up ? 'up' : 'down'}">${up ? '+' : ''}${data.change?.toFixed(2) ?? '0'}%</span>
    </span>`);
  });

  // 大宗商品
  Object.entries(MarketState.commodities).forEach(([name, data]) => {
    if (!data.price) return;
    const up = data.change >= 0;
    items.push(`<span class="ticker-item">
      <span class="ticker-name">${name}</span>
      <span class="ticker-price">${data.price}</span>
      <span class="ticker-change ${up ? 'up' : 'down'}">${up ? '+' : ''}${data.change?.toFixed(2) ?? '0'}%</span>
    </span>`);
  });

  if (items.length === 0) {
    document.getElementById('tickerInner').innerHTML =
      '<span class="ticker-loading">⏳ 正在获取市场数据...</span>';
    return;
  }

  const doubled = items.join('') + items.join('');
  document.getElementById('tickerInner').innerHTML = doubled;
}

// ============================================
// 加载所有数据
// ============================================
async function loadAllData() {
  updateStatusDot('loading');
  try {
    await Promise.all([
      loadCryptoData(),
      loadYahooData(),
      loadNewsData(),
    ]);
    updateUI();
    generateAIAnalysis();
    buildTickerHTML();
    updateStatusDot('ok');
    MarketState.lastUpdate = new Date();
    updateTimeDisplay();
  } catch (err) {
    console.error('数据加载失败:', err);
    updateStatusDot('error');
  }
}

function updateStatusDot(status) {
  const dot = document.getElementById('updateDot');
  if (!dot) return;
  dot.style.background = status === 'ok' ? '#4ade80' : status === 'loading' ? '#fbbf24' : '#f87171';
}

function updateTimeDisplay() {
  const el = document.getElementById('dataTime');
  if (!el) return;
  el.textContent = MarketState.lastUpdate
    ? `数据更新: ${formatTime(MarketState.lastUpdate)}`
    : '数据加载中...';
}

function updateTickerTime() {
  updateTimeDisplay();
}

// ============================================
// 加密货币数据 - CoinGecko API
// ============================================
async function loadCryptoData() {
  try {
    // 获取市值前10的加密货币
    const resp = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?' +
      'vs_currency=usd&order=market_cap_desc&per_page=15&page=1&sparkline=false' +
      '&price_change_percentage=24h,7d'
    );
    if (!resp.ok) throw new Error(`CoinGecko HTTP ${resp.status}`);
    const data = await resp.json();
    MarketState.crypto = data;
    updateCryptoTable();
    updateMarketOverview();
  } catch (err) {
    console.warn('CoinGecko 加载失败，使用缓存数据:', err.message);
    // 尝试使用缓存
    if (MarketState.crypto.length === 0) {
      // 提供静态占位数据
      MarketState.crypto = getMockCryptoData();
    }
  }
}

function updateCryptoTable() {
  const tbody = document.getElementById('cryptoTableBody');
  if (!tbody) return;

  tbody.innerHTML = MarketState.crypto.map(coin => {
    const change24h = coin.price_change_percentage_24h ?? 0;
    const change7d = coin.price_change_percentage_7d_in_currency ?? 0;
    const upClass = change24h >= 0 ? 'change-up' : 'change-down';
    const upClass7d = change7d >= 0 ? 'change-up' : 'change-down';
    return `<tr>
      <td>
        <div class="coin-name">
          <img src="${coin.image}" alt="${coin.name}" class="coin-img" loading="lazy"
               onerror="this.style.display='none'">
          ${coin.name}<span class="coin-symbol">${coin.symbol}</span>
        </div>
      </td>
      <td class="price">$${formatPrice(coin.current_price)}</td>
      <td class="${upClass}">${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%</td>
      <td class="${upClass7d}">${change7d >= 0 ? '+' : ''}${change7d.toFixed(2)}%%</td>
      <td class="market-cap">$${formatLargeNum(coin.market_cap)}</td>
      <td class="volume">$${formatLargeNum(coin.total_volume)}</td>
    </tr>`;
  }).join('');

  const timeEl = document.getElementById('cryptoUpdateTime');
  if (timeEl) timeEl.textContent = formatTime(new Date());
}

function updateMarketOverview() {
  // 填入概览卡片数据
  MarketState.crypto.forEach(coin => {
    if (coin.symbol === 'btc') {
      setStatCard('btc', `$${formatPrice(coin.current_price)}`, coin.price_change_percentage_24h);
    }
    if (coin.symbol === 'eth') {
      setStatCard('eth', `$${formatPrice(coin.current_price)}`, coin.price_change_percentage_24h);
    }
  });

  // 填充贵金属和大宗商品
  if (MarketState.commodities.gold) {
    setStatCard('gold', MarketState.commodities.gold.price,
      MarketState.commodities.gold.change);
  }
  if (MarketState.commodities.silver) {
    setStatCard('silver', MarketState.commodities.silver.price,
      MarketState.commodities.silver.change);
  }
  if (MarketState.commodities.oil) {
    setStatCard('oil', MarketState.commodities.oil.price,
      MarketState.commodities.oil.change);
  }

  // 股票数据
  if (MarketState.stocks['SPX']) {
    setStatCard('sp500', MarketState.stocks['SPX'].price, MarketState.stocks['SPX'].change);
  }
  if (MarketState.stocks['NDX']) {
    setStatCard('nasdaq', MarketState.stocks['NDX'].price, MarketState.stocks['NDX'].change);
  }
  if (MarketState.stocks['DJI']) {
    setStatCard('dow', MarketState.stocks['DJI'].price, MarketState.stocks['DJI'].change);
  }
  if (MarketState.forex['DXY']) {
    setStatCard('dxy', MarketState.forex['DXY'].price, MarketState.forex['DXY'].change);
  }
}

function setStatCard(id, price, change) {
  const priceEl = document.getElementById(`${id}Price`);
  const changeEl = document.getElementById(`${id}Change`);
  if (priceEl) priceEl.textContent = price ?? '--';
  if (changeEl && change !== undefined) {
    const up = change >= 0;
    changeEl.textContent = `${up ? '+' : ''}${change.toFixed(2)}%`;
    changeEl.className = `stat-change ${up ? 'up' : 'down'}`;
  }
}

// ============================================
// Yahoo Finance 数据 (股市 + 大宗商品 + 外汇)
// ============================================
async function loadYahooData() {
  try {
    await Promise.all([
      loadYahooQuote('SPX', '标普500'),
      loadYahooQuote('NDX', '纳斯达克'),
      loadYahooQuote('DJI', '道琼斯'),
      loadYahooQuote('CL=F', 'WTI原油'),
      loadYahooQuote('GC=F', '黄金'),
      loadYahooQuote('SI=F', '白银'),
      loadYahooQuote('BZ=F', '布伦特'),
      loadYahooQuote('ZC=F', '玉米'),
      loadYahooQuote('ZS=F', '大豆'),
      loadYahooForex('DX-Y.NYB', '美元指数'),
    ]);
  } catch (err) {
    console.warn('Yahoo Finance 数据加载失败:', err.message);
  }
  updateMacroCommodities();
}

async function loadYahooQuote(symbol, name) {
  try {
    const resp = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`
    );
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    const result = json?.chart?.result?.[0];
    if (!result) return;

    const meta = result.meta;
    const quote = result.timestamp;
    const prices = result.indicators?.quote?.[0]?.close ?? [];

    // 计算今日变化
    const validPrices = prices.filter(p => p !== null);
    const currentPrice = validPrices[validPrices.length - 1];
    const prevPrice = validPrices.length > 1 ? validPrices[validPrices.length - 2] : currentPrice;
    const change = prevPrice ? ((currentPrice - prevPrice) / prevPrice * 100) : 0;

    if (symbol === 'SPX') MarketState.stocks['SPX'] = {
      price: formatYahooPrice(currentPrice, symbol),
      change: change,
      raw: currentPrice,
    };
    else if (symbol === 'NDX') MarketState.stocks['NDX'] = {
      price: formatYahooPrice(currentPrice, symbol),
      change: change,
      raw: currentPrice,
    };
    else if (symbol === 'DJI') MarketState.stocks['DJI'] = {
      price: formatYahooPrice(currentPrice, symbol),
      change: change,
      raw: currentPrice,
    };
    else if (symbol === 'CL=F') MarketState.commodities.oil = {
      price: `$${currentPrice?.toFixed(2) ?? '--'}`,
      change: change,
      raw: currentPrice,
    };
    else if (symbol === 'GC=F') MarketState.commodities.gold = {
      price: `$${currentPrice?.toFixed(2) ?? '--'}`,
      change: change,
      raw: currentPrice,
    };
    else if (symbol === 'SI=F') MarketState.commodities.silver = {
      price: `$${currentPrice?.toFixed(2) ?? '--'}`,
      change: change,
      raw: currentPrice,
    };
    else if (symbol === 'BZ=F') MarketState.commodities.brent = {
      price: `$${currentPrice?.toFixed(2) ?? '--'}`,
      change: change,
      raw: currentPrice,
    };
    else if (symbol === 'ZC=F') MarketState.commodities.corn = {
      price: `${currentPrice?.toFixed(2) ?? '--'}`,
      change: change,
      raw: currentPrice,
    };
    else if (symbol === 'ZS=F') MarketState.commodities.soy = {
      price: `${currentPrice?.toFixed(2) ?? '--'}`,
      change: change,
      raw: currentPrice,
    };

  } catch (err) {
    console.warn(`Yahoo ${symbol} 加载失败:`, err.message);
  }
}

async function loadYahooForex(symbol, name) {
  try {
    const resp = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`
    );
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    const result = json?.chart?.result?.[0];
    if (!result) return;
    const prices = result.indicators?.quote?.[0]?.close ?? [];
    const validPrices = prices.filter(p => p !== null);
    const currentPrice = validPrices[validPrices.length - 1];
    const prevPrice = validPrices.length > 1 ? validPrices[validPrices.length - 2] : currentPrice;
    const change = prevPrice ? ((currentPrice - prevPrice) / prevPrice * 100) : 0;
    MarketState.forex['DXY'] = {
      price: currentPrice?.toFixed(2) ?? '--',
      change: change,
      raw: currentPrice,
    };
  } catch (err) {
    console.warn(`Forex ${symbol} 加载失败:`, err.message);
  }
}

function updateMacroCommodities() {
  const setMacro = (id, data) => {
    const el = document.getElementById(id);
    if (el && data?.price) {
      el.textContent = `${data.price}  ${data.change >= 0 ? '▲' : '▼'} ${Math.abs(data.change).toFixed(2)}%`;
      el.style.color = data.change >= 0 ? '#4ade80' : '#f87171';
    }
  };
  setMacro('macroGold', MarketState.commodities.gold);
  setMacro('macroSilver', MarketState.commodities.silver);
  setMacro('macroOil', MarketState.commodities.oil);
  setMacro('macroBrent', MarketState.commodities.brent);
  setMacro('macroCorn', MarketState.commodities.corn);
  setMacro('macroSoy', MarketState.commodities.soy);
}

// ============================================
// 新闻数据 - Yahoo Finance RSS
// ============================================
async function loadNewsData() {
  try {
    const feeds = [
      'https://finance.yahoo.com/news/rssindex',
      'https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC&region=US&lang=en-US',
      'https://feeds.finance.yahoo.com/rss/2.0/headline?s=BTC-USD&region=US&lang=en-US',
    ];

    const news = [];
    for (const feedUrl of feeds) {
      try {
        const resp = await fetch(
          `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}&count=10`
        );
        if (resp.ok) {
          const data = await resp.json();
          if (data.status === 'ok' && data.items) {
            data.items.forEach(item => {
              news.push({
                title: item.title,
                link: item.link,
                pubDate: item.pubDate,
                source: item.author || extractDomain(item.link) || 'Yahoo Finance',
                content: item.description || item.content || '',
                category: extractCategory(item),
              });
            });
          }
        }
      } catch (e) {
        // 继续尝试其他 feed
      }
    }

    // 去重
    const seen = new Set();
    MarketState.news = news.filter(n => {
      if (seen.has(n.title)) return false;
      seen.add(n.title);
      return true;
    }).slice(0, 20);

    renderNews();
  } catch (err) {
    console.warn('新闻加载失败:', err.message);
    MarketState.news = getMockNews();
    renderNews();
  }
}

function renderNews() {
  const grid = document.getElementById('newsGrid');
  if (!grid) return;

  if (MarketState.news.length === 0) {
    grid.innerHTML = '<div class="news-loading"><p>暂无新闻数据</p></div>';
    return;
  }

  grid.innerHTML = MarketState.news.slice(0, 12).map(item => {
    const sentiment = classifyNews(item.title + ' ' + item.content);
    const sentimentLabel = {
      bullish: { emoji: '📈', label: '利好', class: 'bullish' },
      bearish: { emoji: '📉', label: '利空', class: 'negative' },
      risk: { emoji: '⚠️', label: '风险', class: 'negative' },
      neutral: { emoji: '📰', label: '中性', class: 'neutral' },
    }[sentiment] || { emoji: '📰', label: '中性', class: 'neutral' };

    const timeAgo = getTimeAgo(item.pubDate);
    const summary = stripHTML(item.content || item.title).slice(0, 120);

    return `<a href="${item.link}" target="_blank" rel="noopener noreferrer" class="news-card ${sentimentLabel.class}">
      <div class="news-card-header">
        <span class="news-source">${item.source}</span>
        <span class="news-time">${timeAgo}</span>
      </div>
      <div class="news-title">${sentimentLabel.emoji} ${item.title}</div>
      <div class="news-summary">${summary}...</div>
    </a>`;
  }).join('');

  generateNewsSummary();
}

// ============================================
// AI 分析引擎
// ============================================
function generateAIAnalysis() {
  const analysis = buildMarketAnalysis();
  const el = document.getElementById('quickAnalysisText');
  if (el) {
    el.innerHTML = analysis;
  }
  generateInvestmentAdvice();
  generateNewsSummary();
}

function buildMarketAnalysis() {
  const lines = [];
  const btc = MarketState.crypto.find(c => c.symbol === 'btc');
  const eth = MarketState.crypto.find(c => c.symbol === 'eth');
  const gold = MarketState.commodities.gold;
  const oil = MarketState.commodities.oil;

  lines.push('<p><strong>【加密货币】</strong>');
  if (btc) {
    const up = btc.price_change_percentage_24h >= 0;
    lines.push(`比特币现报 <strong>$${formatPrice(btc.current_price)}</strong>，` +
      `24h${up ? '上涨' : '下跌'} <strong>${Math.abs(btc.price_change_percentage_24h).toFixed(2)}%</strong>。` +
      (up ? '多头动能持续，' : '注意短期回调风险，') +
      (btc.price_change_percentage_24h > 5 ? '涨幅较大，谨慎追多。' :
       btc.price_change_percentage_24h < -5 ? '下跌幅度较大，留意支撑位。' : '区间震荡为主。'));
  }
  if (eth) {
    const up = eth.price_change_percentage_24h >= 0;
    lines.push(`以太坊现报 <strong>$${formatPrice(eth.current_price)}</strong>，` +
      `24h${up ? '上涨' : '下跌'} ${Math.abs(eth.price_change_percentage_24h).toFixed(2)}%。`);
  }
  lines.push('</p>');

  lines.push('<p><strong>【大宗商品】</strong>');
  if (gold) {
    lines.push(`黄金现报 <strong>${gold.price}</strong>，` +
      `避险情绪${gold.raw > 2000 ? '偏高，金价高位运行。' : '平稳。'}`);
  }
  if (oil) {
    lines.push(`WTI原油现报 <strong>${oil.price}</strong>，` +
      `全球需求预期${oil.raw > 80 ? '偏弱，油价偏高。' : oil.raw < 60 ? '疲软，油价低位。' : '平稳。'}`);
  }
  lines.push('</p>');

  // 整体市场情绪判断
  lines.push('<p><strong>【综合判断】</strong>');
  const avgCrypto = MarketState.crypto.slice(0, 5)
    .reduce((sum, c) => sum + (c.price_change_percentage_24h || 0), 0) / Math.max(MarketState.crypto.length, 1);
  if (avgCrypto > 3) {
    lines.push('加密市场整体强势，资金活跃度高，风险偏好上升。');
  } else if (avgCrypto < -3) {
    lines.push('加密市场整体承压，注意风险控制，不要盲目抄底。');
  } else {
    lines.push('市场温和震荡，多空双方观望情绪浓厚，等待新催化剂。');
  }
  lines.push('</p>');

  return lines.join('');
}

function generateNewsSummary() {
  const el = document.getElementById('newsSummary');
  if (!el) return;

  if (MarketState.news.length === 0) {
    el.innerHTML = '<span class="analysis-loading">暂无新闻数据</span>';
    return;
  }

  const headlines = MarketState.news.slice(0, 5).map(n => n.title).join('；');
  const sentiments = MarketState.news.slice(0, 10).map(n => classifyNews(n.title));

  const bullish = sentiments.filter(s => s === 'bullish').length;
  const bearish = sentiments.filter(s => s === 'bearish' || s === 'risk').length;
  const neutral = sentiments.filter(s => s === 'neutral').length;

  let summary = `近期头条：${MarketState.news[0]?.title}。`;
  if (bullish > bearish + 2) {
    summary += `整体新闻情绪偏<strong style="color:#4ade80">利好</strong>（${bullish}利多 vs ${bearish}利空），市场信心较足。`;
  } else if (bearish > bullish + 2) {
    summary += `整体新闻情绪偏<strong style="color:#f87171">利空</strong>（${bearish}利空 vs ${bullish}利多），需保持谨慎。`;
  } else {
    summary += `新闻情绪<strong>中性</strong>（${bullish}利好 / ${neutral}中性 / ${bearish}利空），多空信息交织。`;
  }

  el.innerHTML = summary;
}

function generateInvestmentAdvice() {
  const container = document.getElementById('adviceContainer');
  if (!container) return;

  const btc = MarketState.crypto.find(c => c.symbol === 'btc');
  const eth = MarketState.crypto.find(c => c.symbol === 'eth');
  const gold = MarketState.commodities.gold;
  const avgCrypto = MarketState.crypto.slice(0, 5)
    .reduce((sum, c) => sum + (c.price_change_percentage_24h || 0), 0) / Math.max(MarketState.crypto.length, 1);

  const riskItems = [];
  const oppItems = [];
  const neutralItems = [];

  // 风险提示
  if (avgCrypto < -5) {
    riskItems.push({
      icon: '⚠️',
      text: `加密市场24小时内大幅下跌 ${Math.abs(avgCrypto).toFixed(1)}%，短期趋势偏空，建议等待企稳后再考虑入场，不要盲目抄底。`,
    });
  }
  if (btc && btc.price_change_percentage_24h < -8) {
    riskItems.push({
      icon: '📉',
      text: `比特币单日跌幅超过8%，历史上这种快速下跌往往伴随杠杆清算。建议做多者严格设置止损线。`,
    });
  }
  riskItems.push({
    icon: '🔓',
    text: '加密货币市场24/7交易，无熔断机制，价格波动剧烈，请勿使用杠杆或借贷炒币。',
  });
  riskItems.push({
    icon: '📰',
    text: '政策风险：各国监管政策变化可能引起加密资产剧烈波动，建议关注相关政策动态。',
  });
  riskItems.push({
    icon: '💰',
    text: '避免 FOMO 心理：看到别人赚钱后再入场，往往是市场最危险的信号。',
  });

  // 机会提示
  if (avgCrypto > 3 && avgCrypto < 8) {
    oppItems.push({
      icon: '📈',
      text: `市场整体温和上涨，趋势健康。可考虑分批布局主流资产（如BTC、ETH），设置2%-5%的止损。`,
    });
  }
  if (gold && gold.raw > 2000) {
    oppItems.push({
      icon: '🥇',
      text: `黄金突破 $2000，避险需求强劲。若有实物黄金或纸黄金配置，可继续持有；追高需谨慎。`,
    });
  }
  if (eth && eth.price_change_percentage_7d_in_currency > 10) {
    oppItems.push({
      icon: 'Ξ',
      text: `以太坊周涨幅超10%，生态发展持续向好。可关注 Layer2 板块的叙事机会。`,
    });
  }

  // 中性建议
  neutralItems.push({
    icon: '🛡️',
    text: '建议仓位配置：核心仓位70%（BTC/ETH）+ 卫星仓位20%（潜力山寨）+ 现金10%（应对极端行情）。',
  });
  neutralItems.push({
    icon: '📊',
    text: '定投策略：无论市场涨跌，定期定额投入，降低择时风险。适合长期投资者。',
  });
  neutralItems.push({
    icon: '🧠',
    text: '持续关注宏观经济：美国CPI数据、美联储利率决议、ETF资金流向等关键指标。',
  });

  container.innerHTML = `
    <div class="advice-section risk">
      <h4><span class="emoji">⚠️</span> 风险提示</h4>
      <ul class="advice-list">
        ${riskItems.map(i => `<li class="advice-item" data-icon="${i.icon}">${i.text}</li>`).join('')}
      </ul>
    </div>
    <div class="advice-section opportunity">
      <h4><span class="emoji">💡</span> 机会关注</h4>
      ${oppItems.length > 0
        ? `<ul class="advice-list">${oppItems.map(i => `<li class="advice-item" data-icon="${i.icon}">${i.text}</li>`).join('')}</ul>`
        : '<p style="color:var(--text-muted);font-size:13px;">当前暂无明显趋势性机会，建议观望等待。</p>'
      }
    </div>
    <div class="advice-section neutral">
      <h4><span class="emoji">📋</span> 投资策略建议</h4>
      <ul class="advice-list">
        ${neutralItems.map(i => `<li class="advice-item" data-icon="${i.icon}">${i.text}</li>`).join('')}
      </ul>
    </div>
  `;
}

// ============================================
// 新闻情绪分类
// ============================================
function classifyNews(text) {
  const bullish = /涨[幅动能势]|上涨|突破|创新高|牛市|利好|增长|强劲|反弹|大涨|暴涨|看涨|超预期|丰收|盈利/g;
  const bearish = /跌[幅破势]|下跌|崩盘|熊市|利空|亏损|暴跌|跳水|看跌|违约|危机|暴雷|腰斩|清仓/g;
  const risk = /警告|风险|审查|调查|禁令|诈骗|黑天鹅|不确定性|恐慌|踩踏|爆仓|清退/g;

  const bCount = (text.match(bullish) || []).length;
  const rCount = (text.match(risk) || []).length;
  const beCount = (text.match(bearish) || []).length;

  if (bCount > rCount + beCount) return 'bullish';
  if (rCount > bCount) return 'risk';
  if (beCount > bCount) return 'bearish';
  return 'neutral';
}

// ============================================
// 更新全部 UI
// ============================================
function updateUI() {
  updateCryptoTable();
  updateMarketOverview();
  updateMacroCommodities();
  generateAIAnalysis();
  buildTickerHTML();
}

// ============================================
// 工具函数
// ============================================
function formatPrice(price) {
  if (price === null || price === undefined) return '--';
  if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (price >= 1) return price.toFixed(2);
  return price.toPrecision(4);
}

function formatLargeNum(num) {
  if (!num) return '--';
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  return `$${num.toLocaleString()}`;
}

function formatYahooPrice(price, symbol) {
  if (!price) return '--';
  if (symbol === 'SPX' || symbol === 'NDX' || symbol === 'DJI') {
    return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  return price.toFixed(2);
}

function formatTime(date) {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function stripHTML(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch { return ''; }
}

function extractCategory(item) {
  if (item.categories?.length) return item.categories[0];
  if (item.title?.match(/bitcoin|crypto| BTC|ETH/gi)) return 'crypto';
  if (item.title?.match(/stock|market|index| Fed| CPI/gi)) return 'macro';
  return 'general';
}

function getTimeAgo(dateStr) {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffH = Math.floor(diffMs / 3600000);
    const diffM = Math.floor(diffMs / 60000);
    if (diffM < 1) return '刚刚';
    if (diffM < 60) return `${diffM}分钟前`;
    if (diffH < 24) return `${diffH}小时前`;
    return `${Math.floor(diffH / 24)}天前`;
  } catch { return ''; }
}

function getMockCryptoData() {
  return [
    { symbol: 'btc', name: 'Bitcoin', image: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png', current_price: 67500, price_change_percentage_24h: 1.2, price_change_percentage_7d_in_currency: 5.3, market_cap: 1.3e12, total_volume: 2.8e10 },
    { symbol: 'eth', name: 'Ethereum', image: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png', current_price: 3450, price_change_percentage_24h: 0.8, price_change_percentage_7d_in_currency: 3.1, market_cap: 4.1e11, total_volume: 1.5e10 },
    { symbol: 'sol', name: 'Solana', image: 'https://assets.coingecko.com/coins/images/4128/small/solana.png', current_price: 178, price_change_percentage_24h: -1.5, price_change_percentage_7d_in_currency: 8.2, market_cap: 8.0e10, total_volume: 3.2e9 },
  ];
}

function getMockNews() {
  return [
    { title: '美联储维持利率不变，市场预期9月降息', link: '#', pubDate: new Date().toISOString(), source: 'Reuters', content: '美联储宣布维持联邦基金利率目标区间在5.25%至5.5%之间，符合市场预期。', category: 'macro' },
    { title: '比特币突破68000美元，创历史新高', link: '#', pubDate: new Date(Date.now() - 3600000).toISOString(), source: 'Bloomberg', content: '受机构资金流入推动，比特币价格今日突破68000美元大关。', category: 'crypto' },
    { title: '黄金价格攀升至2050美元上方', link: '#', pubDate: new Date(Date.now() - 7200000).toISOString(), source: 'CNBC', content: '受避险需求和美元走弱影响，黄金期货价格今日上涨1.2%。', category: 'commodity' },
  ];
}
