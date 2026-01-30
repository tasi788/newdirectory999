class HinetService extends ServiceInterface {
  constructor() {
    super('hinet');
    this.apiUrl = 'https://search.hinet.net/getNotify';
  }

  fetchHinetSource() {
    try {
      const timestamp = new Date().getTime();
      const url = `${this.apiUrl}?callback=jsonpCallback&type=0&sort=0&mobile=0&_=${timestamp}`;
      
      const response = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true
      });
      
      let text = response.getContentText('UTF-8');
      
      const jsonMatch = text.match(/jsonpCallback\((.+)\);?\s*$/s);
      if (!jsonMatch) {
        Logger.log('Failed to extract JSON from JSONP response');
        return [];
      }
      
      const data = JSON.parse(jsonMatch[1]);
      const announcements = [];
      
      if (data && data.countryInfo && data.countryInfo.content) {
        const html = data.countryInfo.content;
        
        const rowRegex = /<tr><td>([^<]+)<\/td><td><a href=([^>]+)>([^<]+)<\/a><\/td><td>([^<]*)<\/td><\/tr>/g;
        let rowMatch;
        
        while ((rowMatch = rowRegex.exec(html)) !== null) {
          const publishDate = rowMatch[1].trim();
          const detailUrl = rowMatch[2].trim();
          const titleEncoded = rowMatch[3].trim();
          const endDate = rowMatch[4].trim();
          
          const title = this.decodeHtmlEntities(titleEncoded);
          
          const idMatch = detailUrl.match(/id=([^&]+)/);
          const id = idMatch ? idMatch[1] : this.generateMD5(title + '+' + publishDate);
          
          const announcement = this.formatAnnouncement({
            title: title,
            content: endDate ? `公告期間：${publishDate} ~ ${endDate}` : '',
            poster: '',
            create_date: publishDate,
            url: detailUrl,
            id: id
          });
          
          announcement.detailId = id;
          
          announcements.push(announcement);
        }
      }
      
      return announcements;
      
    } catch (e) {
      Logger.log(`Error fetching HiNet announcements: ${e.message}`);
      return [];
    }
  }

  fetch() {
    const hinetAnnouncements = this.fetchHinetSource();
    const chtAnnouncements = this.fetchChtSource();
    return hinetAnnouncements.concat(chtAnnouncements);
    // return chtAnnouncements;
  }

  fetchChtSource() {
    try {
      const url = 'https://www.cht.com.tw/home/web/api/MessagesRevision/GetMessageDateGroupPartialView';
      // Use raw string payload to ensure exact matching if needed, but object is cleaner if keys are correct.
      // The keys contain brackets which GAS handles.
      const payload = {
        'filterMessage[datasourceItemID]': '{8DAECF69-AEF0-4F1B-B066-3306E547C0CC}',
        'filterMessage[categoryDatasourceItemID]': '{31F151B0-5FD6-455B-A1EE-D4058DC5B139}',
        'filterMessage[categoryID]': '{A2C39040-30A3-428B-A9F6-09D225B8E85E}',
        'filterMessage[year]': '全部年份',
        'filterMessage[month]': '全部月份',
        'filterMessage[page]': '1',
        'filterMessage[countPerPage]': '10',
        'filterMessage[lang]': 'zh-TW',
        'filterMessage[isSearch]': 'false'
      };

      const response = UrlFetchApp.fetch(url, {
        method: 'post',
        headers: {
          'Referer': 'https://www.cht.com.tw/zh-tw/home/cht/messages',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
        },
        payload: payload,
        muteHttpExceptions: true
      });

      const html = response.getContentText('UTF-8');
      const announcements = [];
      
      // Updated regex to match the actual HTML structure where title is inside h3 tag
      const regex = /<a[^>]+href="([^"]+)"[^>]*>\s*<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<div[^>]*class="list-item-date"[^>]*>([^<]+)<\/div>/g;
      let match;
      
      while ((match = regex.exec(html)) !== null) {
        let detailUrl = match[1];
        let title = match[2].trim();
        const publishDate = match[3].trim();
        
        // Handle HTML entities in URL and Title
        detailUrl = detailUrl.replace(/&amp;/g, '&');
        title = this.decodeHtmlEntities(title);
        
        // Use full URL as ID for CHT source to enable direct fetching in fetchDetailContent
        const id = detailUrl;
        
        const announcement = this.formatAnnouncement({
          title: title,
          content: '',
          poster: '', // Clean poster to avoid Telegram error
          create_date: publishDate,
          url: detailUrl,
          id: id
        });
        
        announcement.detailId = id;
        announcements.push(announcement);
      }
      
      return announcements;
      
    } catch (e) {
      Logger.log(`Error fetching CHT announcements: ${e.message}`);
      return [];
    }
  }

  skip() {
    try {
      const announcements = this.fetch();
      return announcements.map(a => a.id);
    } catch (e) {
      Logger.log(`Error in HiNet skip: ${e.message}`);
      return [];
    }
  }

  fetchDetailContent(id) {
    try {
      // Check if ID is a CHT URL (starts with http)
      if (id.toString().startsWith('http')) {
         const response = UrlFetchApp.fetch(id, {
          method: 'get',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36'
          },
          muteHttpExceptions: true
        });
        
        const html = response.getContentText('UTF-8');
        // Extract content from <div class="article-content mB-lg">
        const contentMatch = html.match(/<div class="article-content[^"]*">([\s\S]*?)<\/div>/);
        
        if (contentMatch) {
          let content = contentMatch[1].trim();
          content = this.stripHtml(content);
          return { content: content.substring(0, 500) }; // Limit length
        }
        
        return { content: '' };
      }

      // Existing Hinet logic
      const url = `https://search.hinet.net/getNotifyPage?id=${id}&callback=jsonpCallback`;
      
      const response = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true
      });
      
      let text = response.getContentText('UTF-8');
      
      const jsonMatch = text.match(/jsonpCallback\((.+)\);?\s*$/s);
      if (!jsonMatch) {
        return { content: '' };
      }
      
      const data = JSON.parse(jsonMatch[1]);
      
      if (data && data.countryInfo && data.countryInfo.content) {
        const html = data.countryInfo.content;
        
        const descMatch = html.match(/<li>說明：<span>([^<]+)<\/span><\/li>/);
        if (descMatch) {
          const content = this.decodeHtmlEntities(descMatch[1]);
          return { content: this.stripHtml(content).substring(0, 500) };
        }
        
        return { content: this.stripHtml(this.decodeHtmlEntities(html)).substring(0, 500) };
      }
      
      return { content: '' };
    } catch (e) {
      Logger.log(`Error fetching HiNet/CHT detail content: ${e.message}`);
      return { content: '' };
    }
  }

  decodeHtmlEntities(text) {
    const entityRegex = /&#(\d+);/g;
    return text.replace(entityRegex, (match, dec) => {
      return String.fromCharCode(parseInt(dec, 10));
    });
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
