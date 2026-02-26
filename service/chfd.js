class ChfdService extends ServiceInterface {
  constructor() {
    super('chfd');
    this.apiUrl = 'https://www.chfd.gov.tw/RealInfo/index.aspx?Parser=99,3,29';
  }

  fetch() {
    try {
      const response = UrlFetchApp.fetch(this.apiUrl, { muteHttpExceptions: true });
      const content = response.getContentText('UTF-8');
      
      const announcements = [];
      const contentClean = content.replace(/\\r?\\n|\\r/g, '');
      
      const regex = /<span class="sr-only">序號<\/span>(.*?)<\/span>[\s\S]*?<span class="sr-only">受理時間<\/span>(.*?)<\/span>[\s\S]*?<span class="sr-only">案類<\/span>(.*?)<\/span>[\s\S]*?<span class="sr-only">案別<\/span>(.*?)<\/span>[\s\S]*?<span class="sr-only">發生地點<\/span>(.*?)<\/span>[\s\S]*?<span class="sr-only">派遣分隊<\/span>(.*?)<\/span>[\s\S]*?<span class="sr-only">執行狀況<\/span>(.*?)<\/span>/g;
      
      let match;
      while ((match = regex.exec(contentClean)) !== null) {
        let locRaw = match[5].trim();
        let locClean = locRaw;
        
        // Remove markdown tags if any
        const aMatch = /<a[^>]*>(.*?)<\/a>/.exec(locRaw);
        if (aMatch) {
          locClean = aMatch[1].trim();
        }
        
        // Remove trailing img tag if presents
        locClean = locClean.replace(/<img[^>]*>/g, '').trim();

        const num = match[1].trim();
        const inTime = match[2].trim();
        const type = match[3].trim();
        const subType = match[4].trim();
        const location = locClean;
        const unit = match[6].trim();
        const status = match[7].trim();
        
        if (!inTime) continue;
        
        // Use Time + num as prefix to be unique, if num is consistent, wait it seems it isn't
        // Since unit comes as string '彰化分隊', '二林,芳苑分隊', taking first unit
        const firstUnit = unit.split(',')[0].trim();
        const prefixBase = inTime + firstUnit;
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
      Logger.log(`Error fetching CHFD announcements: ${e.message}`);
      return [];
    }
  }

  skip() {
    try {
      const announcements = this.fetch();
      return announcements.map(a => a.id);
    } catch (e) {
      Logger.log(`Error in CHFD skip: ${e.message}`);
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
    if (data.status.includes('出勤') || data.status.includes('派遣')) statusEmoji = '🚨';
    else if (data.status.includes('到達')) statusEmoji = '📍';
    else if (data.status.includes('送往') || data.status.includes('送醫')) statusEmoji = '🚑';
    else if (data.status.includes('返隊')) statusEmoji = '🏠';
    
    const displayName = serviceConfig.displayName || '彰化消防出勤';
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
