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

  setServiceData(serviceName, newIds) {
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

  hasId(serviceName, id) {
    const data = this.getServiceData(serviceName);
    if (data === null) {
      return false;
    }
    return id in data;
  }
}
