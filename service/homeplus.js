class HomeplusService extends ServiceInterface {
  constructor() {
    super('homeplus');
    this.listUrl = 'https://www.homeplus.net.tw/cable/topic/system';
  }

  fetch() {
    try {
      const response = UrlFetchApp.fetch(this.listUrl, {
        muteHttpExceptions: true
      });
      
      const html = response.getContentText('UTF-8');
      const announcements = [];
      
      const linkRegex = /<a[^>]*href="(https:\/\/www\.homeplus\.net\.tw\/cable\/topic\/system\/(\d+))"[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/g;
      
      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        const url = match[1];
        const id = match[2];
        const title = this.stripHtml(match[3]);
        
        const detail = this.fetchAnnouncementContent(url);
        
        const announcement = this.formatAnnouncement({
          title: title,
          content: detail.content,
          poster: '',
          create_date: detail.publishDate,
          url: url,
          id: id
        });
        
        announcements.push(announcement);
        
        if (announcements.length >= 10) break;
        Utilities.sleep(500);
      }
      
      return announcements;
      
    } catch (e) {
      Logger.log(`Error fetching Homeplus announcements: ${e.message}`);
      return [];
    }
  }

  fetchAnnouncementContent(url) {
    try {
      const response = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true
      });
      
      const html = response.getContentText('UTF-8');
      
      const dateRegex = /<p[^>]*class="sec-date"[^>]*>([^<]+)<\/p>/i;
      const dateMatch = html.match(dateRegex);
      let publishDate = '';
      if (dateMatch) {
        publishDate = dateMatch[1].trim();
      }
      
      const contentRegex = /<div[^>]*class="ck-content"[^>]*>([\s\S]*?)<\/div>/i;
      const contentMatch = html.match(contentRegex);
      let content = '';
      if (contentMatch) {
        content = this.stripHtml(contentMatch[1]).substring(0, 500);
      }
      
      return {
        publishDate: publishDate,
        content: content
      };
      
    } catch (e) {
      Logger.log(`Error fetching content from ${url}: ${e.message}`);
      return {
        publishDate: '',
        content: ''
      };
    }
  }

  skip() {
    try {
      const announcements = this.fetch();
      return announcements.map(a => a.id);
    } catch (e) {
      Logger.log(`Error in Homeplus skip: ${e.message}`);
      return [];
    }
  }
}
