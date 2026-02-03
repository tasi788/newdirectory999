function main() {
  const CONFIG = getConfig();
  const db = new Database(CONFIG.SHEET_ID);
  const telegram = new Telegram(CONFIG.TELEGRAM_BOT_TOKEN, CONFIG.TELEGRAM_CHAT_ID);
  
  for (const serviceConfig of CONFIG.SERVICES) {
    processService(serviceConfig, db, telegram);
  }
  
  Logger.log('Main execution completed');
}

function runFrequentServices() {
  const CONFIG = getConfig();
  const db = new Database(CONFIG.SHEET_ID);
  const telegram = new Telegram(CONFIG.TELEGRAM_BOT_TOKEN, CONFIG.TELEGRAM_CHAT_ID);
  
  // List of services that run every 5 minutes
  const frequentServices = ['tncfd'];
  
  Logger.log('Starting Frequent Services execution');
  
  for (const serviceName of frequentServices) {
    const serviceConfig = CONFIG.SERVICES.find(s => s.name === serviceName);
    if (!serviceConfig) {
      Logger.log(`Service config for ${serviceName} not found`);
      continue;
    }
    
    processService(serviceConfig, db, telegram);
  }
  
  Logger.log('Frequent Services execution completed');
}

function processService(serviceConfig, db, telegram) {
  if (!serviceConfig.enabled) {
    return;
  }
  
  try {
    const service = getServiceInstance(serviceConfig.name);
    if (!service) {
      Logger.log(`Service ${serviceConfig.name} not found`);
      return;
    }
    
    Logger.log(`Processing service: ${serviceConfig.name}`);
    
    const announcements = service.fetch();
    Logger.log(`Found ${announcements.length} announcements for ${serviceConfig.name}`);
    
    const newAnnouncements = [];
    for (const announcement of announcements) {
      if (!db.hasId(serviceConfig.name, announcement.id)) {
        newAnnouncements.push(announcement);
      }
    }
    
    Logger.log(`${newAnnouncements.length} new announcements for ${serviceConfig.name}`);
    
    for (const announcement of newAnnouncements) {
      if (typeof service.fetchDetailContent === 'function') {
        const detailKey = announcement.pageId || announcement.detailUrl || announcement.detailId;
        if (detailKey) {
          const detail = service.fetchDetailContent(detailKey);
          if (detail.images) announcement.images = detail.images;
          if (detail.content) announcement.content = detail.content;
          if (detail.publishDate) announcement.create_date = detail.publishDate;
          Utilities.sleep(300);
        }
      }
      
      const message = service.buildMessage(announcement, serviceConfig);
      
      if (announcement.images && announcement.images.length > 1) {
        telegram.sendMediaGroup(
          announcement.images,
          message,
          serviceConfig.messageThreadId
        );
      } else if (announcement.images && announcement.images.length === 1) {
        telegram.sendPhoto(
          announcement.images[0],
          message,
          serviceConfig.messageThreadId
        );
      } else if (announcement.poster) {
        telegram.sendPhoto(
          announcement.poster,
          message,
          serviceConfig.messageThreadId
        );
      } else {
        telegram.sendMessage(message, serviceConfig.messageThreadId);
      }
      
      const dateStr = announcement.create_date || new Date().toISOString();
      db.setServiceData(serviceConfig.name, {
        [announcement.id]: dateStr
      }, serviceConfig.pruneSeparator);
      
      Utilities.sleep(1000);
    }
    
  } catch (e) {
    Logger.log(`Error processing service ${serviceConfig.name}: ${e.message}`);
  }
  
  Logger.log('Main execution completed');
}

function getServiceInstance(serviceName) {
  const serviceClasses = {
    'jyb': JYBService,
    'seednet': SeednetService,
    'elf': ElfService,
    'fet': FetService,
    'hinet': HinetService,
    'homeplus': HomeplusService,
    'costco': CostcoService,
    'taiwanmobile': TaiwanMobileService,
    'cpc': CPCService,
    'smc': SMCService,
    'tncfd': TncfdService
  };

  const ServiceClass = serviceClasses[serviceName];
  return ServiceClass ? new ServiceClass() : null;
}

function skipService() {
  let serviceName = 'smc';
  const CONFIG = getConfig();
  const db = new Database(CONFIG.SHEET_ID);
  const service = getServiceInstance(serviceName);
  
  if (!service) {
    Logger.log(`Service ${serviceName} not found`);
    return;
  }
  
  const ids = service.skip();
  Logger.log(`Skipping ${ids.length} announcements for ${serviceName}`);
  
  db.skipService(serviceName, ids);
  Logger.log(`Skip completed for ${serviceName}`);
}

function skipAllServices() {
  const CONFIG = getConfig();
  const db = new Database(CONFIG.SHEET_ID);
  
  for (const serviceConfig of CONFIG.SERVICES) {
    if (!serviceConfig.enabled) continue;
    
    const service = getServiceInstance(serviceConfig.name);
    if (!service) {
      Logger.log(`Service ${serviceConfig.name} not found`);
      continue;
    }
    
    try {
      const ids = service.skip();
      Logger.log(`Skipping ${ids.length} announcements for ${serviceConfig.name}`);
      db.skipService(serviceConfig.name, ids);
      Logger.log(`Skip completed for ${serviceConfig.name}`);
    } catch (e) {
      Logger.log(`Error skipping ${serviceConfig.name}: ${e.message}`);
    }
    
    Utilities.sleep(500);
  }
  
  Logger.log('All services skip completed');
}

