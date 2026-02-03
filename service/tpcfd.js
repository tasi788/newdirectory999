class TpcfdService extends ServiceInterface {
  constructor() {
    super('tpcfd');
    this.apiUrl = 'https://service119.tfd.gov.tw/service119/citizenCase/caseList';
  }

  fetch() {
    try {
      // POST request with t=random
      const payload = {
        't': Math.random().toString()
      };
      
      const options = {
        method: 'post',
        payload: payload,
        muteHttpExceptions: true
      };

      const response = UrlFetchApp.fetch(this.apiUrl, options);
      const content = response.getContentText('UTF-8');
      const data = JSON.parse(content);
      
      if (!data || !data.rows || !Array.isArray(data.rows)) {
        Logger.log('TPCFD response format error');
        return [];
      }
      
      const announcements = [];
      
      for (const row of data.rows) {
        // specific fields from user provided json:
        // inTime, csKindName, caseStatus, csPlaceFuzzy
        const inTime = row.inTime;
        const type = row.csKindName;
        const status = row.caseStatus;
        const location = row.csPlaceFuzzy;
        
        if (!inTime || !type || !status) continue;
        
        // Key Strategy: MD5(Time + Type) as prefix
        // Then ID = Prefix_Status
        const prefixBase = inTime + type;
        const prefix = this.generateMD5(prefixBase);
        const id = `${prefix}_${status}`;
        
        const announcement = this.formatAnnouncement({
          title: `${location} - ${type}`,
          content: `${status}`,
          poster: '',
          create_date: inTime,
          url: 'https://service119.tfd.gov.tw/service119/citizenCase.php', // Public facing page usually
          id: id
        });
        
        announcement.data = {
          inTime,
          type,
          status,
          location
        };
        
        announcements.push(announcement);
      }
      
      // Sort by create_date desc
      return announcements.sort((a, b) => {
        return new Date(a.create_date).getTime() - new Date(b.create_date).getTime();
      });
      
    } catch (e) {
      Logger.log(`Error fetching TPCFD announcements: ${e.message}`);
      return [];
    }
  }

  skip() {
    try {
      const announcements = this.fetch();
      return announcements.map(a => a.id);
    } catch (e) {
      Logger.log(`Error in TPCFD skip: ${e.message}`);
      return [];
    }
  }

  buildMessage(announcement, serviceConfig) {
    const data = announcement.data;
    if (!data) return `New Announcement: ${announcement.title}`;
    
    // Emojis
    let typeEmoji = '🚒'; 
    if (data.type.includes('救護')) {
      typeEmoji = '🏥';
    }
    
    let statusEmoji = '';
    if (data.status.includes('已派遣') || data.status.includes('已出勤')) statusEmoji = '🚨';
    else if (data.status.includes('到達')) statusEmoji = '📍';
    else if (data.status.includes('離開')) statusEmoji = '🚑';
    else if (data.status.includes('返隊')) statusEmoji = '🏠';
    
    const displayName = serviceConfig.displayName || '台北消防出勤';
    // Use the public viewing URL if known, otherwise API or main site
    const siteUrl = serviceConfig.url || 'https://service119.tfd.gov.tw/';
    
    let message = `${typeEmoji} <a href="${siteUrl}">${displayName}</a> | ${data.status} ${statusEmoji}\n\n` +
           `📍 <b>${data.location}</b> (${data.type})\n` +
           `時間: ${data.inTime}`;
           
    return message;
  }
  
  generateMD5(text) {
    const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, text, Utilities.Charset.UTF_8);
    let hashString = '';
    for (let i = 0; i < rawHash.length; i++) {
      const byte = rawHash[i];
      if (byte < 0) {
        hashString += (byte + 256).toString(16).padStart(2, '0');
      } else {
        hashString += byte.toString(16).padStart(2, '0');
      }
    }
    return hashString;
  }
}
