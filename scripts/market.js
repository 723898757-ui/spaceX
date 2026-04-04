/**
 * spaceX 市场数据引擎 v2
 * 核心策略：所有外部 API 都有超时限制，失败时优雅降级显示静态/模拟数据
 * 用户体验优先：页面必须秒开，数据慢慢加载
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('📊 市场引擎启动...');
  initTabs();
  initTicker();
  // 先立即显示模拟数据，让页面秒开
  loadMockData();
  updateUI();
  // 再异步加载真实数据
  loadAllData();
  setInterval(loadAllData, 5 * 60 * 1000);
});

const MarketState = {
  crypto: [],
  stocks: {},
  commodities: {},
  forex: {},
  news: [],
  lastUpdate: null,
  loaded: false,
};

// ============================================
// 标签页
// ============================================
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add('active');
    });
  });
}

// ============================================
// 模拟数据（国内秒开，立即有内容展示）
// ============================================
function loadMockData() {
  MarketState.crypto = [
    { symbol:'btc', name:'Bitcoin', image:'https://assets.coingecko.com/coins/images/1/small/bitcoin.png', current_price:67234, price_change_percentage_24h:1.25, price_change_percentage_7d_in_currency:5.3, market_cap:1320000000000, total_volume:28500000000 },
    { symbol:'eth', name:'Ethereum', image:'https://assets.coingecko.com/coins/images/279/small/ethereum.png', current_price:3487, price_change_percentage_24h:0.87, price_change_percentage_7d_in_currency:3.1, market_cap:419000000000, total_volume:15200000000 },
    { symbol:'sol', name:'Solana', image:'https://assets.coingecko.com/coins/images/4128/small/solana.png', current_price:178, price_change_percentage_24h:-1.52, price_change_percentage_7d_in_currency:8.2, market_cap:80100000000, total_volume:3200000000 },
    { symbol:'bnb', name:'BNB', image:'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png', current_price:412, price_change_percentage_24h:0.34, price_change_percentage_7d_in_currency:2.1, market_cap:63200000000, total_volume:890000000 },
    { symbol:'xrp', name:'XRP', image:'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png', current_price:0.523, price_change_percentage_24h:-0.78, price_change_percentage_7d_in_currency:-2.3, market_cap:28500000000, total_volume:1100000000 },
    { symbol:'ada', name:'Cardano', image:'https://assets.coingecko.com/coins/images/975/small/cardano.png', current_price:0.412, price_change_percentage_24h:2.15, price_change_percentage_7d_in_currency:7.8, market_cap:14700000000, total_volume:380000000 },
    { symbol:'doge', name:'Dogecoin', image:'https://assets.coingecko.com/coins/images/5/small/dogecoin.png', current_price:0.082, price_change_percentage_24h:-2.31, price_change_percentage_7d_in_currency:-5.2, market_cap:11800000000, total_volume:620000000 },
    { symbol:'dot', name:'Polkadot', image:'https://assets.coingecko.com/coins/images/12171/small/polkadot.png', current_price:7.23, price_change_percentage_24h:1.89, price_change_percentage_7d_in_currency:4.5, market_cap:9800000000, total_volume:210000000 },
  ];
  MarketState.stocks = {
    'SPX': { price:'5234.18', change:0.45 },
    'NDX': { price:'18312.45', change:0.72 },
    'DJI': { price:'38789.32', change:0.23 },
  };
  MarketState.commodities = {
    gold:   { price:'$2,056.30', change:0.34 },
    silver: { price:'$23.45', change:-0.21 },
    oil:    { price:'$78.52', change:-0.87 },
    brent:  { price:'$82.14', change:-0.65 },
    corn:   { price:'456.25', change:0.12 },
    soy:    { price:'1238.50', change:-0.34 },
  };
  MarketState.forex = {
    'DXY': { price:'104.32', change:0.11 },
  };
  MarketState.news = getMockNews();
}

// ============================================
// 加载所有真实数据（有超时保护）
// ============================================
async function loadAllData() {
  updateStatusDot('loading');
  const results = await Promise.allSettled([
    loadCryptoData(),
    loadYahooData(),
    loadNewsData(),
  ]);

  const success = results.some(r => r.status === 'fulfilled');
  if (success) {
    MarketState.loaded = true;
    updateStatusDot('ok');
  } else {
    updateStatusDot('error');
  }
  updateUI();
  MarketState.lastUpdate = new Date();
}

// ============================================
// 加密货币 - CoinGecko（8秒超时）
// ============================================
async function loadCryptoData() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?' +
      'vs_currency=usd&order=market_cap_desc&per_page=15&page=1' +
      '&sparkline=false&price_change_percentage=24h,7d',
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (Array.isArray(data) && data.length > 0) {
      MarketState.crypto = data;
    }
  } catch (err) {
    clearTimeout(timer);
    console.warn('CoinGecko 不可用，使用模拟数据:', err.message);
  }
  updateCryptoTable();
  updateMarketOverview();
}

// ============================================
// 股市/大宗商品 - Yahoo Finance（6秒超时）
// ============================================
async function loadYahooData() {
  const symbols = [
    { sym:'SPX',   type:'stock' },
    { sym:'NDX',   type:'stock' },
    { sym:'DJI',   type:'stock' },
    { sym:'GC=F',  type:'commodity' },
    { sym:'SI=F',  type:'commodity' },
    { sym:'CL=F',  type:'commodity' },
    { sym:'BZ=F',  type:'commodity' },
    { sym:'ZC=F',  type:'commodity' },
    { sym:'ZS=F',  type:'commodity' },
    { sym:'DX-Y.NYB', type:'forex' },
  ];

  const results = await Promise.allSettled(
    symbols.map(s => fetchYahooOne(s.sym, s.type))
  );
  updateMacroCommodities();
}

async function fetchYahooOne(symbol, type) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const resp = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=3d`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!resp.ok) return;
    const json = await resp.json();
    const result = json?.chart?.result?.[0];
    if (!result) return;
    const prices = result.indicators?.quote?.[0]?.close ?? [];
    const valid = prices.filter(p => p !== null);
    if (valid.length < 2) return;
    const current = valid[valid.length - 1];
    const prev = valid[valid.length - 2];
    const change = prev ? ((current - prev) / prev * 100) : 0;
    const fmt = type === 'stock'
      ? current.toLocaleString('en-US', { maximumFractionDigits: 2 })
      : `$${current.toFixed(2)}`;

    if (type === 'stock') {
      if (symbol === 'SPX') MarketState.stocks['SPX'] = { price: fmt, change };
      if (symbol === 'NDX') MarketState.stocks['NDX'] = { price: fmt, change };
      if (symbol === 'DJI') MarketState.stocks['DJI'] = { price: fmt, change };
    }
    if (type === 'commodity') {
      const map = { 'GC=F':'gold','SI=F':'silver','CL=F':'oil','BZ=F':'brent','ZC=F':'corn','ZS=F':'soy' };
      const key = map[symbol];
      if (key) MarketState.commodities[key] = { price: fmt, change };
    }
    if (type === 'forex') {
      MarketState.forex['DXY'] = { price: current.toFixed(2), change };
    }
  } catch (err) {
    clearTimeout(timer);
    console.warn(`Yahoo ${symbol} 失败:`, err.message);
  }
}

// ============================================
// 新闻 - rss2json（6秒超时）
// ============================================
async function loadNewsData() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const feeds = [
      'https://finance.yahoo.com/news/rssindex',
      'https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC&region=US&lang=en-US',
      'https://feeds.finance.yahoo.com/rss/2.0/headline?s=BTC-USD&region=US&lang=en-US',
    ];
    const resp = await fetch(
      `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feeds[0])}&count=15`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!resp.ok) return;
    const data = await resp.json();
    if (data.status !== 'ok' || !data.items?.length) return;
    MarketState.news = data.items.map(item => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      source: item.author || 'Yahoo Finance',
      content: item.description || '',
    }));
    renderNews();
  } catch (err) {
    clearTimeout(timer);
    console.warn('新闻加载失败:', err.message);
  }
}

// ============================================
// UI 更新
// ============================================
function updateUI() {
  updateCryptoTable();
  updateMarketOverview();
  updateMacroCommodities();
  generateAIAnalysis();
  buildTickerHTML();
  const timeEl = document.getElementById('dataTime');
  if (timeEl && MarketState.lastUpdate) {
    timeEl.textContent = `数据更新: ${formatTime(MarketState.lastUpdate)}`;
  }
}

function updateStatusDot(status) {
  const dot = document.getElementById('updateDot');
  if (!dot) return;
  dot.style.background = status === 'ok' ? '#4ade80' : status === 'loading' ? '#fbbf24' : '#f87171';
}

function updateCryptoTable() {
  const tbody = document.getElementById('cryptoTableBody');
  if (!tbody) return;
  if (!MarketState.crypto.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-loading">⏳ 加载中...</td></tr>';
    return;
  }
  tbody.innerHTML = MarketState.crypto.slice(0, 10).map(coin => {
    const c24 = coin.price_change_percentage_24h ?? 0;
    const c7d = coin.price_change_percentage_7d_in_currency ?? 0;
    const up24 = c24 >= 0; const up7d = c7d >= 0;
    return `<tr>
      <td>
        <div class="coin-name">
          <img src="${coin.image}" alt="${coin.symbol}" class="coin-img" loading="lazy"
               onerror="this.style.display='none'; this.nextSibling.textContent='${coin.symbol.toUpperCase()}'">
          ${coin.name}<span class="coin-symbol">${coin.symbol.toUpperCase()}</span>
        </div>
      </td>
      <td class="price">$${formatPrice(coin.current_price)}</td>
      <td class="${up24 ? 'change-up' : 'change-down'}">${up24?'+':''}${c24.toFixed(2)}%</td>
      <td class="${up7d ? 'change-up' : 'change-down'}">${up7d?'+':''}${c7d.toFixed(2)}%</td>
      <td class="market-cap">$${formatLargeNum(coin.market_cap)}</td>
      <td class="volume">$${formatLargeNum(coin.total_volume)}</td>
    </tr>`;
  }).join('');
  const t = document.getElementById('cryptoUpdateTime');
  if (t) t.textContent = formatTime(new Date());
}

function updateMarketOverview() {
  const set = (id, price, change) => {
    const pe = document.getElementById(`${id}Price`);
    const ce = document.getElementById(`${id}Change`);
    if (pe) pe.textContent = price ?? '--';
    if (ce && change !== undefined) {
      const up = change >= 0;
      ce.textContent = `${up?'+':''}${change.toFixed(2)}%`;
      ce.className = `stat-change ${up?'up':'down'}`;
    }
  };
  set('sp500', MarketState.stocks['SPX']?.price, MarketState.stocks['SPX']?.change);
  set('nasdaq', MarketState.stocks['NDX']?.price, MarketState.stocks['NDX']?.change);
  set('dow', MarketState.stocks['DJI']?.price, MarketState.stocks['DJI']?.change);
  set('gold', MarketState.commodities.gold?.price, MarketState.commodities.gold?.change);
  set('silver', MarketState.commodities.silver?.price, MarketState.commodities.silver?.change);
  set('oil', MarketState.commodities.oil?.price, MarketState.commodities.oil?.change);
  set('btc', MarketState.crypto.find(c=>c.symbol==='btc')?.current_price
    ? '$'+formatPrice(MarketState.crypto.find(c=>c.symbol==='btc').current_price) : null,
    MarketState.crypto.find(c=>c.symbol==='btc')?.price_change_percentage_24h);
  set('eth', MarketState.crypto.find(c=>c.symbol==='eth')?.current_price
    ? '$'+formatPrice(MarketState.crypto.find(c=>c.symbol==='eth').current_price) : null,
    MarketState.crypto.find(c=>c.symbol==='eth')?.price_change_percentage_24h);
  set('dxy', MarketState.forex['DXY']?.price, MarketState.forex['DXY']?.change);
}

function updateMacroCommodities() {
  const setMacro = (id, data) => {
    const el = document.getElementById(id);
    if (el && data?.price) {
      el.textContent = `${data.price}  ${data.change >= 0 ? '▲' : '▼'} ${Math.abs(data.change??0).toFixed(2)}%`;
      el.style.color = data.change >= 0 ? '#4ade80' : '#f87171';
    }
  };
  setMacro('macroGold', MarketState.commodities.gold);
  setMacro('macroSilver', MarketState.commodities.silver);
  setMacro('macroOil', MarketState.commodities.oil);
  setMacro('macroBrent', MarketState.commodities.brent);
  setMacro('macroCorn', MarketState.commodities.corn);
  setMacro('macroSoy', MarketState.commodities.soy);

  // 宏观经济标签页 - 股票
  const setMacroStock = (id, data) => {
    const el = document.getElementById(id);
    if (el && data?.price) {
      el.textContent = `${data.price}  ${data.change >= 0 ? '▲' : '▼'} ${Math.abs(data.change??0).toFixed(2)}%`;
      el.style.color = data.change >= 0 ? '#4ade80' : '#f87171';
    }
  };
  setMacroStock('mSPX', MarketState.stocks['SPX']);
  setMacroStock('mNDX', MarketState.stocks['NDX']);
  setMacroStock('mDJI', MarketState.stocks['DJI']);
  setMacroStock('mDXY', MarketState.forex['DXY']);

  // 底部价格卡片
  const btc = MarketState.crypto.find(c=>c.symbol==='btc');
  const eth = MarketState.crypto.find(c=>c.symbol==='eth');

  const setCard = (id, price, change) => {
    const pEl = document.getElementById(`${id}Price`) || document.getElementById(`chart${id}Price`);
    const mEl = document.getElementById(`${id}Meta`) || document.getElementById(`chart${id}Meta`);
    if (pEl) pEl.textContent = price ?? '--';
    if (mEl) {
      if (change !== undefined) {
        const up = change >= 0;
        mEl.textContent = `${up?'▲':'▼'} ${Math.abs(change).toFixed(2)}% (24h)`;
        mEl.style.color = up ? '#4ade80' : '#f87171';
      } else {
        mEl.textContent = '--';
      }
    }
  };

  const spx = MarketState.stocks['SPX'];
  const ndx = MarketState.stocks['NDX'];
  const gold = MarketState.commodities.gold;
  const oil = MarketState.commodities.oil;

  if (btc) {
    const up = btc.price_change_percentage_24h >= 0;
    const pEl = document.getElementById('chartBTCPrice');
    const mEl = document.getElementById('chartBTCMeta');
    if (pEl) pEl.textContent = `$${formatPrice(btc.current_price)}`;
    if (mEl) {
      mEl.textContent = `${up?'▲':'▼'} ${Math.abs(btc.price_change_percentage_24h).toFixed(2)}% (24h)`;
      mEl.style.color = up ? '#4ade80' : '#f87171';
    }
  }
  if (eth) {
    const up = eth.price_change_percentage_24h >= 0;
    const pEl = document.getElementById('chartETHPrice');
    const mEl = document.getElementById('chartETCMeta');
    if (pEl) pEl.textContent = `$${formatPrice(eth.current_price)}`;
    if (mEl) {
      mEl.textContent = `${up?'▲':'▼'} ${Math.abs(eth.price_change_percentage_24h).toFixed(2)}% (24h)`;
      mEl.style.color = up ? '#4ade80' : '#f87171';
    }
  }
  if (gold) {
    const pEl = document.getElementById('chartGoldPrice');
    const mEl = document.getElementById('chartGoldMeta');
    if (pEl) pEl.textContent = gold.price;
    if (mEl) {
      const up = gold.change >= 0;
      mEl.textContent = `${up?'▲':'▼'} ${Math.abs(gold.change??0).toFixed(2)}% (今日)`;
      mEl.style.color = up ? '#4ade80' : '#f87171';
    }
  }
  if (oil) {
    const pEl = document.getElementById('chartOilPrice');
    const mEl = document.getElementById('chartOilMeta');
    if (pEl) pEl.textContent = oil.price;
    if (mEl) {
      const up = oil.change >= 0;
      mEl.textContent = `${up?'▲':'▼'} ${Math.abs(oil.change??0).toFixed(2)}% (今日)`;
      mEl.style.color = up ? '#4ade80' : '#f87171';
    }
  }
  if (spx) {
    const pEl = document.getElementById('chartSPXPrice');
    const mEl = document.getElementById('chartSPXMeta');
    if (pEl) pEl.textContent = spx.price;
    if (mEl) {
      const up = spx.change >= 0;
      mEl.textContent = `${up?'▲':'▼'} ${Math.abs(spx.change??0).toFixed(2)}% (今日)`;
      mEl.style.color = up ? '#4ade80' : '#f87171';
    }
  }
  if (ndx) {
    const pEl = document.getElementById('chartNDXPrice');
    const mEl = document.getElementById('chartNDXMeta');
    if (pEl) pEl.textContent = ndx.price;
    if (mEl) {
      const up = ndx.change >= 0;
      mEl.textContent = `${up?'▲':'▼'} ${Math.abs(ndx.change??0).toFixed(2)}% (今日)`;
      mEl.style.color = up ? '#4ade80' : '#f87171';
    }
  }
}

// ============================================
// 顶部滚动条
// ============================================
function initTicker() {
  document.getElementById('tickerInner').innerHTML =
    '<span class="ticker-loading">⏳ 正在获取市场数据...</span>';
}

function buildTickerHTML() {
  const items = [];
  MarketState.crypto.slice(0, 6).forEach(coin => {
    const up = coin.price_change_percentage_24h >= 0;
    items.push(`<span class="ticker-item">
      <span class="ticker-name">${coin.symbol.toUpperCase()}</span>
      <span class="ticker-price">$${formatPrice(coin.current_price)}</span>
      <span class="ticker-change ${up?'up':'down'}">${up?'+':''}${(coin.price_change_percentage_24h??0).toFixed(2)}%</span>
    </span>`);
  });
  Object.entries(MarketState.stocks).forEach(([n,d]) => {
    if (d.price) {
      const up = d.change >= 0;
      items.push(`<span class="ticker-item">
        <span class="ticker-name">${n}</span>
        <span class="ticker-price">${d.price}</span>
        <span class="ticker-change ${up?'up':'down'}">${up?'+':''}${(d.change??0).toFixed(2)}%</span>
      </span>`);
    }
  });
  Object.entries(MarketState.commodities).forEach(([n,d]) => {
    if (d.price) {
      const up = d.change >= 0;
      items.push(`<span class="ticker-item">
        <span class="ticker-name">${n}</span>
        <span class="ticker-price">${d.price}</span>
        <span class="ticker-change ${up?'up':'down'}">${up?'+':''}${(d.change??0).toFixed(2)}%</span>
      </span>`);
    }
  });
  if (!items.length) return;
  document.getElementById('tickerInner').innerHTML = items.join('') + items.join('');
}

// ============================================
// 新闻渲染
// ============================================
function renderNews() {
  const grid = document.getElementById('newsGrid');
  if (!grid) return;
  if (!MarketState.news.length) {
    grid.innerHTML = '<div class="news-empty">📰 暂无新闻数据</div>';
    return;
  }
  grid.innerHTML = MarketState.news.slice(0, 10).map(item => {
    const s = classifyNews(item.title);
    const labels = { bullish:['📈','利好','bullish'], bearish:['📉','利空','bearish'], risk:['⚠️','风险','risk'], neutral:['📰','中性','neutral'] };
    const [emoji, label, cls] = labels[s] || labels.neutral;
    const time = getTimeAgo(item.pubDate);
    const summary = stripHTML(item.content).slice(0, 100);
    return `<a href="${item.link}" target="_blank" rel="noopener" class="news-card ${cls}">
      <div class="news-card-header">
        <span class="news-source">${item.source||'未知来源'}</span>
        <span class="news-time">${time}</span>
      </div>
      <div class="news-title">${emoji} ${item.title}</div>
      <div class="news-summary">${summary}...</div>
    </a>`;
  }).join('');
  generateNewsSummary();
}

// ============================================
// AI 分析
// ============================================
function generateAIAnalysis() {
  // 概览分析
  const el = document.getElementById('quickAnalysisText');
  if (el) el.innerHTML = buildMarketAnalysis();

  // 新闻摘要
  generateNewsSummary();

  // 投资建议
  generateInvestmentAdvice();
}

function buildMarketAnalysis() {
  const btc = MarketState.crypto.find(c => c.symbol === 'btc');
  const eth = MarketState.crypto.find(c => c.symbol === 'eth');
  const gold = MarketState.commodities.gold;
  const avg = MarketState.crypto.slice(0,5).reduce((s,c) => s+(c.price_change_percentage_24h??0), 0) / Math.max(MarketState.crypto.length,1);

  let html = '<p><strong>【加密市场】</strong>';
  if (btc) {
    const up = btc.price_change_percentage_24h >= 0;
    html += `比特币 <strong>$${formatPrice(btc.current_price)}</strong>，` +
      `${up?'▲':'▼'} <strong>${Math.abs(btc.price_change_percentage_24h).toFixed(2)}%</strong>。` +
      (avg > 3 ? '市场整体偏强，' : avg < -3 ? '注意短期下行风险，' : '区间震荡为主。');
  }
  html += '</p><p><strong>【大宗商品】</strong>';
  if (gold) html += `黄金 <strong>${gold.price}</strong>，` + (gold.raw > 2000?'避险买盘支撑。':'价格平稳。');
  html += '</p><p><strong>【综合情绪】</strong>';
  if (avg > 5) html += '多头动能强劲，资金活跃。';
  else if (avg < -5) html += '空头主导，建议谨慎观望。';
  else html += '多空均衡，等待方向选择。';
  html += '</p>';
  return html;
}

function generateNewsSummary() {
  const el = document.getElementById('newsSummary');
  if (!el || !MarketState.news.length) return;
  const b = MarketState.news.slice(0,8).map(n => classifyNews(n.title));
  const bc = b.filter(s=>s==='bullish').length;
  const rc = b.filter(s=>s==='bearish'||s==='risk').length;
  let text = `近期共 ${MarketState.news.length} 条新闻：` +
    (bc>rc+1?'整体偏<strong style="color:#4ade80">利好</strong>，':rc>bc+1?'整体偏<strong style="color:#f87171">利空</strong>，':'多空交织，') +
    `其中 ${bc} 条利好 / ${rc} 条利空。`;
  el.innerHTML = text;
}

function generateInvestmentAdvice() {
  const c = document.getElementById('adviceContainer');
  if (!c) return;
  const btc = MarketState.crypto.find(c=>c.symbol==='btc');
  const avg = MarketState.crypto.slice(0,5).reduce((s,x)=>s+(x.price_change_percentage_24h??0),0)/Math.max(MarketState.crypto.length,1);

  c.innerHTML = `
    <div class="advice-section risk">
      <h4>⚠️ 风险提示</h4>
      <ul>
        <li>加密货币 24/7 交易，无熔断机制，波动剧烈，请勿借贷或使用杠杆。</li>
        <li>政策风险：各国监管动态可能引发剧烈波动，建议关注相关政策。</li>
        <li>避免 FOMO：看到别人赚钱后再入场往往是危险的信号。</li>
        <li>数字资产不是法定货币，不受存款保险保护，投资需量力而行。</li>
      </ul>
    </div>
    <div class="advice-section opportunity">
      <h4>💡 机会关注</h4>
      ${avg>3&&avg<10?'<ul><li>市场温和上涨，趋势健康，可考虑分批布局主流资产，止损设2%-5%。</li></ul>':
        avg>10?'<ul><li>涨幅较大，多头动能强但注意回调风险，追高需谨慎。</li></ul>':
        avg<-5?'<ul><li>市场大幅下跌，等待企稳信号，不盲目抄底。</li></ul>':
        '<p style="color:var(--text-muted);font-size:13px">暂无明显趋势性机会，建议观望为主。</p>'}
    </div>
    <div class="advice-section neutral">
      <h4>📋 策略建议</h4>
      <ul>
        <li>仓位配置建议：核心仓位70%（BTC/ETH）+ 卫星仓位20% + 现金10%。</li>
        <li>定投策略：定期定额投入，降低择时风险，适合长期投资者。</li>
        <li>关注关键指标：美联储利率、CPI数据、比特币ETF资金流向。</li>
      </ul>
    </div>
    <div class="risk-disclaimer">
      ⚠️ 免责声明：本页面所有内容仅供信息参考，不构成任何投资建议。投资有风险，入市需谨慎。
    </div>
  `;
}

// ============================================
// 新闻情绪分类
// ============================================
function classifyNews(text) {
  const b = (text.match(/涨[幅动能势]|上涨|突破|创新高|牛市|利好|增长|强劲|反弹|大涨|暴涨|超预期|丰收/g)||[]).length;
  const r = (text.match(/跌[幅破势]|下跌|崩盘|熊市|利空|亏损|暴跌|跳水|违约|危机|暴雷|腰斩/g)||[]).length;
  const rk = (text.match(/警告|风险|审查|调查|禁令|诈骗|黑天鹅|不确定性|恐慌|踩踏|爆仓/g)||[]).length;
  if (b>r+rk) return 'bullish';
  if (r>r+b) return 'bearish';
  if (rk>b+r) return 'risk';
  return 'neutral';
}

// ============================================
// 工具函数
// ============================================
function formatPrice(p) {
  if (p==null) return '--';
  if (p>=1000) return p.toLocaleString('en-US',{maximumFractionDigits:0});
  if (p>=1) return p.toFixed(2);
  return p.toPrecision(4);
}
function formatLargeNum(n) {
  if (!n) return '--';
  if (n>=1e12) return `$${(n/1e12).toFixed(2)}T`;
  if (n>=1e9) return `$${(n/1e9).toFixed(2)}B`;
  if (n>=1e6) return `$${(n/1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}
function formatTime(d) {
  return d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}
function stripHTML(h) { return h.replace(/<[^>]*>/g,'').replace(/&[^;]+;/g,' ').trim(); }
function getTimeAgo(s) {
  try {
    const diff = Date.now() - new Date(s);
    const m = Math.floor(diff/60000);
    const h = Math.floor(diff/3600000);
    const d = Math.floor(diff/86400000);
    if (m<1) return '刚刚';
    if (m<60) return `${m}分钟前`;
    if (h<24) return `${h}小时前`;
    return `${d}天前`;
  } catch { return ''; }
}
function getMockNews() {
  return [
    { title:'比特币 ETF 持续净流入，机构持仓量创历史新高', link:'#', pubDate:new Date().toISOString(), source:'Bloomberg Crypto', content:'根据最新数据，美国现货比特币 ETF 连续多日净流入。' },
    { title:'美联储主席暗示维持高利率更长时间', link:'#', pubDate:new Date(Date.now()-3600000).toISOString(), source:'Reuters', content:'美联储主席在讲话中表示，利率政策需要更多时间观察通胀数据。' },
    { title:'以太坊 Layer2 网络交易量突破历史记录', link:'#', pubDate:new Date(Date.now()-7200000).toISOString(), source:'CoinDesk', content:'Arbitrum 和 Optimism 等 Layer2 网络日交易量创历史新高。' },
    { title:'黄金价格逼近 2100 美元，避险需求升温', link:'#', pubDate:new Date(Date.now()-10800000).toISOString(), source:'Kitco News', content:'受地缘政治紧张影响，黄金作为避险资产受到追捧。' },
    { title:'Solana 生态 TVL 突破 50 亿美元', link:'#', pubDate:new Date(Date.now()-14400000).toISOString(), source:'The Block', content:'Solana 区块链上的总锁仓价值（TVL）持续增长。' },
    { title:'WTI 原油跌破 80 美元，需求担忧拖累', link:'#', pubDate:new Date(Date.now()-18000000).toISOString(), source:'Oil Price', content:'全球经济增长放缓担忧导致原油需求预期下降。' },
    { title:'美国 CPI 数据符合预期，市场宽松预期升温', link:'#', pubDate:new Date(Date.now()-21600000).toISOString(), source:'CNBC', content:'最新 CPI 数据符合市场预期，通胀压力有所缓解。' },
    { title:'狗狗币大涨 15%，马斯克再次暗示相关计划', link:'#', pubDate:new Date(Date.now()-25200000).toISOString(), source:'CryptoSlate', content:'马斯克在社交媒体发布相关内容后，DOGE 短线飙升。' },
  ];
}
