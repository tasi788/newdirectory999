class FetService extends ServiceInterface {
  constructor() {
    super('fet');
    this.apiUrl = 'https://www.fetnet.net/bin/cbu/cards/cbuannounce';
  }

  fetch() {
    try {
      const url = `${this.apiUrl}?offset=0&limit=10`;
      
      const response = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true
      });
      
      const data = JSON.parse(response.getContentText('UTF-8'));
      const announcements = [];
      
      if (Array.isArray(data.result)) {
        for (const item of data.result) {
          const date = this.formatDate(item.date);
          const title = item.title || '';
          const content = this.stripHtml(item.content || '');
          
          const id = this.generateMD5(title + '+' + date);
          
          const announcement = this.formatAnnouncement({
            title: title,
            content: content.substring(0, 500),
            poster: '',
            create_date: date,
            url: 'https://www.fetnet.net/content/cbu/tw/help-center/announcement.html',
            id: id
          });
          
          announcements.push(announcement);
        }
      }
      
      return announcements;
      
    } catch (e) {
      Logger.log(`Error fetching FET announcements: ${e.message}`);
      return [];
    }
  }

  skip() {
    try {
      const announcements = this.fetch();
      return announcements.map(a => a.id);
    } catch (e) {
      Logger.log(`Error in FET skip: ${e.message}`);
      return [];
    }
  }

  formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
