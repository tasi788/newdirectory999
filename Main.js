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
  const frequentServices = ['tncfd','tccfd','tpcfd','ntpcfd'];
  
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
    
    // For services with message editing, deduplicate by prefix and keep only the latest
    let processAnnouncements = announcements;
    if (serviceConfig.enableMessageEdit && serviceConfig.pruneSeparator) {
      const latestByPrefix = {};
      for (const announcement of announcements) {
        const idPrefix = announcement.id.split(serviceConfig.pruneSeparator)[0];
        // Keep the latest one (assuming announcements are already sorted old to new)
        latestByPrefix[idPrefix] = announcement;
      }
      processAnnouncements = Object.values(latestByPrefix);
      Logger.log(`After deduplication: ${processAnnouncements.length} unique cases`);
    }
    
    const newAnnouncements = [];
    for (const announcement of processAnnouncements) {
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
      const dateStr = announcement.create_date || new Date().toISOString();
      
      // Check if we should edit an existing message
      let shouldEdit = false;
      let existingMessageId = null;
      
      if (serviceConfig.enableMessageEdit && serviceConfig.pruneSeparator) {
        const idPrefix = announcement.id.split(serviceConfig.pruneSeparator)[0];
        existingMessageId = db.getMessageId(serviceConfig.name, idPrefix);
        shouldEdit = existingMessageId !== null;
      }
      
      if (shouldEdit) {
        // Edit existing message
        Logger.log(`Editing message ${existingMessageId} for ${announcement.id}`);
        telegram.editMessageText(existingMessageId, message);
        
        // Update database with same messageId
        db.setServiceDataWithMessage(serviceConfig.name, announcement.id, dateStr, existingMessageId, serviceConfig.pruneSeparator);
      } else {
        // Send new message
        let result = null;
        
        if (announcement.images && announcement.images.length > 1) {
          result = telegram.sendMediaGroup(
            announcement.images,
            message,
            serviceConfig.messageThreadId
          );
        } else if (announcement.images && announcement.images.length === 1) {
          result = telegram.sendPhoto(
            announcement.images[0],
            message,
            serviceConfig.messageThreadId
          );
        } else if (announcement.poster) {
          result = telegram.sendPhoto(
            announcement.poster,
            message,
            serviceConfig.messageThreadId
          );
        } else {
          result = telegram.sendMessage(message, serviceConfig.messageThreadId);
        }
        
        // Store message ID if editing is enabled
        if (serviceConfig.enableMessageEdit && result && result.message_id) {
          Logger.log(`Storing message ID ${result.message_id} for ${announcement.id}`);
          db.setServiceDataWithMessage(serviceConfig.name, announcement.id, dateStr, result.message_id, serviceConfig.pruneSeparator);
        } else {
          // Old format: just store date
          db.setServiceData(serviceConfig.name, {
            [announcement.id]: dateStr
          }, serviceConfig.pruneSeparator);
        }
      }
      
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
    'tncfd': TncfdService,
    'tpcfd': TpcfdService,
    'tccfd': TccfdService,
    'ntpcfd': NtpcfdService,
  };

  const ServiceClass = serviceClasses[serviceName];
  return ServiceClass ? new ServiceClass() : null;
}

function skipService() {
  let serviceName = 'tccfd';
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

function skipFreq(targetServiceName) {
  const CONFIG = getConfig();
  const db = new Database(CONFIG.SHEET_ID);
  
  for (const serviceConfig of CONFIG.SERVICES) {
    if (targetServiceName && serviceConfig.name !== targetServiceName) continue;
    
    if (!serviceConfig.enabled) continue;
    if (!serviceConfig.enableMessageEdit) continue;
    
    const service = getServiceInstance(serviceConfig.name);
    if (!service) {
      Logger.log(`Service ${serviceConfig.name} not found`);
      continue;
    }
    
    try {
      const ids = service.skip();
      Logger.log(`Skipping (Freq) ${ids.length} announcements for ${serviceConfig.name}`);
      // Pass pruneSeparator to handle inheritance
      db.skipServiceFreq(serviceConfig.name, ids, serviceConfig.pruneSeparator);
      Logger.log(`Skip (Freq) completed for ${serviceConfig.name}`);
    } catch (e) {
      Logger.log(`Error skipping (Freq) ${serviceConfig.name}: ${e.message}`);
    }
    
    if (!targetServiceName) Utilities.sleep(500);
  }
  
  Logger.log('Freq services skip completed');
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

function testRun() {
  const serviceName = 'smc'; // Change this to test other services
  const CONFIG = getConfig();
  const db = new Database(CONFIG.SHEET_ID);
  const telegram = new Telegram(CONFIG.TELEGRAM_BOT_TOKEN, CONFIG.TELEGRAM_CHAT_ID);
  
  const serviceConfig = CONFIG.SERVICES.find(s => s.name === serviceName);
  
  if (!serviceConfig) {
    Logger.log(`Service ${serviceName} not found`);
    return;
  }
  
  Logger.log(`========== TEST RUN: ${serviceName} ==========`);
  processService(serviceConfig, db, telegram);
  Logger.log(`========== TEST RUN COMPLETED ==========`);
}