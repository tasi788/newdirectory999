class SMCService extends ServiceInterface {
  constructor() {
    super('smc');
    this.apiUrl = 'https://smc.peering.tw/data/incidents.json';
  }

  fetch() {
    try {
      const response = UrlFetchApp.fetch(this.apiUrl, {
        muteHttpExceptions: true
      });
      
      const content = response.getContentText('UTF-8');
      const incidents = JSON.parse(content);
      
      if (!Array.isArray(incidents)) {
        Logger.log('SMC response is not an array');
        return [];
      }
      
      const announcements = [];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      for (const incident of incidents) {
        // Filter out old incidents (older than 7 days)
        const incidentDate = new Date(incident.date);
        if (incidentDate < sevenDaysAgo) {
          continue;
        }

        // Base announcement for the incident itself
        // Include status in ID so that status changes generate new IDs (new messages)
        const baseIdStr = incident.title + incident.date + (incident.status || '');
        const id = this.generateMD5(baseIdStr);
        
        const announcement = this.formatAnnouncement({
          title: incident.title,
          content: incident.description,
          poster: '',
          create_date: incident.date,
          url: 'https://smc.peering.tw/',
          id: id
        });
        
        // Add incident-specific properties for message building
        announcement.status = incident.status;
        announcement.segment = incident.segment;
        announcement.cableid = incident.cableid;
        announcement.reparing_at = incident.reparing_at;
        
        // Push the main incident announcement
        announcements.push(announcement);
        
        // Check if resolved and create a separate announcement
        if (incident.resolved_at) {
          // Check if resolved date is also within the last 7 days
          const resolvedDate = new Date(incident.resolved_at);
          if (resolvedDate < sevenDaysAgo) {
            continue;
          }

          const resolvedId = id + '_resolved';
          
          const resolvedAnnouncement = this.formatAnnouncement({
            title: incident.title, // Title remains same, buildMessage will handle prefix
            content: incident.description,
            poster: '',
            create_date: incident.resolved_at, // Use resolved date for this one
            url: 'https://smc.peering.tw/',
            id: resolvedId
          });
          
          resolvedAnnouncement.isResolved = true;
          resolvedAnnouncement.resolved_at = incident.resolved_at;
          resolvedAnnouncement.original_id = id;
          
          announcements.push(resolvedAnnouncement);
        }
      }
      
      // Sort by create_date desc
      return announcements.sort((a, b) => {
        return new Date(b.create_date).getTime() - new Date(a.create_date).getTime();
      });
      
    } catch (e) {
      Logger.log(`Error fetching SMC announcements: ${e.message}`);
      return [];
    }
  }

  skip() {
    try {
      const announcements = this.fetch();
      return announcements.map(a => a.id);
    } catch (e) {
      Logger.log(`Error in SMC skip: ${e.message}`);
      return [];
    }
  }

  buildMessage(announcement, serviceConfig) {
    const displayName = serviceConfig.displayName || '台灣海纜動態';
    const siteUrl = serviceConfig.url || 'https://smc.peering.tw';
    
    let serviceLink = `<a href="${siteUrl}">${displayName}</a>`;
    
    // Determine status prefix
    let statusPrefix = '💥'; // Default for new incidents
    let statusText = '新障礙通報';
    
    if (announcement.isResolved) {
      statusPrefix = '✅';
      statusText = '障礙已排除';
    }
    
    let message = `<b>${statusPrefix} ${serviceLink} | ${statusText}</b>\n\n`;
    message += `<b>${announcement.title}</b>\n`;
    
    if (announcement.content) {
      message += `\n${announcement.content}\n`;
    }
    
    if (announcement.isResolved && announcement.resolved_at) {
      // Format the resolved date a bit nicely if possible, or just raw
      const d = new Date(announcement.resolved_at);
      const dateStr = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
      message += `\n📅 排除時間: ${dateStr}`;
    } else if (announcement.create_date) {
      const d = new Date(announcement.create_date);
      const dateStr = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
      message += `\n📅發生時間: ${dateStr}`;
    }
    
    message += `\n🔗 <a href="${siteUrl}">查看詳情</a>`;
    
    return message;
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
