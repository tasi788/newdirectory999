class CostcoService extends ServiceInterface {
  constructor() {
    super('costco');
    this.apiUrl = 'https://www.costco.com.tw/rest/v3/taiwan/cms/pages?pageType=ContentPage&pageLabelOrId=Newspage&lang=zh_TW&curr=TWD';
    this.baseUrl = 'https://www.costco.com.tw';
  }

  fetch() {
    try {
      const response = UrlFetchApp.fetch(this.apiUrl, {
        muteHttpExceptions: true
      });
      
      const data = JSON.parse(response.getContentText('UTF-8'));
      const announcements = [];
      
      const pageComposer = data.page_composer;
      if (!pageComposer || !Array.isArray(pageComposer)) {
        Logger.log('No page_composer found');
        return [];
      }
      
      let html = '';
      for (const item of pageComposer) {
        if (item.row && item.row.row_composer) {
          for (const composer of item.row.row_composer) {
            if (composer.html_render_component_block && 
                composer.html_render_component_block.html_render_component_ref &&
                composer.html_render_component_block.html_render_component_ref[0]) {
              const ref = composer.html_render_component_block.html_render_component_ref[0];
              if (ref.html) {
                html += ref.html;
              }
            }
          }
        }
      }
      
      if (!html) {
        Logger.log('No HTML content found');
        return [];
      }
      
      const rowRegex = /<td[^>]*class="Date"[^>]*>(\d{4}\/\d{2}\/\d{2})<\/td>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
      
      let match;
      while ((match = rowRegex.exec(html)) !== null) {
        const publishDate = match[1];
        const href = match[2];
        const title = this.stripHtml(match[3]);
        
        const url = href.startsWith('http') ? href : this.baseUrl + href;
        const pageId = href.replace(/^\/content\//, '').replace(/^\//, '');
        
        const announcement = this.formatAnnouncement({
          title: title,
          content: '',
          poster: '',
          create_date: publishDate,
          url: url,
          id: pageId
        });
        
        announcement.pageId = pageId;
        
        announcements.push(announcement);
      }
      
      return announcements;
      
    } catch (e) {
      Logger.log(`Error fetching Costco announcements: ${e.message}`);
      return [];
    }
  }

  fetchDetailContent(pageId) {
    try {
      const detailUrl = `https://www.costco.com.tw/rest/v3/taiwan/cms/pages?pageType=ContentPage&pageLabelOrId=${pageId}&lang=zh_TW&curr=TWD`;
      
      const response = UrlFetchApp.fetch(detailUrl, {
        muteHttpExceptions: true
      });
      
      const data = JSON.parse(response.getContentText('UTF-8'));
      const images = [];
      
      const pageComposer = data.page_composer;
      if (pageComposer && Array.isArray(pageComposer)) {
        for (const item of pageComposer) {
          if (item.row && item.row.row_composer) {
            for (const composer of item.row.row_composer) {
              if (composer.ad_builder_block && 
                  composer.ad_builder_block.ad_builder_ref) {
                for (const ref of composer.ad_builder_block.ad_builder_ref) {
                  if (ref.image && ref.image.url) {
                    images.push(ref.image.url);
                  }
                }
              }
            }
          }
        }
      }
      
      return { images: images };
      
    } catch (e) {
      Logger.log(`Error fetching detail content for ${pageId}: ${e.message}`);
      return { images: [] };
    }
  }

  skip() {
    try {
      const announcements = this.fetch();
      return announcements.map(a => a.id);
    } catch (e) {
      Logger.log(`Error in Costco skip: ${e.message}`);
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
