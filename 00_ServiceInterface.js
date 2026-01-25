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
      title: data.title || '',
      content: data.content || '',
      poster: data.poster || '',
      create_date: data.create_date || null,
      service: this.serviceName,
      url: data.url || '',
      id: data.id || ''
    };
  }

  buildMessage(announcement, serviceConfig) {
    const displayName = serviceConfig.displayName || announcement.service.toUpperCase();
    const serviceUrl = serviceConfig.url || '';
    
    let serviceName = displayName;
    if (serviceUrl) {
      serviceName = `<a href="${serviceUrl}">${displayName}</a>`;
    }
    
    let message = `<b>📢 ${serviceName} | ${announcement.title}</b>\n\n`;
    message += `${announcement.content}\n`;
    
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
