class TaiwanMobileService extends ServiceInterface {
  constructor() {
    super('taiwanmobile');
    this.listUrl = 'https://www.taiwanmobile.com/cs/public/servAnn/queryList.htm?type=3';
    this.baseUrl = 'https://www.taiwanmobile.com';
  }

  fetch() {
    try {
      const response = UrlFetchApp.fetch(this.listUrl, {
        muteHttpExceptions: true
      });
      
      const html = response.getContentText('UTF-8');
      const announcements = [];
      const seenIds = new Set();
      
      const rowRegex = /<tr[^>]*class="pagination_data"[^>]*>[\s\S]*?<td>(\d{4}\/\d{2}\/\d{2})<\/td>[\s\S]*?<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
      
      let match;
      while ((match = rowRegex.exec(html)) !== null) {
        const publishDate = match[1];
        const href = match[2];
        const title = this.stripHtml(match[3]);
        
        const url = href.startsWith('http') ? href : this.baseUrl + href;
        const idMatch = href.match(/\/([^\/]+)\.html$/);
        const id = idMatch ? idMatch[1] : this.generateMD5(title + publishDate);
        
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        
        const announcement = this.formatAnnouncement({
          title: title,
          content: '',
          poster: '',
          create_date: publishDate,
          url: url,
          id: id
        });
        
        announcement.detailUrl = url;
        
        announcements.push(announcement);
      }
      
      return announcements;
      
    } catch (e) {
      Logger.log(`Error fetching TaiwanMobile announcements: ${e.message}`);
      return [];
    }
  }

  fetchDetailContent(url) {
    try {
      const response = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true
      });
      
      const html = response.getContentText('UTF-8');
      
      const paragraphs = [];
      const pRegex = /<p>([^<]*(?:<br\s*\/?>[^<]*)*)<\/p>/gi;
      let pMatch;
      while ((pMatch = pRegex.exec(html)) !== null) {
        const text = this.stripHtml(pMatch[1].replace(/<br\s*\/?>/gi, '\n'));
        if (text.trim()) {
          paragraphs.push(text.trim());
        }
      }
      
      const content = paragraphs.join('\n').substring(0, 500);
      
      return { content: content, publishDate: '' };
      
    } catch (e) {
      Logger.log(`Error fetching detail content: ${e.message}`);
      return { content: '', publishDate: '' };
    }
  }

  skip() {
    try {
      const announcements = this.fetch();
      return announcements.map(a => a.id);
    } catch (e) {
      Logger.log(`Error in TaiwanMobile skip: ${e.message}`);
      return [];
    }
  }

  generateMD5(text) {
    const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, text);
    let hash = '';
    for (let i = 0; i < rawHash.length; i++) {
      let hex = (rawHash[i] & 0xFF).toString(16);
      if (hex.length === 1) hex = '0' + hex;
      hash += hex;
    }
    return hash;
  }
}
