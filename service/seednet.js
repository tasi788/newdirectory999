class SeednetService extends ServiceInterface {
  constructor() {
    super('seednet');
    this.listUrl = 'https://service.seed.net.tw/register-cgi/service_notice?FUNC=notice_qry_more&Category=01&Start=1';
  }

  fetch() {
    try {
      const response = UrlFetchApp.fetch(this.listUrl, {
        muteHttpExceptions: true
      });
      
      const html = response.getContentText('UTF-8');
      const announcements = [];
      
      const dateRegex = /<td[^>]*class="date">(\d{4}\/\d{2}\/\d{2})/g;
      const linkRegex = /<a href="(https:\/\/service\.seed\.net\.tw\/importantNotice\/IN\d+\.htm)"[^>]*>([^<]+)<\/a>/g;
      
      const dates = [];
      let dateMatch;
      while ((dateMatch = dateRegex.exec(html)) !== null) {
        dates.push(dateMatch[1]);
      }
      
      const links = [];
      let linkMatch;
      while ((linkMatch = linkRegex.exec(html)) !== null) {
        links.push({
          url: linkMatch[1],
          title: this.stripHtml(linkMatch[2])
        });
      }
      
      for (let i = 0; i < Math.min(dates.length, links.length, 10); i++) {
        const id = links[i].url.match(/IN(\d+)\.htm/);
        if (!id) continue;
        
        const detail = this.fetchAnnouncementContent(links[i].url);
        
        const announcement = this.formatAnnouncement({
          title: detail.title || links[i].title,
          content: detail.content,
          poster: '',
          create_date: dates[i],
          url: links[i].url,
          id: id[1]
        });
        
        announcements.push(announcement);
        Utilities.sleep(500);
      }
      
      return announcements;
      
    } catch (e) {
      Logger.log(`Error fetching Seednet announcements: ${e.message}`);
      return [];
    }
  }

  fetchAnnouncementContent(url) {
    try {
      const response = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true
      });
      
      const html = response.getContentText('UTF-8');
      
      const titleRegex = /<td[^>]*class="title"[^>]*>([^<]+)<\/td>/i;
      const titleMatch = html.match(titleRegex);
      const title = titleMatch ? this.stripHtml(titleMatch[1]) : '';
      
      const ctRegex = /<td[^>]*class="ct"[^>]*>([\s\S]*?)<\/td>/i;
      const ctMatch = html.match(ctRegex);
      const content = ctMatch ? this.stripHtml(ctMatch[1]).substring(0, 500) : '';
      
      return {
        title: title,
        content: content
      };
      
    } catch (e) {
      Logger.log(`Error fetching content from ${url}: ${e.message}`);
      return {
        title: '',
        content: ''
      };
    }
  }

  skip() {
    try {
      const announcements = this.fetch();
      return announcements.map(a => a.id);
    } catch (e) {
      Logger.log(`Error in Seednet skip: ${e.message}`);
      return [];
    }
  }
}
