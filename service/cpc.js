class CPCService extends ServiceInterface {
  constructor() {
    super('cpc');
    this.baseUrl = 'https://www.cpc.com.tw';
    this.sources = [
      {
        sn: '78702647C7A5B61B',
        typeName: '新聞稿',
        hashtag: '#新聞稿',
        maxItems: 30
      },
      {
        sn: '594FC080B4D63D73',
        typeName: '最新訊息',
        hashtag: '#最新訊息',
        maxItems: 30
      },
      {
        sn: 'CF5DF99964D9DB8E',
        typeName: '重大政策',
        hashtag: '#重大政策',
        maxItems: 30
      }
    ];
  }

  fetch() {
    const announcements = [];
    const seenIds = new Set();

    for (const source of this.sources) {
      try {
        const url = `${this.baseUrl}/OpenData.aspx?SN=${source.sn}`;
        const response = UrlFetchApp.fetch(url, {
          muteHttpExceptions: true
        });

        const content = response.getContentText('UTF-8');
        if (!content) {
          continue;
        }

        let data;
        try {
          data = JSON.parse(content);
        } catch (parseError) {
          Logger.log(`Failed to parse CPC JSON (${source.sn}): ${parseError.message}`);
          continue;
        }

        if (!Array.isArray(data)) {
          continue;
        }

        const itemsToProcess = data.slice(0, source.maxItems || 30);

        for (const item of itemsToProcess) {
          const title = item.title || item.Title;
          if (!title) {
            continue;
          }

          const link = item.Source || item.Link || '';
          const htmlContent = item['內容'] || item.Content || '';
          const pubDateRaw = item['刊登日期'] || item.PublishDate || '';
          const relatedImages = item['相關圖片'] || item.RelatedImages || [];

          const newsId = this.extractNewsId(link);
          const announcementId = newsId ? `${source.sn}_${newsId}` : this.generateMD5(`${source.sn}|${title}|${pubDateRaw}`);
          
          if (seenIds.has(announcementId)) {
            continue;
          }
          seenIds.add(announcementId);

          const publishDate = this.formatDate(pubDateRaw);
          const processedContent = this.processHtmlContent(htmlContent);
          const hashtags = this.buildHashtags(source.hashtag);

          const contentParts = [];
          if (processedContent) {
            contentParts.push(processedContent);
          }
          if (hashtags.length > 0) {
            contentParts.push(hashtags.join(' '));
          }

          const announcement = this.formatAnnouncement({
            title: title,
            content: contentParts.join('\n\n'),
            create_date: publishDate,
            url: link,
            id: announcementId
          });

          const images = this.extractImagesFromArray(relatedImages);
          if (images.length > 0) {
            announcement.images = images;
          }

          announcements.push(announcement);
        }
      } catch (e) {
        Logger.log(`Error fetching CPC source ${source.sn}: ${e.message}`);
      }
    }

    return announcements;
  }

  skip() {
    try {
      const announcements = this.fetch();
      return announcements.map(a => a.id);
    } catch (e) {
      Logger.log(`Error in CPC skip: ${e.message}`);
      return [];
    }
  }

  buildHashtags(baseHashtag) {
    const hashtags = [];
    if (baseHashtag) {
      hashtags.push(baseHashtag);
    }
    return hashtags;
  }

  extractImagesFromArray(relatedImages) {
    const images = [];
    if (!Array.isArray(relatedImages)) {
      return images;
    }

    for (const imgStr of relatedImages) {
      const match = imgStr.match(/\((https?:\/\/[^)]+)\)/);
      if (match) {
        images.push(match[1]);
      }
    }

    return images;
  }

  extractNewsId(link) {
    if (!link) return null;
    const match = link.match(/[?&]s=(\d+)/);
    return match ? match[1] : null;
  }

  processHtmlContent(htmlContent) {
    if (!htmlContent) return '';

    let text = htmlContent;
    const tablePlaceholders = [];

    text = text.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (match, tableContent) => {
      const tableText = this.convertTableToText(tableContent);
      const placeholder = `__TABLE_${tablePlaceholders.length}__`;
      tablePlaceholders.push(tableText);
      return `\n\n${placeholder}\n\n`;
    });

    text = this.stripHtml(text);
    text = text.replace(/\s+/g, ' ').trim();

    for (let i = 0; i < tablePlaceholders.length; i++) {
      text = text.replace(`__TABLE_${i}__`, `\n${tablePlaceholders[i]}\n`);
    }

    return text.substring(0, 500);
  }

  convertTableToText(tableHtml) {
    let result = '';

    const rows = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    
    for (const row of rows) {
      const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
      const cellTexts = cells.map(cell => {
        const cleaned = cell.replace(/<[^>]+>/g, '').trim();
        return cleaned || '';
      }).filter(t => t);

      if (cellTexts.length > 0) {
        result += cellTexts.join(' | ') + '\n';
      }
    }

    return result.trim();
  }

  formatDate(pubDateRaw) {
    if (!pubDateRaw) {
      return null;
    }

    try {
      const date = new Date(pubDateRaw);
      if (isNaN(date.getTime())) {
        return null;
      }
      return Utilities.formatDate(date, 'Asia/Taipei', 'yyyy/MM/dd');
    } catch (e) {
      return null;
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
