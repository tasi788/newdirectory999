class HinetService extends ServiceInterface {
  constructor() {
    super('hinet');
    this.apiUrl = 'https://search.hinet.net/getNotify';
  }

  fetch() {
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
      Logger.log(`Error fetching HiNet detail content: ${e.message}`);
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
