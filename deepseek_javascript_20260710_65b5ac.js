// main.js - Electron Main Process
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
    title: 'Audit Planning Assistant',
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  
  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(async () => {
  // Initialize database
  await initDatabase();
  
  // Create main window
  createWindow();

  // Register IPC handlers
  registerIpcHandlers();

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
  // ============ AUTHENTICATION HANDLERS ============
  ipcMain.handle('auth:login', async (event, { username, password }) => {
    return await authService.login(username, password);
  });

  ipcMain.handle('auth:logout', async (event, userId) => {
    return await authService.logout(userId);
  });

  ipcMain.handle('auth:register', async (event, userData) => {
    return await authService.registerUser(userData);
  });

  // ============ INDUSTRY & ACT HANDLERS ============
  ipcMain.handle('industry:getTypes', async () => {
    return await industryService.getIndustryTypes();
  });

  ipcMain.handle('industry:getApplicableAct', async (event, industryType) => {
    return await industryService.getApplicableAct(industryType);
  });

  // ============ CHECKLIST HANDLERS ============
  ipcMain.handle('checklist:getByAct', async (event, actId) => {
    return await checklistService.getChecklistByAct(actId);
  });

  ipcMain.handle('checklist:getByCategory', async (event, { actId, category }) => {
    return await checklistService.getChecklistByCategory(actId, category);
  });

  // ============ CLIENT HANDLERS ============
  ipcMain.handle('client:create', async (event, clientData) => {
    return await clientService.createClient(clientData);
  });

  ipcMain.handle('client:search', async (event, searchTerm) => {
    return await clientService.searchClients(searchTerm);
  });

  ipcMain.handle('client:getAll', async () => {
    return await clientService.getAllClients();
  });

  // ============ TEAM HANDLERS ============
  ipcMain.handle('team:getAvailableMembers', async () => {
    return await teamService.getAvailableMembers();
  });

  ipcMain.handle('team:getMemberWorkload', async (event, memberId) => {
    return await teamService.getMemberWorkload(memberId);
  });

  ipcMain.handle('team:optimizeAllocation', async (event, { auditId, requiredSkills }) => {
    return await teamService.optimizeTeamAllocation(auditId, requiredSkills);
  });

  // ============ AUDIT HANDLERS ============
  ipcMain.handle('audit:createPlan', async (event, auditData) => {
    return await auditService.createAuditPlan(auditData);
  });

  ipcMain.handle('audit:generateProgram', async (event, auditId) => {
    return await auditService.generateAuditProgram(auditId);
  });

  ipcMain.handle('audit:getMilestones', async (event, auditId) => {
    return await auditService.getAuditMilestones(auditId);
  });

  // ============ REPORT HANDLERS ============
  ipcMain.handle('report:exportWord', async (event, auditId) => {
    const result = await dialog.showSaveDialog({
      filters: [{ name: 'Word Document', extensions: ['docx'] }]
    });
    if (!result.canceled) {
      return await reportService.exportToWord(auditId, result.filePath);
    }
    return { success: false, message: 'Export cancelled' };
  });

  ipcMain.handle('report:exportPDF', async (event, auditId) => {
    const result = await dialog.showSaveDialog({
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
    });
    if (!result.canceled) {
      return await reportService.exportToPDF(auditId, result.filePath);
    }
    return { success: false, message: 'Export cancelled' };
  });
}