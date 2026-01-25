class JYBService extends ServiceInterface {
  constructor() {
    super('jyb');
    this.apiUrl = 'https://api.jyb.com.tw/post/v1frontend/post/index';
  }

  fetch() {
    try {
      const url = `${this.apiUrl}?type=notice&label=&page=1&pageSize=10`;
      
      const response = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true
      });
      
      const result = JSON.parse(response.getContentText());
      
      const announcements = [];
      
      if (result && Array.isArray(result.list)) {
        for (const item of result.list) {
          const content = this.stripHtml(item.content || '');
          
          const posterMatch = item.content.match(/<img[^>]+src="([^"]+)"/);
          const posterUrl = posterMatch ? posterMatch[1] : '';
          
          const announcement = this.formatAnnouncement({
            title: item.title,
            content: content.substring(0, 500),
            poster: posterUrl,
            create_date: item.publishedAt,
            id: String(item.poid)
          });
          
          announcements.push(announcement);
        }
      }
      
      return announcements;
      
    } catch (e) {
      Logger.log(`Error fetching JYB announcements: ${e.message}`);
      return [];
    }
  }

  skip() {
    try {
      const announcements = this.fetch();
      return announcements.map(a => a.id);
    } catch (e) {
      Logger.log(`Error in JYB skip: ${e.message}`);
      return [];
    }
  }

  stripHtml(html) {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
