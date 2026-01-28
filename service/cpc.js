class CPCService extends ServiceInterface {
  constructor() {
    super('cpc');
    this.baseUrl = 'https://www.cpc.com.tw';
    this.sources = [
      {
        sn: 'ABBF62618F53F8DE',
        typeName: '新聞稿',
        hashtag: '#新聞稿'
      },
      {
        sn: 'D222AB2C227DC406',
        typeName: '最新訊息',
        hashtag: '#最新訊息'
      },
      {
        sn: '82FC652523030D44',
        typeName: '重大政策',
        hashtag: '#重大政策'
      },
      {
        sn: '460A00BC234B1923',
        typeName: '就業資訊',
        hashtag: '#就業資訊'
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

        let content = response.getContentText('UTF-8');
        if (!content) {
          continue;
        }

        content = content.replace(/^[\uFEFF\u200B]+/, '');

        let document;
        try {
          document = XmlService.parse(content);
        } catch (parseError) {
          Logger.log(`Failed to parse CPC RSS (${source.sn}): ${parseError.message}`);
          continue;
        }

        const root = document.getRootElement();
        const channel = this.findChild(root, 'channel');
        if (!channel) {
          continue;
        }

        const items = this.getChildrenByName(channel, 'item');
        for (const item of items) {
          const title = this.getChildText(item, 'title');
          if (!title) {
            continue;
          }

          const link = this.getChildText(item, 'link');
          const descriptionRaw = this.getChildText(item, 'description');
          const newsId = this.getChildText(item, 'NewsID') || this.getChildText(item, 'guid');
          const pubDateRaw = this.getChildText(item, 'pubDate') || this.getChildText(item, 'dc:date');
          const keywordsRaw = this.getChildText(item, 'keywords');

          const announcementId = newsId ? `${source.sn}_${newsId}` : this.generateMD5(`${source.sn}|${title}|${pubDateRaw || ''}`);
          if (seenIds.has(announcementId)) {
            continue;
          }
          seenIds.add(announcementId);

          const publishDate = this.formatDate(pubDateRaw);

          const description = descriptionRaw ? this.stripHtml(descriptionRaw).substring(0, 500) : '';
          const hashtags = this.buildHashtags(source.hashtag, keywordsRaw);

          const contentParts = [];
          if (description) {
            contentParts.push(description);
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

          const images = this.extractImageUrls(item);
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

  buildHashtags(baseHashtag, keywordsRaw) {
    const hashtags = [];

    if (baseHashtag) {
      hashtags.push(baseHashtag);
    }

    if (keywordsRaw) {
      const parts = keywordsRaw.split(/[，,]+/);
      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const hashtag = `#${trimmed.replace(/\s+/g, '')}`;
        if (!hashtags.includes(hashtag)) {
          hashtags.push(hashtag);
        }
      }
    }

    return hashtags;
  }

  extractImageUrls(item) {
    const images = [];
    const relateImages = this.findChild(item, 'RelateImages');
    if (!relateImages) {
      return images;
    }

    const imageItems = this.getChildrenByName(relateImages, 'ImageItem');
    for (const imageItem of imageItems) {
      const imageUrl = this.getChildText(imageItem, 'ImageUrl');
      if (imageUrl) {
        images.push(imageUrl);
      }
    }

    return images;
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

  getChildrenByName(element, name) {
    return element.getChildren().filter(child => child.getName().toLowerCase() === name.toLowerCase());
  }

  findChild(element, name) {
    const lowerName = name.toLowerCase();
    const children = element.getChildren();
    for (const child of children) {
      if (child.getName().toLowerCase() === lowerName) {
        return child;
      }
    }
    return null;
  }

  getChildText(element, name) {
    if (!element) {
      return '';
    }

    const lowerName = name.toLowerCase();

    for (const child of element.getChildren()) {
      if (child.getName().toLowerCase() === lowerName) {
        return child.getText().trim();
      }
    }

    if (name.includes(':')) {
      const [, actual] = name.split(':');
      return this.getChildText(element, actual);
    }

    return '';
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
