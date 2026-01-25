function getConfig() {
  const scriptProperties = PropertiesService.getScriptProperties();
  
  const botToken = scriptProperties.getProperty('TELEGRAM_BOT_TOKEN');
  const chatId = scriptProperties.getProperty('TELEGRAM_CHAT_ID');
  const sheetId = scriptProperties.getProperty('SHEET_ID');
  
  return {
    TELEGRAM_BOT_TOKEN: botToken,
    TELEGRAM_CHAT_ID: chatId,
    SHEET_ID: sheetId,
    
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
