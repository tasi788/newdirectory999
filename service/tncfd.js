class TncfdService extends ServiceInterface {
  constructor() {
    super('tncfd');
    this.apiUrl = 'https://119dts.tncfd.gov.tw/DTS/caselist/html';
  }

  fetch() {
    try {
      const config = getConfig();
      let fetchUrl = this.apiUrl;
      const options = {
        muteHttpExceptions: true
      };

      if (config.PROXY_URL && config.BASIC_AUTH) {
         fetchUrl = `${config.PROXY_URL}/${this.apiUrl}`;
         options.headers = {
           'Authorization': `Basic ${Utilities.base64Encode(config.BASIC_AUTH)}`
         };
      }

      const response = UrlFetchApp.fetch(fetchUrl, options);
      
      const html = response.getContentText('UTF-8');
      const announcements = [];
      
      // Match rows
      const rowRegex = /<tr>([\s\S]*?)<\/tr>/g;
      let rowMatch;
      
      // Skip the first match (header) if generic matching
      let isFirst = true;
      
      while ((rowMatch = rowRegex.exec(html)) !== null) {
        if (isFirst) {
          isFirst = false;
          continue; // Skip header row
        }
        
        // Remove comments to avoid parsing commented out tds
        let rowContent = rowMatch[1].replace(/<!--[\s\S]*?-->/g, '');
        
        // Match tds
        const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
        const tds = [];
        let tdMatch;
        while ((tdMatch = tdRegex.exec(rowContent)) !== null) {
          tds.push(tdMatch[1].trim());
        }
        
        // Expecting 7 columns after comment removal
        // Index:
        // 0: 序號 (Serial)
        // 1: 編號 (Case No)
        // 2: 受理時間 (Time)
        // 3: 案類 (Type)
        // 4: 發生地點 (Location)
        // 5: 派遣分隊 (Unit)
        // 6: 執行狀況 (Status)
        
        if (tds.length < 7) {
          continue;
        }
        
        const caseId = tds[1];
        const time = tds[2];
        const type = tds[3];
        const location = tds[4];
        const unit = tds[5];
        const status = tds[6];
        
        // Validate required fields
        if (!caseId || !status) continue;
        
        // ID construction: {編號}_{執行狀況}
        const id = `${caseId}_${status}`;
        
        // Use time for create_date.
        // Format: '2026/02/02 16:41:28' - works with new Date() usually
        
        const announcement = this.formatAnnouncement({
          title: `${location} - ${type}`,
          content: `${unit} - ${status}`,
          poster: '',
          create_date: time,
          url: this.apiUrl,
          id: id
        });
        
        // Attach extra data for buildMessage
        announcement.data = {
          caseId,
          time,
          type,
          location,
          unit,
          status
        };
        
        announcements.push(announcement);
      }
      
      return announcements;
      
    } catch (e) {
      Logger.log(`Error fetching TNCFD announcements: ${e.message}`);
      return [];
    }
  }

  skip() {
    try {
      const announcements = this.fetch();
      return announcements.map(a => a.id);
    } catch (e) {
      Logger.log(`Error in TNCFD skip: ${e.message}`);
      return [];
    }
  }

  buildMessage(announcement, serviceConfig) {
    const data = announcement.data;
    if (!data) return `New Announcement: ${announcement.title}`;
    
    // Emojis
    let typeEmoji = '🚒'; // Default to Fire
    if (data.type.includes('緊急救護') || data.type.includes('救護')) {
      typeEmoji = '🏥';
    } else if (data.type.includes('火災')) {
      typeEmoji = '🚒';
    }
    
    let statusEmoji = '';
    if (data.status.includes('已派遣')) statusEmoji = '🚨';
    else if (data.status.includes('已出動')) statusEmoji = '💨';
    else if (data.status.includes('已到達')) statusEmoji = '📍';
    else if (data.status.includes('火已滅')) statusEmoji = '🧯'; 
    else if (data.status.includes('已到院')) statusEmoji = '🏥';  
    else if (data.status.includes('返隊中')) statusEmoji = '🔙'; 
    else if (data.status.includes('已返隊')) statusEmoji = '🏠'; // Or 🏁
    else if (data.status.includes('送醫中')) statusEmoji = '🚑';
    
    const displayName = serviceConfig.displayName || '台南消防出勤';
    const siteUrl = serviceConfig.url || this.apiUrl;
    
    let message = `${typeEmoji} <a href="${siteUrl}">${displayName}</a> | ${data.status} ${statusEmoji}\n\n` +
           `📍 <b>${data.location}</b> (${data.type})\n` +
           `派遣分隊: ${data.unit}\n\n` +
           `案件編號: ${data.caseId}\n` +
           `受理時間: ${data.time}`;
           
    return message;
  }
}
