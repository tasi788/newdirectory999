class ServiceInterface {
  constructor(serviceName) {
    this.serviceName = serviceName;
  }

  fetch() {
    throw new Error('fetch() method must be implemented by subclass');
  }

  skip() {
    throw new Error('skip() method must be implemented by subclass');
  }

  formatAnnouncement(data) {
    return {
      title: this.escapeHtml(data.title || ''),
      content: this.escapeHtml(data.content || ''),
      poster: data.poster || '',
      create_date: data.create_date || null,
      service: this.serviceName,
      url: data.url || '',
      id: data.id || ''
    };
  }

  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  buildMessage(announcement, serviceConfig) {
    const displayName = serviceConfig.displayName || announcement.service.toUpperCase();
    const serviceUrl = serviceConfig.url || '';
    
    let serviceName = displayName;
    if (serviceUrl) {
      serviceName = `<a href="${serviceUrl}">${displayName}</a>`;
    }
    
    let message = `<b>📢 ${serviceName} | ${announcement.title}</b>\n`;
    
    const content = announcement.content ? announcement.content.trim() : '';
    if (content) {
      if (content.length > 250) {
        message += `\n<blockquote expandable>${content}</blockquote>\n`;
      } else {
        message += `\n${content}\n`;
      }
    }
    
    if (announcement.create_date) {
      message += `\n📅 發布日期: ${announcement.create_date}`;
    }
    
    if (announcement.url) {
      message += `\n🔗 <a href="${announcement.url}">查看詳情</a>`;
    }
    
    return message;
  }

  stripHtml(html) {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
