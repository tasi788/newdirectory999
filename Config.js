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