function debugService() {
  let serviceName = 'tncfd';
  const CONFIG = getConfig();
  const service = getServiceInstance(serviceName);
  
  if (!service) {
    Logger.log(`Service ${serviceName} not found`);
    return;
  }
  
  const serviceConfig = CONFIG.SERVICES.find(s => s.name === serviceName);
  if (!serviceConfig) {
    Logger.log(`Service config for ${serviceName} not found`);
    return;
  }
  
  Logger.log(`\n========== DEBUG: ${serviceName} ==========`);
  Logger.log(`Display Name: ${serviceConfig.displayName}`);
  Logger.log(`URL: ${serviceConfig.url}`);
  Logger.log(`Enabled: ${serviceConfig.enabled}`);
  Logger.log(`Message Thread ID: ${serviceConfig.messageThreadId}`);
  Logger.log(`\n--- Fetching Announcements ---\n`);
  
  try {
    const announcements = service.fetch();
    Logger.log(`Found ${announcements.length} announcements\n`);
    
    for (let i = 0; i < announcements.length; i++) {
      const announcement = announcements[i];
      
      if (typeof service.fetchDetailContent === 'function') {
        const detailKey = announcement.pageId || announcement.detailUrl || announcement.detailId;
        if (detailKey) {
          const detail = service.fetchDetailContent(detailKey);
          if (detail.content) announcement.content = detail.content;
          if (detail.publishDate) announcement.create_date = detail.publishDate;
          if (detail.images) announcement.images = detail.images;
        }
      }
      
      Logger.log(`\n[${i + 1}] Announcement ID: ${announcement.id}`);
      Logger.log(`Title: ${announcement.title}`);
      Logger.log(`Content: ${announcement.content.substring(0, 100)}${announcement.content.length > 100 ? '...' : ''}`);
      Logger.log(`Poster: ${announcement.poster || 'N/A'}`);
      Logger.log(`Create Date: ${announcement.create_date || 'N/A'}`);
      Logger.log(`URL: ${announcement.url || 'N/A'}`);
      Logger.log(`ID: ${announcement.id}`);
      
      Logger.log(`\n--- Telegram Message Preview ---`);
      const message = service.buildMessage(announcement, serviceConfig);
      Logger.log(message);
      Logger.log(`--- End of Message ---\n`);
    }
    
    Logger.log(`\n========== END DEBUG ==========\n`);
    
  } catch (e) {
    Logger.log(`Error in debug: ${e.message}`);
    Logger.log(`Stack: ${e.stack}`);
  }
}

function debugSend() {
  const serviceName = 'tncfd';
  const debugChatId = '5440674042';
  
  const CONFIG = getConfig();
  const service = getServiceInstance(serviceName);
  
  if (!service) {
    Logger.log(`Service ${serviceName} not found`);
    return;
  }
  
  const serviceConfig = CONFIG.SERVICES.find(s => s.name === serviceName);
  if (!serviceConfig) {
    Logger.log(`Service config for ${serviceName} not found`);
    return;
  }
  
  const telegram = new Telegram(CONFIG.TELEGRAM_BOT_TOKEN, debugChatId);
  
  Logger.log(`\n========== DEBUG SEND: ${serviceName} ==========`);
  Logger.log(`Sending to debug chat: ${debugChatId}`);
  
  try {
    const announcements = service.fetch();
    Logger.log(`Found ${announcements.length} announcements`);
    
    if (announcements.length === 0) {
      Logger.log('No announcements to send');
      return;
    }
    
    for (let i = 0; i < announcements.length; i++) {
      const announcement = announcements[i];
      Logger.log(`\n--- [${i + 1}/${announcements.length}] Processing: ${announcement.title} ---`);
      
      if (typeof service.fetchDetailContent === 'function') {
        const detailKey = announcement.pageId || announcement.detailUrl || announcement.detailId;
        if (detailKey) {
          Logger.log(`Fetching detail content with key: ${detailKey}`);
          const detail = service.fetchDetailContent(detailKey);
          Logger.log(`Detail result: ${JSON.stringify(detail)}`);
          if (detail.content) announcement.content = detail.content;
          if (detail.publishDate) announcement.create_date = detail.publishDate;
          if (detail.images) {
            announcement.images = detail.images;
            Logger.log(`Images found: ${detail.images.length}`);
            for (let j = 0; j < detail.images.length; j++) {
              Logger.log(`  Image ${j + 1}: ${detail.images[j]}`);
            }
          }
        }
      }
      
      const message = service.buildMessage(announcement, serviceConfig);
      Logger.log(`\nMessage:\n${message}`);
      
      if (announcement.images && announcement.images.length > 1) {
        Logger.log(`\nSending as MediaGroup (${announcement.images.length} images)`);
        const result = telegram.sendMediaGroup(
          announcement.images,
          message,
          null
        );
        Logger.log(`MediaGroup result: ${JSON.stringify(result)}`);
      } else if (announcement.images && announcement.images.length === 1) {
        Logger.log(`\nSending as Photo (1 image): ${announcement.images[0]}`);
        const result = telegram.sendPhoto(
          announcement.images[0],
          message,
          null
        );
        Logger.log(`Photo result: ${JSON.stringify(result)}`);
      } else if (announcement.poster) {
        Logger.log(`\nSending as Photo (poster): ${announcement.poster}`);
        const result = telegram.sendPhoto(
          announcement.poster,
          message,
          null
        );
        Logger.log(`Photo result: ${JSON.stringify(result)}`);
      } else {
        Logger.log(`\nSending as Text only`);
        const result = telegram.sendMessage(message, null);
        Logger.log(`Message result: ${JSON.stringify(result)}`);
      }
      
      Utilities.sleep(1000);
    }
    
    Logger.log(`\n========== END DEBUG SEND ==========`);
    
  } catch (e) {
    Logger.log(`Error: ${e.message}`);
    Logger.log(`Stack: ${e.stack}`);
  }
}