function getConfig() {
  const scriptProperties = PropertiesService.getScriptProperties();
  
  const botToken = scriptProperties.getProperty('TELEGRAM_BOT_TOKEN');
  const chatId = scriptProperties.getProperty('TELEGRAM_CHAT_ID');
  const sheetId = scriptProperties.getProperty('SHEET_ID');
  const proxyUrl = scriptProperties.getProperty('PROXY_URL');
  const basicAuth = scriptProperties.getProperty('BASIC_AUTH');
  
  return {
    TELEGRAM_BOT_TOKEN: botToken,
    TELEGRAM_CHAT_ID: chatId,
    SHEET_ID: sheetId,
    PROXY_URL: proxyUrl,
    BASIC_AUTH: basicAuth,
    
    SERVICES: CONFIG_SERVICES
  };
}

const CONFIG_SERVICES = [
  {
    name: 'jyb',
    displayName: '巧巧郎',
    url: 'https://www.kkren.com.tw/',
    enabled: true,
    messageThreadId: 19
  },
  {
    name: 'seednet',
    displayName: 'Seednet',
    url: 'https://service.seed.net.tw',
    enabled: true,
    messageThreadId: 108
  },
  {
    name: 'elf',
    displayName: '一路發',
    url: 'https://www.elf.com.tw',
    enabled: true,
    messageThreadId: 105

  },
  {
    name: 'fet',
    displayName: '遠傳電信',
    url: 'https://www.fetnet.net',
    enabled: true,
    messageThreadId: 93
  },
  {
    name: 'hinet',
    displayName: '中華電信',
    url: 'https://www.hinet.net',
    enabled: true,
    messageThreadId: 90
  },
  {
    name: 'homeplus',
    displayName: '中嘉寬頻',
    url: 'https://www.homeplus.net.tw',
    enabled: true,
    messageThreadId: 134
  },
  {
    name: 'costco',
    displayName: '好市多',
    url: 'https://www.costco.com.tw',
    enabled: true,
    messageThreadId: 267
  },
  {
    name: 'taiwanmobile',
    displayName: '台灣大哥大',
    url: 'https://www.taiwanmobile.com',
    enabled: true,
    messageThreadId: 317
  },
  {
    name: 'cpc',
    displayName: '台灣中油',
    url: 'https://www.cpc.com.tw',
    enabled: true,
    messageThreadId: 439
  },
  {
    name: 'smc',
    displayName: '台灣海纜動態',
    url: 'https://smc.peering.tw',
    enabled: true,
    messageThreadId: 751,
    pruneSeparator: '_',
    enableMessageEdit: true
  },
  {
    name: 'tncfd',
    displayName: '台南消防出勤',
    url: 'https://119dts.tncfd.gov.tw/DTS/caselist/html',
    enabled: true,
    messageThreadId: 965,
    pruneSeparator: '_',
    enableMessageEdit: true
  },
  {
    name: 'tpcfd',
    displayName: '台北消防出勤',
    url: 'https://service119.tfd.gov.tw/service119/citizenCase/caseList',
    enabled: true,
    messageThreadId: 1358,
    pruneSeparator: '_',
    enableMessageEdit: true
  },
  {
    name: 'tccfd',
    displayName: '台中消防出勤',
    url: 'https://www.fire.taichung.gov.tw/caselist/index.asp?Parser=99,8,226,,,,,,,,1',
    enabled: true,
    messageThreadId: 1791,
    pruneSeparator: '_',
    enableMessageEdit: true
  }
];

function viewScriptProperties() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const props = scriptProperties.getProperties();
  
  for (const key in props) {
    const value = props[key];
    const maskedValue = key.includes('TOKEN') ? value.substring(0, 10) + '...' : value;
    Logger.log(`${key}: ${maskedValue}`);
  }
}
