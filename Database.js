class Database {
  constructor(sheetId) {
    this.sheetId = sheetId;
    this.sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
  }

  getServiceData(serviceName) {
    const data = this.sheet.getDataRange().getValues();
    
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === serviceName) {
        try {
          return JSON.parse(data[i][1] || '{}');
        } catch (e) {
          Logger.log(`Error parsing data for ${serviceName}: ${e.message}`);
          return {};
        }
      }
    }
    
    return null;
  }

  setServiceData(serviceName, newIds, pruneSeparator) {
    const data = this.sheet.getDataRange().getValues();
    let rowIndex = -1;
    
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === serviceName) {
        rowIndex = i + 1;
        break;
      }
    }
    
    let existingData = {};
    if (rowIndex > 0) {
      try {
        existingData = JSON.parse(data[rowIndex - 1][1] || '{}');
      } catch (e) {
        Logger.log(`Error parsing existing data for ${serviceName}: ${e.message}`);
      }
    }
    
    // Pruning logic
    if (pruneSeparator) {
      for (const newId of Object.keys(newIds)) {
        // newId format assumed: PREFIX_STATUS or PREFIX
        const idParts = newId.split(pruneSeparator);
        // If ID doesn't contain separator, perform exact match check on existing
        // If ID contains separator, the prefix is the first part
        const prefix = idParts[0];
        
        // Remove existing keys that match the prefix
        for (const existingId of Object.keys(existingData)) {
          // Check for exact prefix match (e.g. 'c81e7' existing when 'c81e7_resolved' new comes in)
          if (existingId === prefix) {
            delete existingData[existingId];
            continue;
          }
          
          // Check for prefix + separator match (e.g. 'case1_dispatch' existing when 'case1_arrived' new comes in)
          if (existingId.startsWith(prefix + pruneSeparator)) {
            delete existingData[existingId];
            continue;
          }
        }
      }
    }
    
    for (const [id, date] of Object.entries(newIds)) {
      existingData[id] = date;
    }
    
    const entries = Object.entries(existingData);
    if (entries.length > 100) {
      entries.sort((a, b) => new Date(b[1]) - new Date(a[1]));
      existingData = Object.fromEntries(entries.slice(0, 100));
    }
    
    const jsonData = JSON.stringify(existingData);
    
    if (rowIndex > 0) {
      this.sheet.getRange(rowIndex, 2).setValue(jsonData);
    } else {
      this.sheet.appendRow([serviceName, jsonData]);
    }
  }

  skipService(serviceName, ids) {
    const skipData = {};
    const now = new Date().toISOString();
    
    for (const id of ids) {
      skipData[id] = now;
    }
    
    this.setServiceData(serviceName, skipData);
  }

  skipServiceFreq(serviceName, ids, pruneSeparator) {
    const data = this.sheet.getDataRange().getValues();
    let rowIndex = -1;
    
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === serviceName) {
        rowIndex = i + 1;
        break;
      }
    }
    
    let existingData = {};
    if (rowIndex > 0) {
      try {
        existingData = JSON.parse(data[rowIndex - 1][1] || '{}');
      } catch (e) {
        Logger.log(`Error parsing existing data for ${serviceName}: ${e.message}`);
      }
    }
    
    const now = new Date().toISOString();
    
    for (const id of ids) {
      let messageId = 0; // Default to 0 for new items
      
      // Check for exact match
      if (existingData[id]) {
         const existing = existingData[id];
         // Preserve existing messageId if object
         if (typeof existing === 'object' && existing.messageId) {
           messageId = existing.messageId;
         }
      } else if (pruneSeparator) {
        // Check for prefix match to inherit message ID from previous status
        // and prune the old status key
        const idParts = id.split(pruneSeparator);
        const prefix = idParts[0];
        
        for (const existingId of Object.keys(existingData)) {
          if (existingId === prefix || existingId.startsWith(prefix + pruneSeparator)) {
             const existing = existingData[existingId];
             if (typeof existing === 'object' && existing.messageId) {
               messageId = existing.messageId;
             }
             // Prune the old key as we are updating it to the new status
             delete existingData[existingId];
             // We found the match, so we can stop searching for this prefix
             // (Assuming only one active status per event)
             break; 
          }
        }
      }
      
      // Set the new data
      existingData[id] = {
        date: now,
        messageId: messageId
      };
    }
    
    // Cleanup/Prune logic for size (same as standard set)
    const entries = Object.entries(existingData);
    if (entries.length > 100) {
      entries.sort((a, b) => {
        const dateA = typeof a[1] === 'object' ? a[1].date : a[1];
        const dateB = typeof b[1] === 'object' ? b[1].date : b[1];
        return new Date(dateB) - new Date(dateA);
      });
      existingData = Object.fromEntries(entries.slice(0, 100));
    }
    
    const jsonData = JSON.stringify(existingData);
    
    if (rowIndex > 0) {
      this.sheet.getRange(rowIndex, 2).setValue(jsonData);
    } else {
      this.sheet.appendRow([serviceName, jsonData]);
    }
  }

  hasId(serviceName, id) {
    const data = this.getServiceData(serviceName);
    if (data === null) {
      return false;
    }
    return id in data;
  }

  getMessageId(serviceName, idPrefix) {
    const data = this.getServiceData(serviceName);
    if (data === null) {
      return null;
    }
    
    // Search for any key that starts with the prefix
    for (const key in data) {
      if (key.startsWith(idPrefix)) {
        const value = data[key];
        // New format: { date: "...", messageId: 123 }
        if (typeof value === 'object' && value.messageId) {
          return value.messageId;
        }
        // Old format: just a string (no messageId)
        return null;
      }
    }
    
    return null;
  }

  setServiceDataWithMessage(serviceName, id, date, messageId, pruneSeparator) {
    const data = this.sheet.getDataRange().getValues();
    let rowIndex = -1;
    
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === serviceName) {
        rowIndex = i + 1;
        break;
      }
    }
    
    let existingData = {};
    if (rowIndex > 0) {
      try {
        existingData = JSON.parse(data[rowIndex - 1][1] || '{}');
      } catch (e) {
        Logger.log(`Error parsing existing data for ${serviceName}: ${e.message}`);
      }
    }
    
    // Pruning logic (same as setServiceData)
    if (pruneSeparator) {
      const idParts = id.split(pruneSeparator);
      const prefix = idParts[0];
      
      // Remove existing keys that match the prefix
      for (const existingId of Object.keys(existingData)) {
        // Check for exact prefix match
        if (existingId === prefix) {
          delete existingData[existingId];
          continue;
        }
        
        // Check for prefix + separator match
        if (existingId.startsWith(prefix + pruneSeparator)) {
          delete existingData[existingId];
          continue;
        }
      }
    }
    
    // Store in new format
    existingData[id] = {
      date: date,
      messageId: messageId
    };
    
    const entries = Object.entries(existingData);
    if (entries.length > 100) {
      // Sort by date (handle both old and new formats)
      entries.sort((a, b) => {
        const dateA = typeof a[1] === 'object' ? a[1].date : a[1];
        const dateB = typeof b[1] === 'object' ? b[1].date : b[1];
        return new Date(dateB) - new Date(dateA);
      });
      existingData = Object.fromEntries(entries.slice(0, 100));
    }
    
    const jsonData = JSON.stringify(existingData);
    
    if (rowIndex > 0) {
      this.sheet.getRange(rowIndex, 2).setValue(jsonData);
    } else {
      this.sheet.appendRow([serviceName, jsonData]);
    }
  }
}
