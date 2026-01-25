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
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
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
}
