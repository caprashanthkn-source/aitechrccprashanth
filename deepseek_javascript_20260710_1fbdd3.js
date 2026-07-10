// services/industryService.js - Industry and Act mapping service
const { getDatabase } = require('../database/dbInit');

class IndustryService {
  async getIndustryTypes() {
    const db = getDatabase();
    
    try {
      const industries = db.prepare(`
        SELECT i.*, ra.act_name, ra.act_code 
        FROM industries i 
        LEFT JOIN regulatory_acts ra ON i.applicable_act_id = ra.act_id 
        ORDER BY i.industry_type, i.industry_name
      `).all();
      
      return { success: true, data: industries };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getApplicableAct(industryType) {
    const db = getDatabase();
    
    try {
      const acts = db.prepare(`
        SELECT DISTINCT ra.* 
        FROM industries i 
        JOIN regulatory_acts ra ON i.applicable_act_id = ra.act_id 
        WHERE i.industry_type = ?
      `).all(industryType);
      
      return { success: true, data: acts };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getIndustryById(industryId) {
    const db = getDatabase();
    
    try {
      const industry = db.prepare(`
        SELECT i.*, ra.act_name, ra.act_code 
        FROM industries i 
        LEFT JOIN regulatory_acts ra ON i.applicable_act_id = ra.act_id 
        WHERE i.industry_id = ?
      `).get(industryId);
      
      return { success: true, data: industry };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = new IndustryService();