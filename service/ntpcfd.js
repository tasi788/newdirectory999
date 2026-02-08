class NtpcfdService extends ServiceInterface {
  constructor() {
    super('ntpcfd');
    this.apiUrl = 'https://e.ntpc.gov.tw/v3/api/map/dynamic/layer/rescue';
  }

  fetch() {
    try {
      const response = UrlFetchApp.fetch(this.apiUrl, {
        muteHttpExceptions: true
      });
      
      const content = response.getContentText('UTF-8');
      let responseJson;
      try {
        responseJson = JSON.parse(content);
      } catch (e) {
        Logger.log('Error parsing NTPCFD response content');
        return [];
      }
      
      if (responseJson.status !== 200 || !responseJson.data) {
        Logger.log(`NTPCFD API error: ${responseJson.message}`);
        return [];
      }
      
      // Parse the inner JSON string in 'data' field
      let data;
      try {
        data = JSON.parse(responseJson.data);
      } catch (e) {
        Logger.log('Error parsing NTPCFD inner data JSON');
        return [];
      }
      
      if (!data.features || !Array.isArray(data.features)) {
        Logger.log('NTPCFD data has no features');
        return [];
      }
      
      const announcements = [];
      const now = new Date();
      
      for (const feature of data.features) {
        const props = feature.properties;
        
        if (!props || !props.featureId) continue;
        
        const id = props.featureId;
        const fireType = props.fireType || (props.type === 'AmbulanceBack' ? '救護案件' : '未知案件');
        const location = props.endPointInfo || '未知地點';
        
        // Parse time from featureId (e.g., 260208xxxxxx -> 2026/02/08)
        let createTime = now;
        if (id.length >= 6) {
          const yearPart = parseInt(id.substring(0, 2), 10);
          const monthPart = parseInt(id.substring(2, 4), 10);
          const dayPart = parseInt(id.substring(4, 6), 10);
          
          if (!isNaN(yearPart) && !isNaN(monthPart) && !isNaN(dayPart) &&
              monthPart >= 1 && monthPart <= 12 && dayPart >= 1 && dayPart <= 31) {
            const year = 2000 + yearPart;
            createTime = new Date(year, monthPart - 1, dayPart, now.getHours(), now.getMinutes(), now.getSeconds());
          }
        }
        
        const announcement = this.formatAnnouncement({
          title: `${location} - ${fireType}`,
          poster: '',
          create_date: createTime,
          url: `https://www.google.com/maps?q=${props.lat},${props.lng}`,
          id: id
        });
        
        announcement.data = {
           fireType,
           location,
           lat: props.lat,
           lng: props.lng
        };
        
        announcements.push(announcement);
      }
      
      return announcements.reverse(); // Assuming API returns newest first, reverse for chronological processing
      
    } catch (e) {
      Logger.log(`Error in NTPCFD fetch: ${e.message}`);
      return [];
    }
  }

  skip() {
    try {
      const announcements = this.fetch();
      return announcements.map(a => a.id);
    } catch (e) {
      Logger.log(`Error in NTPCFD skip: ${e.message}`);
      return [];
    }
  }

  buildMessage(announcement, serviceConfig) {
    const data = announcement.data;
    if (!data) return `New Announcement: ${announcement.title}`;
    
    // Emojis based on type
    let typeEmoji = '🚒';
    if (data.fireType.includes('救護') || data.fireType === 'AmbulanceBack' || data.fireType.includes('救護案件')) {
      typeEmoji = '🚑';
    }
    
    // Status emoji (NTPCFD doesn't provide detailed status, so we simulate "Active" or similar if needed, 
    // but user asked to match TNCFD format. TNCFD has detailed status emojis.
    // Since NTPC effectively only pushes "Active" missions in this feed (End/Start points),
    // we can use a generic "Processing" or "Dispatched" emoji, or just leave it blank/default.
    // TNCFD format: {typeEmoji} <link> | {status} {statusEmoji}
    // We will use "執行中" or similar as status, and 🚨 as emoji.
    const status = '執行中';
    const statusEmoji = '🚨';
    
    const displayName = serviceConfig.displayName || '新北消防出勤';
    const siteUrl = serviceConfig.url || this.apiUrl;

    // Time formatting: TNCFD shows "受理時間: {data.time}".
    // We have create_date Date object. Format it.
    const d = new Date(announcement.create_date);
    const dateStr = `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
    
    let message = `${typeEmoji} <a href="${siteUrl}">${displayName}</a> | ${status} ${statusEmoji}\n\n` +
      `📍 <b>${data.location}</b> (${data.fireType})\n` +
      `派遣分隊: \n\n` +
      `案件編號: ${announcement.id}\n` +
      `受理時間: ${dateStr}\n` + 
      `<a href="https://www.google.com/maps?q=${data.lat},${data.lng}">查看地圖</a>`;
      
    return message;
  }
}
