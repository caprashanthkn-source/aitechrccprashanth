const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { initDatabase } = require('./database/dbInit');
const authService = require('./services/authService');
const clientService = require('./services/clientService');
const industryService = require('./services/industryService');
const checklistService = require('./services/checklistService');
const teamService = require('./services/teamService');
const auditService = require('./services/auditService');
const reportService = require('./services/reportService');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'Audit Planning Assistant'
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(async () => {
  try {
    await initDatabase();
    createWindow();
    registerIpcHandlers();
  } catch (error) {
    console.error('Failed to start application:', error);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function registerIpcHandlers() {
  ipcMain.handle('auth:login', async (_event, credentials) => {
    try {
      return await authService.login(credentials.username, credentials.password);
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('auth:logout', async () => ({ success: true }));

  ipcMain.handle('auth:register', async (_event, userData) => {
    try {
      return await authService.registerUser(userData);
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('industry:getTypes', async () => {
    try {
      return await industryService.getIndustryTypes();
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('industry:getApplicableAct', async (_event, industryType) => {
    try {
      return await industryService.getApplicableAct(industryType);
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('checklist:getByAct', async (_event, actId) => {
    try {
      return await checklistService.getChecklistByAct(actId);
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('checklist:getByCategory', async (_event, { actId, category }) => {
    try {
      return await checklistService.getChecklistByCategory(actId, category);
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('client:create', async (_event, clientData) => {
    try {
      return await clientService.createClient(clientData);
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('client:search', async (_event, searchTerm) => {
    try {
      return await clientService.searchClients(searchTerm);
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('client:getAll', async () => {
    try {
      return await clientService.getAllClients();
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('team:getAvailableMembers', async () => {
    try {
      return await teamService.getAvailableMembers();
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('team:getMemberWorkload', async (_event, memberId) => {
    try {
      return await teamService.getMemberWorkload(memberId);
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('team:optimizeAllocation', async (_event, { auditId, requiredSkills }) => {
    try {
      return await teamService.optimizeTeamAllocation(auditId, requiredSkills);
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('audit:createPlan', async (_event, auditData) => {
    try {
      return await auditService.createAuditPlan(auditData);
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('audit:generateProgram', async (_event, auditId) => {
    try {
      return await auditService.generateAuditProgram(auditId);
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('audit:getMilestones', async (_event, auditId) => {
    try {
      return await auditService.getAuditMilestones(auditId);
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('report:exportWord', async (_event, auditId) => {
    try {
      const result = await dialog.showSaveDialog({
        filters: [{ name: 'Word Document', extensions: ['docx'] }]
      });
      if (result.canceled) {
        return { success: false, message: 'Export cancelled' };
      }
      return await reportService.exportToWord(auditId, result.filePath);
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('report:exportPDF', async (_event, auditId) => {
    try {
      const result = await dialog.showSaveDialog({
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
      });
      if (result.canceled) {
        return { success: false, message: 'Export cancelled' };
      }
      return await reportService.exportToPDF(auditId, result.filePath);
    } catch (error) {
      return { success: false, message: error.message };
    }
  });
}
