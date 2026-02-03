class TccfdService extends ServiceInterface {
  constructor() {
    super('tccfd');
    this.apiUrl = 'https://www.fire.taichung.gov.tw/caselist/index.asp?Parser=99,8,226,,,,,,,,1';
  }

  fetch() {
    try {
      const response = UrlFetchApp.fetch(this.apiUrl, {
        muteHttpExceptions: true
      });
      
      const html = response.getContentText('UTF-8');
      const announcements = [];
      
      // Match <li> blocks that contain incident data
      // Structure is unique enough that we can try to math each li
      const listRegex = /<ul class="list rwd-table">([\s\S]*?)<\/ul>/;
      const listMatch = listRegex.exec(html);
      
      if (!listMatch) {
        Logger.log('TCCFD list not found');
        return [];
      }
      
      const listContent = listMatch[1];
      const liRegex = /<li>([\s\S]*?)<\/li>/g;
      
      let liMatch;
      while ((liMatch = liRegex.exec(listContent)) !== null) {
        const rowHtml = liMatch[1];
        
        // Skip header row
        if (rowHtml.includes('list_head')) continue;
        
        // Extract fields using Regex
        const timeMatch = /data-th="受理時間：">([^<]+)</.exec(rowHtml);
        const typeMatch = /data-th="案類：">([^<]+)</.exec(rowHtml);
        const subtypeMatch = /data-th="案別">([^<]+)</.exec(rowHtml);
        
        // Location is tricky because it has a button inside
        // usually: data-th="發生地點：">Address \n <button...
        const locationMatch = /data-th="發生地點：">([\s\S]*?)<button/.exec(rowHtml);
        
        const unitMatch = /data-th="派遣分隊：">([^<]+)</.exec(rowHtml);
        const statusMatch = /data-th="執行狀況：">([^<]+)</.exec(rowHtml);
        
        if (!timeMatch || !typeMatch || !statusMatch) continue;
        
        const time = timeMatch[1].trim();
        const type = typeMatch[1].trim(); // 緊急救護
        const subtype = subtypeMatch ? subtypeMatch[1].trim() : ''; // 車禍, 急病...
        const location = locationMatch ? locationMatch[1].trim() : '';
        const unit = unitMatch ? unitMatch[1].trim() : '';
        const status = statusMatch[1].trim(); // 已到達, 送醫中...
        
        // Unique ID generation
        // Since there is no ID, we hash (Time + Type + Location)
        // This should be unique enough for concurrent events
        const uniqueString = `${time}${type}${location}`;
        const eventId = this.generateMD5(uniqueString);
        
        // Final ID includes status to allow "editing" logic to work (new status = same base ID, but handle status change?)
        // Wait, for 'message editing', we want the ID to be the SAME for the same event so we can find it in DB.
        // The service logic usually dedupes by ID. 
        // If we want to UPDATE the message, we need to return the SAME ID for the same event, 
        // but maybe the *content* changes?
        // 
        // Detailed Look at how `tpcfd.js` does it:
        // const id = `${prefix}_${status}`;
        // It appends status to ID. This means a NEW status = NEW ID = NEW Record in DB.
        // But `tpcfd` has `enableMessageEdit: true` in Config. 
        // If the system sees a new ID, it treats it as a new announcement.
        //
        // However, the USER request said: "Implement Message Editing... 2. For subsequent status updates... edit the original Telegram message".
        // If I change the ID, it won't be seen as the "same" event in a simple KV store unless there is logic to link them.
        // Let's check `tpcfd.js` again. 
        // It uses `id = prefix_status`. 
        // If `Config.js` has `enableMessageEdit: true`, there must be logic in the MAIN loop (probably `Worker.js` or similar, which I can't see but `tpcfd` implies it) 
        // that handles this. 
        //
        // WAIT. If `tpcfd` works by appending status to ID, then every status change is a NEW DB entry.
        // If the user wants to EDIT the message, the system needs to know "Old ID" vs "New ID" or link them.
        // OR, the "ID" returned by `fetch` should be the EVENT ID, and the "hash" or "status" is separate?
        // 
        // Let's look at `tpcfd.js` again.
        // 45:         const id = `${prefix}_${status}`;
        //
        // Keep in mind the user prompt in Step 1 said: "Implement Message Editing... edit the original Telegram message... opt-in via configuration".
        // This implies the core logic handles it. 
        // If `tpcfd` generates a NEW ID for every status, how does the system know it's the same event to EDIT?
        // 
        // Maybe I should NOT append status to the unique ID if I want message editing to work on the SAME message?
        // But if I don't append status, the ID is the same, so the system might think "Already Sent" and ignore it?
        //
        // A common pattern for "Stateful" alerts:
        // 1. ID = EventID (constant). Content includes Status.
        // 2. System sees ID exists. Checks if Content changed. If so, Edit.
        //
        // BUT `tpcfd.js` distinctly appends status: `const id = `${prefix}_${status}`;`
        // And `tncfd.js`: `const id = `${caseId}_${status}`;`
        // 
        // If the system is designed to use `enableMessageEdit`, maybe it expects `EventID_Status` format 
        // and strips the suffix? Or maybe it just expects `EventID` and the *service* provided code is flawed/legacy?
        // 
        // Let's re-read the User Request in this turn: "請仿造 @[service/tpcfd.js] 以及 @[service/tncfd.js]"
        // The user explicitly asked to "Imitate" them.
        // So I should follow their pattern: `ID = BaseID + "_" + Status`.
        // The underlying system likely handles the "Editing" by knowing how to parse this or via the `enableMessageEdit` flag doing some magic (maybe it looks for similar IDs?).
        // 
        // Actually, looking at `Config.js`:
        // 101:     enableMessageEdit: true
        // 109:     pruneSeparator: '_',
        //
        // Ah! `pruneSeparator: '_'` suggests that the system splits the ID by `_` to find the "Base ID" (Pruned ID).
        // If `Pruned ID` matches, it knows it's the same Event.
        // So `EventID_Status` IS the correct pattern.
        
        const id = `${eventId}_${status}`;
        
        const fullType = subtype ? `${type} - ${subtype}` : type;
        
        const announcement = this.formatAnnouncement({
          title: `${location} - ${fullType}`,
          content: `${unit} - ${status}`,
          poster: '',
          create_date: time,
          url: this.apiUrl,
          id: id
        });
        
        announcement.data = {
          time,
          type,
          subtype,
          location,
          unit,
          status,
          eventId
        };
        
        announcements.push(announcement);
      }
      
      return announcements.reverse(); // Newest first usually, but fetch returns HTML order. 
      // TCCFD HTML is likely Newest on Top. 
      // `tpcfd` sorts by date. 
      // `tncfd` reverses.
      // If HTML is Time Descending (Newest Top), and we want to process Oldest first (to send in order?), we should Reverse.
      // Standard is usually to process internal lists in Chronological Order (Old -> New) so notifications fire in order.
      // So Reverse is correct if HTML is Newest -> Oldest.
      
    } catch (e) {
      Logger.log(`Error fetching TCCFD announcements: ${e.message}`);
      return [];
    }
  }

  skip() {
    try {
      const announcements = this.fetch();
      return announcements.map(a => a.id);
    } catch (e) {
      Logger.log(`Error in TCCFD skip: ${e.message}`);
      return [];
    }
  }

  buildMessage(announcement, serviceConfig) {
    const data = announcement.data;
    if (!data) return `New Announcement: ${announcement.title}`;
    
    // Emojis
    let typeEmoji = '🚒';
    if (data.type.includes('救護') || data.subtype.includes('急病') || data.subtype.includes('路倒')) {
      typeEmoji = '🏥';
    }
    
    let statusEmoji = '';
    if (data.status.includes('出勤')) statusEmoji = '🚨';
    else if (data.status.includes('到達')) statusEmoji = '📍';
    else if (data.status.includes('離開') || data.status.includes('送醫')) statusEmoji = '🚑';
    else if (data.status.includes('返隊')) statusEmoji = '🏠';
    
    const displayName = serviceConfig.displayName || '台中消防出勤';
    // No specific detail page, just list
    const siteUrl = serviceConfig.url || this.apiUrl;
    
    // Map link
    const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("台中市" + data.location)}`;
    
    let message = `${typeEmoji} <a href="${siteUrl}">${displayName}</a> | ${data.status} ${statusEmoji}\n\n` +
           `📍 <a href="${mapLink}">${data.location}</a> (${data.type}/${data.subtype})\n` +
           `派遣分隊: ${data.unit}\n\n` +
           `受理時間: ${data.time}`;
           
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
