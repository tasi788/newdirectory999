class FaService extends ServiceInterface {
  constructor() {
    super('fa');
    this.apiUrl = 'https://www.fa.gov.tw/wm_DATA.php?data=Ship_notice';
  }

  fetch() {
    try {
      const options = {
        muteHttpExceptions: true
      };
      
      const response = UrlFetchApp.fetch(this.apiUrl, options);
      const content = response.getContentText('UTF-8');
      
      const announcements = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
      
      let match;
      while ((match = itemRegex.exec(content)) !== null) {
        const itemHtml = match[1];
        
        const titleMatch = /<title><!\[CDATA\[(.*?)\]\]><\/title>/.exec(itemHtml);
        const pubDateMatch = /<pubDate>(.*?)<\/pubDate>/.exec(itemHtml);
        const contextMatch = /<context><!\[CDATA\[(.*?)\]\]><\/context>/.exec(itemHtml);
        const linkMatch = /<link><!\[CDATA\[(.*?)\]\]><\/link>/.exec(itemHtml);
        
        if (!titleMatch || !linkMatch) continue;
        
        const title = titleMatch[1].trim();
        const pubDate = pubDateMatch ? pubDateMatch[1].trim() : '';
        const contextHtml = contextMatch ? contextMatch[1].trim() : '';
        const linkUrl = linkMatch[1].trim();
        
        const idMatch = /[?&]id=(\d+)/.exec(linkUrl);
        const id = idMatch ? idMatch[1] : Utilities.base64Encode(linkUrl);
        
        let plainContext = contextHtml.replace(/<[^>]+>/g, '').trim();

        const announcement = this.formatAnnouncement({
          title: title,
          content: plainContext,
          poster: '',
          create_date: pubDate,
          url: linkUrl,
          id: id
        });
        
        announcements.push(announcement);
      }
      
      return announcements;
    } catch (e) {
      Logger.log(`Error fetching FA announcements: ${e.message}`);
      return [];
    }
  }

  skip() {
    try {
      const announcements = this.fetch();
      return announcements.map(a => a.id);
    } catch (e) {
      Logger.log(`Error in FA skip: ${e.message}`);
      return [];
    }
  }

  buildMessage(announcement, serviceConfig) {
    const displayName = serviceConfig.displayName || '農業部漁業署';
    let message = `🚢 <a href="${announcement.url}">${displayName}</a>\n\n` +
           `<b>${announcement.title}</b>\n\n` +
           `${announcement.content}\n\n` +
           `🕛 時間: ${announcement.create_date}`;
           
    return message;
  }
}
