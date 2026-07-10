// preload.js - Secure bridge between renderer and main process
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Auth
  login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  logout: (userId) => ipcRenderer.invoke('auth:logout', userId),
  register: (userData) => ipcRenderer.invoke('auth:register', userData),
  
  // Industry
  getIndustryTypes: () => ipcRenderer.invoke('industry:getTypes'),
  getApplicableAct: (type) => ipcRenderer.invoke('industry:getApplicableAct', type),
  
  // Checklist
  getChecklistByAct: (actId) => ipcRenderer.invoke('checklist:getByAct', actId),
  getChecklistByCategory: (actId, category) => ipcRenderer.invoke('checklist:getByCategory', { actId, category }),
  
  // Clients
  createClient: (data) => ipcRenderer.invoke('client:create', data),
  searchClients: (term) => ipcRenderer.invoke('client:search', term),
  getAllClients: () => ipcRenderer.invoke('client:getAll'),
  
  // Team
  getAvailableMembers: () => ipcRenderer.invoke('team:getAvailableMembers'),
  getMemberWorkload: (id) => ipcRenderer.invoke('team:getMemberWorkload', id),
  optimizeAllocation: (auditId, skills) => ipcRenderer.invoke('team:optimizeAllocation', { auditId, requiredSkills: skills }),
  
  // Audit
  createAuditPlan: (data) => ipcRenderer.invoke('audit:createPlan', data),
  generateAuditProgram: (id) => ipcRenderer.invoke('audit:generateProgram', id),
  getAuditMilestones: (id) => ipcRenderer.invoke('audit:getMilestones', id),
  
  // Reports
  exportWord: (auditId) => ipcRenderer.invoke('report:exportWord', auditId),
  exportPDF: (auditId) => ipcRenderer.invoke('report:exportPDF', auditId)
});