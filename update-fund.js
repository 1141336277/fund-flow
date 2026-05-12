// ====== 资金流向数据抓取（GitHub Actions 自动运行）======
const fs = require('fs');

// 格式化金额（亿）
function toYi(v) { return v ? (v / 100000000).toFixed(2) : '0.00'; }

// 格式化金额（万）
function toWan(v) { return v ? (v / 10000).toFixed(0) : '0'; }

// 东方财富 API 请求
async function fetchEM(url) {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://data.eastmoney.com/'
    }
  });
  return resp.json();
}

// 1. 行业板块资金流向排行
async function fetchSectorFlow() {
  try {
    const url = 'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=30&po=1&np=1&fltt=2&invt=2&fid=f62&fs=m:90+t:2&fields=f2,f3,f4,f12,f14,f62,f184,f66,f69,f72,f78';
    const j = await fetchEM(url);
    const data = (j.data && j.data.diff) || [];
    return data.map(item => ({
      code: item.f12,
      name: item.f14,
      price: item.f2 || 0,
      change: item.f3 || 0,
      changeAmount: item.f4 || 0,
      mainNetIn: item.f62 || 0,          // 主力净流入
      mainNetInRatio: item.f184 || 0,     // 主力净流入占比(%)
      superLargeNetIn: item.f66 || 0,     // 超大单净流入
      superLargeNetInRatio: item.f69 || 0,// 超大单净流入占比(%)
      largeNetIn: item.f72 || 0,          // 大单净流入
      mediumNetIn: item.f78 || 0          // 中单净流入
    }));
  } catch(e) {
    console.error('板块资金流获取失败:', e.message);
    return [];
  }
}

// 2. 概念板块资金流向
async function fetchConceptFlow() {
  try {
    const url = 'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=20&po=1&np=1&fltt=2&invt=2&fid=f62&fs=m:90+t:3&fields=f2,f3,f4,f12,f14,f62,f184,f66,f69';
    const j = await fetchEM(url);
    return ((j.data && j.data.diff) || []).map(item => ({
      code: item.f12,
      name: item.f14,
      change: item.f3 || 0,
      mainNetIn: item.f62 || 0,
      mainNetInRatio: item.f184 || 0
    }));
  } catch(e) {
    console.error('概念板块获取失败:', e.message);
    return [];
  }
}

// 3. 大盘资金流向
async function fetchMarketFlow() {
  try {
    // 上证指数资金流
    const url = 'https://push2.eastmoney.com/api/qt/stock/fflow/kline/get?secid=1.000001&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56';
    const j = await fetchEM(url);
    const klines = (j.data && j.data.klines) || [];
    // 取最新一条
    if (klines.length > 0) {
      const latest = klines[klines.length - 1].split(',');
      return {
        date: latest[0],
        mainNetIn: parseFloat(latest[1]) || 0,      // 主力净流入
        retailNetIn: parseFloat(latest[2]) || 0,    // 散户净流入
        superLargeNetIn: parseFloat(latest[3]) || 0, // 超大单净流入
        largeNetIn: parseFloat(latest[4]) || 0,     // 大单净流入
        mediumNetIn: parseFloat(latest[5]) || 0,    // 中单净流入
        smallNetIn: parseFloat(latest[6]) || 0      // 小单净流入
      };
    }
    return null;
  } catch(e) {
    console.error('大盘资金流获取失败:', e.message);
    return null;
  }
}

// 4. 北向资金（沪股通+深股通）
async function fetchNorthBound() {
  try {
    // 北向资金实时数据
    const url = 'https://push2.eastmoney.com/api/qt/kamt.kline/get?secid=1.000300&fields1=f1,f2&fields2=f51,f52';
    const j = await fetchEM(url);
    const klines = (j.data && j.data.klines) || [];
    if (klines.length > 0) {
      const latest = klines[klines.length - 1].split(',');
      return { date: latest[0], netIn: parseFloat(latest[1]) || 0 };
    }
    return null;
  } catch(e) {
    console.error('北向资金获取失败:', e.message);
    return null;
  }
}

