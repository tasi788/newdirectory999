class FaService extends ServiceInterface {
  constructor() {
    super('fa');
    this.apiUrl = 'https://www.fa.gov.tw/list.php?theme=Ship_notice';
  }

  fetch() {
    try {
      const config = getConfig();
      let fetchUrl = this.apiUrl;
      const options = {
        muteHttpExceptions: true,
      };
      
      if (config.PROXY_URL && config.BASIC_AUTH) {
         fetchUrl = `${config.PROXY_URL}/${this.apiUrl}`;
         options.headers = {
           'Authorization': `Basic ${Utilities.base64Encode(config.BASIC_AUTH)}`
         };
      }

      const response = UrlFetchApp.fetch(fetchUrl, options);
      const content = response.getContentText('UTF-8');
      
      const announcements = [];
      
      // Split by table row title column
      const chunks = content.split('<td scope="row" data-th="標題"');
      // Skip the first chunk (HTML before the first row)
      for (let i = 1; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // Extract linkUrl and title
        const aTagMatch = /<a href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i.exec(chunk);
        if (!aTagMatch) continue;
        
        let linkUrl = aTagMatch[1].trim();
        if (!linkUrl.startsWith('http')) {
           linkUrl = `https://www.fa.gov.tw/${linkUrl.replace(/^\//,'')}`;
        }
        const title = aTagMatch[2].trim();
        
        // Extract pubDate
        const dateMatch = /<td data-th="發布日期"[^>]*>([\s\S]*?)<\/td>/i.exec(chunk);
        const pubDate = dateMatch ? dateMatch[1].trim() : '';
        
        // Format ROC date (e.g. 115-03-16) to Gregorian (e.g. 2026/03/16)
        let formattedDate = pubDate;
        const rocMatch = /^(\d{2,3})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(pubDate);
        if (rocMatch) {
           const gregorianYear = parseInt(rocMatch[1], 10) + 1911;
           formattedDate = `${gregorianYear}/${rocMatch[2]}/${rocMatch[3]}`;
        }
        
        const idMatch = /[?&]id=(\d+)/.exec(linkUrl);
        const id = idMatch ? idMatch[1] : Utilities.base64Encode(linkUrl);

        const announcement = this.formatAnnouncement({
          title: title,
          content: '',
          poster: '',
          create_date: formattedDate,
          url: linkUrl,
          id: id
        });
        
        // Pass detailId so Main.js knows how to trigger fetchDetailContent
        if (id) {
           announcement.detailId = `id=${id}`;
        }
        
        announcements.push(announcement);
      }
      
      return announcements;
    } catch (e) {
      Logger.log(`Error fetching FA announcements: ${e.message}`);
      return [];
    }
  }

  fetchDetailContent(detailKey) {
    try {
      const config = getConfig();
      let fetchUrl = `https://www.fa.gov.tw/view.php?theme=Ship_notice&subtheme=&${detailKey}`;
      const options = { muteHttpExceptions: true };
      
      // Use proxy if configured to bypass User-Agent blocks (400 Bad Request)
      if (config.PROXY_URL && config.BASIC_AUTH) {
         fetchUrl = `${config.PROXY_URL}/${fetchUrl}`;
         options.headers = {
           'Authorization': `Basic ${Utilities.base64Encode(config.BASIC_AUTH)}`
         };
      }
      
      const response = UrlFetchApp.fetch(fetchUrl, options);
      const content = response.getContentText('UTF-8');
      
      const result = {
        content: '',
        images: []
      };
      
      const contentMatch = /<div class="content">([\s\S]*?)<\/div>/i.exec(content);
      if (contentMatch) {
         result.content = contentMatch[1].replace(/<[^>]+>/g, '').trim();
      }

      // Find PDF links like <a href="redirect_file.php?theme=Ship_notice&id=23521" ...
      const pdfRegex = /<a href="(redirect_file\.php\?theme=Ship_notice&id=\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
      let match;

      while ((match = pdfRegex.exec(content)) !== null) {
         if (match[2].toLowerCase().includes('pdf') || match[2].toLowerCase().includes('.pdf')) {
            const pdfRelativeLink = match[1];
            // Trick APDF.io by appending &dummy=.pdf so it doesn't fail on query strings
            const fullPdfUrl = `https://www.fa.gov.tw/${pdfRelativeLink}&dummy=.pdf`;
            
            if (config.APDF_TOKEN) {
               try {
                  const apdfOptions = {
                     method: 'post',
                     contentType: 'application/json',
                     headers: {
                        'Authorization': `Bearer ${config.APDF_TOKEN}`
                     },
                     payload: JSON.stringify({ 
                       file: fullPdfUrl,
                       image_type: 'png',
                       pages: '1'
                     }),
                     muteHttpExceptions: true
                  };
                  const apdfResponse = UrlFetchApp.fetch('https://apdf.io/api/pdf/file/to-image', apdfOptions);
                  if (apdfResponse.getResponseCode() === 200) {
                     const jsonResp = JSON.parse(apdfResponse.getContentText());
                     // API returns an array: [{"page":1,"file":"https://...png","expiration":"..."}]
                     if (jsonResp && jsonResp.length > 0 && jsonResp[0].file) {
                        const imgUrl = jsonResp[0].file;
                        // Fetch the actual image so it becomes a blob for Telegram
                        const imageResp = UrlFetchApp.fetch(imgUrl);
                        const imageBlob = imageResp.getBlob();
                        imageBlob.setName(`fa_notice_${Date.now()}.png`);
                        result.images.push(imageBlob);
                     } else {
                        Logger.log('APDF unexpected response: ' + apdfResponse.getContentText());
                        result.images.push(fullPdfUrl);
                     }
                  } else {
                     Logger.log('APDF failed to convert PDF: ' + apdfResponse.getContentText());
                     result.images.push(fullPdfUrl);
                  }
               } catch (err) {
                  Logger.log('Error calling APDF Worker: ' + err.message);
                  result.images.push(fullPdfUrl);
               }
            } else {
               result.images.push(fullPdfUrl);
            }
         }
      }
      return result;
    } catch (e) {
      Logger.log('Error fetching FA detail content: ' + e.message);
      return {};
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
           `<b>${announcement.title}</b>\n\n`;
           
    if (announcement.content && announcement.content.trim().length > 0) {
      message += `${announcement.content}\n\n`;
    }
    
    // Fallback if formatting was missed
    let dateStr = announcement.create_date;
    if (dateStr && dateStr.includes('-')) {
       const rocMatch = /^(\d{2,3})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(dateStr);
       if (rocMatch) {
          const gregorianYear = parseInt(rocMatch[1], 10) + 1911;
          dateStr = `${gregorianYear}/${rocMatch[2]}/${rocMatch[3]}`;
       }
    }
    
    message += `🕛 時間: ${dateStr}`;
           
    return message;
  }
}
