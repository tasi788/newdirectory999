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
        const message = service.buildMessage(announcement, serviceConfig);
        
        if (announcement.poster) {
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
    case 'aaa':
      return new AAAService();
    case 'jyb':
      return new JYBService();
    default:
      return null;
  }
}

function skipService(serviceName) {
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

function setupTimeTrigger() {
  ScriptApp.newTrigger('main')
    .timeBased()
    .everyHours(1)
    .create();
  
  Logger.log('Time trigger created: runs every 1 hour');
}
