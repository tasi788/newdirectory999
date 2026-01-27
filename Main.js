function main() {
  const CONFIG = getConfig();
  const db = new Database(CONFIG.SHEET_ID);
  const telegram = new Telegram(CONFIG.TELEGRAM_BOT_TOKEN, CONFIG.TELEGRAM_CHAT_ID);
  
  for (const serviceConfig of CONFIG.SERVICES) {
    if (!serviceConfig.enabled) {
      continue;
    }
    
    try {
      const service = getServiceInstance(serviceConfig.name);
      if (!service) {
        Logger.log(`Service ${serviceConfig.name} not found`);
        continue;
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
          const detailKey = announcement.pageId || announcement.detailUrl;
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
        });
        
        Utilities.sleep(1000);
      }
      
    } catch (e) {
      Logger.log(`Error processing service ${serviceConfig.name}: ${e.message}`);
    }
  }
  
  Logger.log('Main execution completed');
}

function getServiceInstance(serviceName) {
  switch(serviceName) {
    case 'jyb':
      return new JYBService();
    case 'seednet':
      return new SeednetService();
    case 'elf':
      return new ElfService();
    case 'fet':
      return new FetService();
    case 'hinet':
      return new HinetService();
    case 'homeplus':
      return new HomeplusService();
    case 'costco':
      return new CostcoService();
    default:
      return null;
  }
}

function skipService() {
  let serviceName = 'costco';
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
  let serviceName = 'homeplus';
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

function setupTimeTrigger() {
  ScriptApp.newTrigger('main')
    .timeBased()
    .everyHours(1)
    .create();
  
  Logger.log('Time trigger created: runs every 1 hour');
}
