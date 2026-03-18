class Telegram {
  constructor(botToken, chatId) {
    this.botToken = botToken;
    this.chatId = chatId;
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
  }

  sendMessage(text, messageThreadId = null) {
    const payload = {
      chat_id: this.chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };
    
    if (messageThreadId) {
      payload.message_thread_id = messageThreadId;
    }
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    try {
      const response = UrlFetchApp.fetch(`${this.baseUrl}/sendMessage`, options);
      const result = JSON.parse(response.getContentText());
      
      if (!result.ok) {
        Logger.log(`Telegram sendMessage error: ${result.description}`);
        return null;
      }
      
      return result.result;
    } catch (e) {
      Logger.log(`Telegram sendMessage exception: ${e.message}`);
      return null;
    }
  }

  sendPhoto(photoUrl, caption = '', messageThreadId = null) {
    const payload = {
      chat_id: this.chatId,
      photo: photoUrl,
      caption: caption,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };
    
    if (messageThreadId) {
      payload.message_thread_id = messageThreadId;
    }
    
    let options = {};
    if (typeof photoUrl === 'object' && photoUrl.toString() === 'Blob') {
       // It's a Blob object. Apps Script UrlFetchApp automatically handles 
       // multipart/form-data when payload is an Object (not stringified).
       payload.photo = photoUrl;
       options = {
         method: 'post',
         payload: payload,
         muteHttpExceptions: true
       };
    } else {
       options = {
         method: 'post',
         contentType: 'application/json',
         payload: JSON.stringify(payload),
         muteHttpExceptions: true
       };
    }
    
    try {
      const response = UrlFetchApp.fetch(`${this.baseUrl}/sendPhoto`, options);
      const result = JSON.parse(response.getContentText());
      
      if (!result.ok) {
        Logger.log(`Telegram sendPhoto error: ${result.description}`);
        return null;
      }
      
      return result.result;
    } catch (e) {
      Logger.log(`Telegram sendPhoto exception: ${e.message}`);
      return null;
    }
  }

  sendDocument(documentUrl, caption = '', messageThreadId = null) {
    const payload = {
      chat_id: this.chatId,
      document: documentUrl,
      caption: caption,
      parse_mode: 'HTML'
    };
    
    if (messageThreadId) {
      payload.message_thread_id = messageThreadId;
    }
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    try {
      const response = UrlFetchApp.fetch(`${this.baseUrl}/sendDocument`, options);
      const result = JSON.parse(response.getContentText());
      
      if (!result.ok) {
        Logger.log(`Telegram sendDocument error: ${result.description}`);
        return null;
      }
      
      return result.result;
    } catch (e) {
      Logger.log(`Telegram sendDocument exception: ${e.message}`);
      return null;
    }
  }

  sendMediaGroup(mediaUrls, caption = '', messageThreadId = null) {
    if (!mediaUrls || mediaUrls.length === 0) {
      return null;
    }
    
    let hasBlob = false;
    const media = mediaUrls.map((url, index) => {
      let itemMedia = url;
      if (typeof url === 'object' && url.toString() === 'Blob') {
        hasBlob = true;
        // attach name will reference the multipart field
        const attachName = `attach_photo_${index}`;
        itemMedia = `attach://${attachName}`;
      }
      
      const item = {
        type: 'photo',
        media: itemMedia
      };
      if (index === 0 && caption) {
        item.caption = caption;
        item.parse_mode = 'HTML';
      }
      return item;
    });
    
    let payload = {};
    let options = {};
    
    if (hasBlob) {
      payload.chat_id = this.chatId;
      if (messageThreadId) {
         payload.message_thread_id = messageThreadId;
      }
      // Stringify the media json array
      payload.media = JSON.stringify(media);
      
      // Inject blobs into payload
      mediaUrls.forEach((url, index) => {
         if (typeof url === 'object' && url.toString() === 'Blob') {
            payload[`attach_photo_${index}`] = url;
         }
      });
      options = {
         method: 'post',
         payload: payload,
         muteHttpExceptions: true
      };
    } else {
      payload = {
        chat_id: this.chatId,
        media: media
      };
      if (messageThreadId) {
        payload.message_thread_id = messageThreadId;
      }
      options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };
    }
    
    try {
      const response = UrlFetchApp.fetch(`${this.baseUrl}/sendMediaGroup`, options);
      const result = JSON.parse(response.getContentText());
      
      if (!result.ok) {
        Logger.log(`Telegram sendMediaGroup error: ${result.description}`);
        return null;
      }
      
      return result.result;
    } catch (e) {
      Logger.log(`Telegram sendMediaGroup exception: ${e.message}`);
      return null;
    }
  }

  editMessageText(messageId, text) {
    const payload = {
      chat_id: this.chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    try {
      const response = UrlFetchApp.fetch(`${this.baseUrl}/editMessageText`, options);
      const result = JSON.parse(response.getContentText());
      
      if (!result.ok) {
        Logger.log(`Telegram editMessageText error: ${result.description}`);
        return null;
      }
      
      return result.result;
    } catch (e) {
      Logger.log(`Telegram editMessageText exception: ${e.message}`);
      return null;
    }
  }
}
