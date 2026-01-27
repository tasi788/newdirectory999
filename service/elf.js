class ElfService extends ServiceInterface {
  constructor() {
    super('elf');
    this.newsUrl = 'https://www.elf.com.tw/news.aspx';
  }

  fetch() {
    try {
      const response = UrlFetchApp.fetch(this.newsUrl, {
        muteHttpExceptions: true
      });
      
      const html = response.getContentText('UTF-8');
      const announcements = [];
      
      const newsRegex = /<div class="news"[^>]*>([\s\S]*?)<div class="more">MORE<\/div>/g;
      let newsMatch;
      
      while ((newsMatch = newsRegex.exec(html)) !== null) {
        const newsBlock = newsMatch[1];
        
        const dateMatch = newsBlock.match(/icon-news-date\.png"[^>]*>(\d{4}-\d{2}-\d{2})/);
        const titleMatch = newsBlock.match(/<div class="news-text"[^>]*>([^<]+)<\/div>/);
        const contentMatch = newsBlock.match(/<div class="new-textContent"[^>]*>([\s\S]*?)<\/div>/);
        
        if (!dateMatch || !titleMatch) continue;
        
        const date = dateMatch[1].trim();
        const title = this.stripHtml(titleMatch[1]).trim();
        const content = contentMatch ? this.stripHtml(contentMatch[1]).trim() : '';
        
        const id = this.generateMD5(title + '+' + date);
        
        const announcement = this.formatAnnouncement({
          title: title,
          content: content.substring(0, 500),
          poster: '',
          create_date: date,
          url: this.newsUrl,
          id: id
        });
        
        announcements.push(announcement);
      }
      
      return announcements;
      
    } catch (e) {
      Logger.log(`Error fetching Elf announcements: ${e.message}`);
      return [];
    }
  }

  skip() {
    try {
      const announcements = this.fetch();
      return announcements.map(a => a.id);
    } catch (e) {
      Logger.log(`Error in Elf skip: ${e.message}`);
      return [];
    }
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