// 5. 个股资金流 Top10
async function fetchStockFlow(sortField = 'f62', asc = 0) {
  try {
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=10&po=${asc}&np=1&fltt=2&invt=2&fid=${sortField}&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f2,f3,f12,f14,f62,f184,f66,f69`;
    const j = await fetchEM(url);
    return ((j.data && j.data.diff) || []).map(item => ({
      code: item.f12,
      name: item.f14,
      price: item.f2 || 0,
      change: item.f3 || 0,
      mainNetIn: item.f62 || 0,
      mainNetInRatio: item.f184 || 0
    }));
  } catch(e) {
    console.error('个股资金流获取失败:', e.message);
    return [];
  }
}

// 主函数
(async () => {
  console.log('===== 开始抓取资金流向数据 =====');

  console.log('[1/5] 行业板块资金流向...');
  const sectors = await fetchSectorFlow();

  console.log('[2/5] 概念板块资金流向...');
  const concepts = await fetchConceptFlow();

  console.log('[3/5] 大盘资金流向...');
  const marketFlow = await fetchMarketFlow();

  console.log('[4/5] 北向资金...');
  const northBound = await fetchNorthBound();

  console.log('[5/5] 个股资金流...');
  const stockInTop = await fetchStockFlow('f62', 0);  // 流入最多
  const stockOutTop = await fetchStockFlow('f62', 1); // 流出最多

  // 汇总计算
  const totalSectorIn = sectors.reduce((s, i) => s + (i.mainNetIn > 0 ? i.mainNetIn : 0), 0);
  const totalSectorOut = sectors.reduce((s, i) => s + (i.mainNetIn < 0 ? Math.abs(i.mainNetIn) : 0), 0);

  const data = {
    updated: new Date().toISOString(),
    // 大盘概况
    overview: {
      totalSectorIn: totalSectorIn,
      totalSectorOut: totalSectorOut,
      netFlow: totalSectorIn - totalSectorOut,
      sectorCount: sectors.length,
      inflowSectorCount: sectors.filter(s => s.mainNetIn > 0).length
    },
    // 大盘资金流
    marketFlow: marketFlow,
    // 北向资金
    northBound: northBound,
    // 行业板块资金流排行（前30，按净流入排序）
    sectors: sectors,
    // 概念板块资金流
    concepts: concepts,
    // 个股资金流入Top10
    stockInTop: stockInTop,
    // 个股资金流出Top10
    stockOutTop: stockOutTop,
    // 汇总文字
    summary: generateSummary(sectors, marketFlow, northBound)
  };

  fs.writeFileSync('fund.json', JSON.stringify(data, null, 2), 'utf-8');
  console.log('===== 抓取完成 =====');
  console.log('  行业板块:', sectors.length, '个');
  console.log('  资金净流入板块:', data.overview.inflowSectorCount, '个');
  console.log('  板块总净流入:', toYi(data.overview.totalSectorIn), '亿');
  console.log('  概念板块:', concepts.length, '个');
  console.log('  个股流入Top10:', stockInTop.length, '个');
})();

function generateSummary(sectors, marketFlow, northBound) {
  // 取资金流入最多的前 5 个板块
  const topIn = [...sectors]
    .sort((a, b) => b.mainNetIn - a.mainNetIn)
    .slice(0, 5)
    .filter(s => s.mainNetIn > 0);

  const topOut = [...sectors]
    .sort((a, b) => a.mainNetIn - b.mainNetIn)
    .slice(0, 3)
    .filter(s => s.mainNetIn < 0);

  let lines = [];

  if (topIn.length > 0) {
    lines.push('【资金涌入最多板块】');
    topIn.forEach((s, i) => {
      lines.push(`${i+1}. ${s.name}：主力净流入 ${toYi(s.mainNetIn)} 亿`);
    });
  }

  if (marketFlow && marketFlow.mainNetIn) {
    lines.push('');
    const dir = marketFlow.mainNetIn > 0 ? '净流入' : '净流出';
    lines.push(`【大盘主力资金】${dir} ${toYi(Math.abs(marketFlow.mainNetIn))} 亿`);
  }

  if (northBound && northBound.netIn) {
    const dir = northBound.netIn > 0 ? '净流入' : '净流出';
    lines.push(`【北向资金】${dir} ${toYi(Math.abs(northBound.netIn))} 亿`);
  }

  if (topOut.length > 0) {
    lines.push('');
    lines.push('【资金流出最多板块】');
    topOut.forEach((s, i) => {
      lines.push(`${i+1}. ${s.name}：主力净流出 ${toYi(Math.abs(s.mainNetIn))} 亿`);
    });
  }

  return lines.join('\n');
}
