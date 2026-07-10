const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  logout: () => ipcRenderer.invoke('auth:logout'),
  register: (userData) => ipcRenderer.invoke('auth:register', userData),

  getIndustryTypes: () => ipcRenderer.invoke('industry:getTypes'),
  getApplicableAct: (type) => ipcRenderer.invoke('industry:getApplicableAct', type),

  getChecklistByAct: (actId) => ipcRenderer.invoke('checklist:getByAct', actId),
  getChecklistByCategory: (actId, category) => ipcRenderer.invoke('checklist:getByCategory', { actId, category }),

  createClient: (data) => ipcRenderer.invoke('client:create', data),
  searchClients: (term) => ipcRenderer.invoke('client:search', term),
  getAllClients: () => ipcRenderer.invoke('client:getAll'),

  getAvailableMembers: () => ipcRenderer.invoke('team:getAvailableMembers'),
  getMemberWorkload: (id) => ipcRenderer.invoke('team:getMemberWorkload', id),
  optimizeAllocation: (auditId, skills) => ipcRenderer.invoke('team:optimizeAllocation', { auditId, requiredSkills: skills }),

  createAuditPlan: (data) => ipcRenderer.invoke('audit:createPlan', data),
  generateAuditProgram: (id) => ipcRenderer.invoke('audit:generateProgram', id),
  getAuditMilestones: (id) => ipcRenderer.invoke('audit:getMilestones', id),

  exportWord: (auditId) => ipcRenderer.invoke('report:exportWord', auditId),
  exportPDF: (auditId) => ipcRenderer.invoke('report:exportPDF', auditId)
});
