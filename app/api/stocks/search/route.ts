import { NextRequest, NextResponse } from "next/server";

export interface StockSearchResult {
  symbol: string;
  nameCn: string;
  name: string;
  market: "US" | "HK" | "CN" | "INDEX";
}

// 常用知名标的库（支持中文、拼音、代码免外网即时毫秒级联想）
const POPULAR_STOCKS: StockSearchResult[] = [
  // A 股
  { symbol: "600519.SS", nameCn: "贵州茅台", name: "Kweichow Moutai", market: "CN" },
  { symbol: "300750.SZ", nameCn: "宁德时代", name: "CATL", market: "CN" },
  { symbol: "000858.SZ", nameCn: "五粮液", name: "Wuliangye", market: "CN" },
  { symbol: "002594.SZ", nameCn: "比亚迪", name: "BYD", market: "CN" },
  { symbol: "601318.SS", nameCn: "中国平安", name: "Ping An Insurance", market: "CN" },
  { symbol: "600036.SS", nameCn: "招商银行", name: "China Merchants Bank", market: "CN" },
  { symbol: "601899.SS", nameCn: "紫金矿业", name: "Zijin Mining", market: "CN" },
  { symbol: "601138.SS", nameCn: "工业富联", name: "Foxconn Industrial Internet", market: "CN" },
  { symbol: "000333.SZ", nameCn: "美的集团", name: "Midea Group", market: "CN" },
  { symbol: "600900.SS", nameCn: "长江电力", name: "China Yangtze Power", market: "CN" },
  { symbol: "002475.SZ", nameCn: "立讯精密", name: "Luxshare Precision", market: "CN" },
  { symbol: "002415.SZ", nameCn: "海康威视", name: "Hikvision", market: "CN" },
  { symbol: "000848.SZ", nameCn: "承德露露", name: "Chengde Lolo", market: "CN" },
  { symbol: "600276.SS", nameCn: "恒瑞医药", name: "Hengrui Medicine", market: "CN" },
  { symbol: "300059.SZ", nameCn: "东方财富", name: "East Money", market: "CN" },
  { symbol: "688981.SS", nameCn: "中芯国际", name: "SMIC", market: "CN" },
  { symbol: "688041.SS", nameCn: "海光信息", name: "Hygon Information", market: "CN" },
  { symbol: "603993.SS", nameCn: "洛阳钼业", name: "CMOC", market: "CN" },
  { symbol: "002466.SZ", nameCn: "天齐锂业", name: "Tianqi Lithium", market: "CN" },
  { symbol: "002714.SZ", nameCn: "牧原股份", name: "Muyuan Foods", market: "CN" },

  // 港股
  { symbol: "0700.HK", nameCn: "腾讯控股", name: "Tencent", market: "HK" },
  { symbol: "9988.HK", nameCn: "阿里巴巴", name: "Alibaba", market: "HK" },
  { symbol: "3690.HK", nameCn: "美团", name: "Meituan", market: "HK" },
  { symbol: "9992.HK", nameCn: "泡泡玛特", name: "Pop Mart", market: "HK" },
  { symbol: "1810.HK", nameCn: "小米集团", name: "Xiaomi", market: "HK" },
  { symbol: "9866.HK", nameCn: "蔚来", name: "NIO", market: "HK" },
  { symbol: "9868.HK", nameCn: "小鹏汽车", name: "XPeng", market: "HK" },
  { symbol: "2015.HK", nameCn: "理想汽车", name: "Li Auto", market: "HK" },
  { symbol: "9618.HK", nameCn: "京东集团", name: "JD.com", market: "HK" },
  { symbol: "9888.HK", nameCn: "百度集团", name: "Baidu", market: "HK" },
  { symbol: "1024.HK", nameCn: "快手", name: "Kuaishou", market: "HK" },
  { symbol: "2318.HK", nameCn: "中国平安", name: "Ping An", market: "HK" },
  { symbol: "0388.HK", nameCn: "香港交易所", name: "HKEX", market: "HK" },

  // 美股
  { symbol: "AAPL", nameCn: "苹果", name: "Apple", market: "US" },
  { symbol: "NVDA", nameCn: "英伟达", name: "NVIDIA", market: "US" },
  { symbol: "TSLA", nameCn: "特斯拉", name: "Tesla", market: "US" },
  { symbol: "MSFT", nameCn: "微软", name: "Microsoft", market: "US" },
  { symbol: "GOOGL", nameCn: "谷歌", name: "Alphabet (Google)", market: "US" },
  { symbol: "AMZN", nameCn: "亚马逊", name: "Amazon", market: "US" },
  { symbol: "META", nameCn: "Meta", name: "Meta Platforms", market: "US" },
  { symbol: "BRK.B", nameCn: "伯克希尔", name: "Berkshire Hathaway", market: "US" },
  { symbol: "TSM", nameCn: "台积电", name: "TSMC", market: "US" },
  { symbol: "ASML", nameCn: "阿斯麦", name: "ASML", market: "US" },
  { symbol: "MU", nameCn: "美光科技", name: "Micron", market: "US" },
  { symbol: "INTC", nameCn: "英特尔", name: "Intel", market: "US" },
  { symbol: "AMD", nameCn: "超威半导体", name: "AMD", market: "US" },
  { symbol: "PLTR", nameCn: "Palantir", name: "Palantir", market: "US" },
  { symbol: "BABA", nameCn: "阿里巴巴(美股)", name: "Alibaba ADR", market: "US" },
  { symbol: "PDD", nameCn: "拼多多", name: "PDD Holdings", market: "US" },
  { symbol: "COIN", nameCn: "Coinbase", name: "Coinbase", market: "US" },

  // 指数
  { symbol: "000300.SS", nameCn: "沪深300", name: "CSI 300", market: "INDEX" },
  { symbol: "000001.SS", nameCn: "上证指数", name: "Shanghai Composite", market: "INDEX" },
  { symbol: "399001.SZ", nameCn: "深证成指", name: "Shenzhen Component", market: "INDEX" },
  { symbol: "399006.SZ", nameCn: "创业板指", name: "ChiNext", market: "INDEX" },
  { symbol: "^HSI", nameCn: "恒生指数", name: "Hang Seng Index", market: "INDEX" },
  { symbol: "^GSPC", nameCn: "标普500", name: "S&P 500", market: "INDEX" },
  { symbol: "^IXIC", nameCn: "纳斯达克", name: "NASDAQ", market: "INDEX" },
  { symbol: "^DJI", nameCn: "道琼斯", name: "Dow Jones", market: "INDEX" },
];

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ results: POPULAR_STOCKS.slice(0, 10) });
  }

  const query = q.toUpperCase();

  // 1. 本地常见列表高优先级匹配
  const matches = POPULAR_STOCKS.filter((s) => {
    return (
      s.symbol.toUpperCase().includes(query) ||
      s.nameCn.includes(q) ||
      s.name.toUpperCase().includes(query)
    );
  });

  // 2. 如果输入的是 6 位纯数字，智能判断 A 股市场（6 开头为沪市 .SS，0 或 3 开头为深市 .SZ）
  if (/^\d{6}$/.test(q) && !matches.some((m) => m.symbol.startsWith(q))) {
    const isSh = q.startsWith("6");
    const suffix = isSh ? ".SS" : ".SZ";
    matches.unshift({
      symbol: `${q}${suffix}`,
      nameCn: `A股(${q})`,
      name: `A-Share ${q}`,
      market: "CN",
    });
  }

  // 3. 如果输入的是 4 位或 5 位数字，智能判断港股
  if (/^\d{4,5}$/.test(q) && !matches.some((m) => m.symbol.startsWith(q))) {
    const padded = q.padStart(4, "0");
    matches.unshift({
      symbol: `${padded}.HK`,
      nameCn: `港股(${padded})`,
      name: `HK Stock ${padded}`,
      market: "HK",
    });
  }

  // 4. 如果输入的是纯英文字符，智能识别为美股
  if (/^[A-Z]{1,5}$/.test(query) && !matches.some((m) => m.symbol === query)) {
    matches.unshift({
      symbol: query,
      nameCn: query,
      name: query,
      market: "US",
    });
  }

  return NextResponse.json({ results: matches.slice(0, 15) });
}
