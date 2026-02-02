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
    let text = html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .trim();
      
    // Decode HTML entities
    return text.replace(/&([a-zA-Z0-9#]+);/g, (match, entity) => {
      // Handle numeric entities
      if (entity.startsWith('#')) {
        const code = entity.charAt(1).toLowerCase() === 'x' 
          ? parseInt(entity.substring(2), 16) 
          : parseInt(entity.substring(1), 10);
        return String.fromCharCode(code);
      }
      
      // Handle named entities
      const entities = {
        'nbps': ' ', // typo tolerance if needed, but standard is nbsp
        'nbsp': ' ',
        'amp': '&',
        'lt': '<',
        'gt': '>',
        'quot': '"',
        'apos': "'",
        'rdquo': '”',
        'ldquo': '“',
        'rsquo': '’',
        'lsquo': '‘',
        'ndash': '–',
        'mdash': '—',
        'hellip': '…',
        'copy': '©',
        'reg': '®',
        'trade': '™',
        'deg': '°'
      };
      
      return entities[entity] || match;
    });
  }
}
