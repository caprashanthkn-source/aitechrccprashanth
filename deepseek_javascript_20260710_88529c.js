// services/checklistService.js - Dynamic checklist generation
const { getDatabase } = require('../database/dbInit');

class ChecklistService {
  async getChecklistByAct(actId) {
    const db = getDatabase();
    
    try {
      const checklist = db.prepare(`
        SELECT * FROM checklist_items 
        WHERE act_id = ? 
        ORDER BY checklist_category, sort_order
      `).all(actId);
      
      return { success: true, data: checklist };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getChecklistByCategory(actId, category) {
    const db = getDatabase();
    
    try {
      const checklist = db.prepare(`
        SELECT * FROM checklist_items 
        WHERE act_id = ? AND checklist_category = ? 
        ORDER BY sort_order
      `).all(actId, category);
      
      return { success: true, data: checklist };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getChecklistWithRiskAssessment(actId, riskAreas) {
    const db = getDatabase();
    
    try {
      // Parse risk areas JSON array
      const areas = JSON.parse(riskAreas || '["Financial", "Operational", "Compliance", "Strategic"]');
      
      const checklist = db.prepare(`
        SELECT * FROM checklist_items 
        WHERE act_id = ? AND checklist_category IN (${areas.map(() => '?').join(',')})
        ORDER BY 
          CASE 
            WHEN risk_weight >= 2.0 THEN 1 
            WHEN risk_weight >= 1.5 THEN 2 
            ELSE 3 
          END,
          sort_order
      `).all(actId, ...areas);
      
      return { success: true, data: checklist };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = new ChecklistService();