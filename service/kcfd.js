class KcfdService extends ServiceInterface {
  constructor() {
    super('kcfd');
    this.apiUrl = 'https://119dts.fdkc.gov.tw/DTS/caselist/html';
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
      const content = response.getContentText('UTF-8');
      
      const announcements = [];
      
      // Match all <tr> that contains table_tr1 or table_tr2 
      // Need to extract: time, major type, minor type, location, unit, status
      // HTML format:
      // <tr class="table_tr1">
      //   <td align="center">1</td>
      //   <td align="center">2026/02/26 11:55:34</td>
      //   <td align="center">緊急救護</td>
      //   <td align="center"> 急病</td>
      //   <td align="center">
      //     高雄市苓雅區
      //   </td>
      //   <td align="center">苓雅分隊</td>
      //   <td align="center">已出動</td>
      // </tr>
      
      const trRegex = /<tr class="table_tr[12]">\s*<td[^>]*>\d+<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>\s*(.*?)\s*<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>/gs;
      
      let match;
      while ((match = trRegex.exec(content)) !== null) {
        const inTime = match[1].trim();
        const type = match[2].trim();
        const subType = match[3].trim();
        const location = match[4].trim(); 
        const unit = match[5].trim();
        const status = match[6].trim();
        
        if (!inTime) continue;
        
        // Use Time + Unit as prefix, so unit status updates can replace same prefix message
        const prefixBase = inTime + unit;
        const prefix = this.generateMD5(prefixBase);
        const id = `${prefix}_${status}`;
        
        const fullType = subType ? `${type}-${subType}` : type;
        
        const announcement = this.formatAnnouncement({
          title: `${location} - ${fullType}`,
          content: `${status}`,
          poster: '',
          create_date: inTime,
          url: this.apiUrl,
          id: id
        });
        
        announcement.data = {
          inTime,
          type: fullType,
          status,
          location,
          unit
        };
        
        announcements.push(announcement);
      }
      
      // Sort from oldest to newest based on inTime
      return announcements.sort((a, b) => {
        return new Date(a.create_date).getTime() - new Date(b.create_date).getTime();
      });
      
    } catch (e) {
      Logger.log(`Error fetching KCFD announcements: ${e.message}`);
      return [];
    }
  }

  skip() {
    try {
      const announcements = this.fetch();
      return announcements.map(a => a.id);
    } catch (e) {
      Logger.log(`Error in KCFD skip: ${e.message}`);
      return [];
    }
  }

  buildMessage(announcement, serviceConfig) {
    const data = announcement.data;
    if (!data) return `New Announcement: ${announcement.title}`;
    
    // Emojis based on data
    let typeEmoji = '🚒'; 
    if (data.type.includes('救護')) {
      typeEmoji = '🏥';
    }
    
    let statusEmoji = '';
    if (data.status.includes('已派遣') || data.status.includes('已出動')) statusEmoji = '🚨';
    else if (data.status.includes('到達') || data.status.includes('現場')) statusEmoji = '📍';
    else if (data.status.includes('送醫')) statusEmoji = '🚑';
    else if (data.status.includes('到院') || data.status.includes('返隊')) statusEmoji = '🏠';
    
    const displayName = serviceConfig.displayName || '高雄消防出勤';
    const siteUrl = serviceConfig.url || this.apiUrl;
    
    let message = `${typeEmoji} <a href="${siteUrl}">${displayName}</a> | ${data.status} ${statusEmoji}\n\n` +
           `📍 <b>${data.location}</b> (${data.type})\n` +
           `單位: ${data.unit}\n` +
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
