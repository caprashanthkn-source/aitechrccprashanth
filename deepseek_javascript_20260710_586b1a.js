// services/auditService.js - Audit plan and program generation
const { getDatabase } = require('../database/dbInit');

class AuditService {
  async createAuditPlan(auditData) {
    const db = getDatabase();
    
    try {
      const {
        clientId, auditTitle, industryId, applicableActId,
        financialYear, annualTurnover, riskAreas,
        startDate, endDate, createdBy
      } = auditData;
      
      // Calculate total planned hours based on turnover and risk areas
      const baseHours = this.calculateBaseHours(annualTurnover);
      const riskMultiplier = this.calculateRiskMultiplier(riskAreas);
      const totalPlannedHours = Math.round(baseHours * riskMultiplier);
      
      // Insert audit record
      const result = db.prepare(`
        INSERT INTO audits (
          client_id, audit_title, industry_id, applicable_act_id,
          financial_year, annual_turnover, risk_areas,
          audit_start_date, audit_end_date, total_planned_hours,
          created_by, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Planned')
      `).run(
        clientId, auditTitle, industryId, applicableActId,
        financialYear, annualTurnover, JSON.stringify(riskAreas),
        startDate, endDate, totalPlannedHours, createdBy
      );
      
      const auditId = result.lastInsertRowid;
      
      // Generate milestones
      await this.generateMilestones(auditId, startDate, endDate);
      
      return {
        success: true,
        auditId,
        totalPlannedHours,
        message: 'Audit plan created successfully'
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  calculateBaseHours(annualTurnover) {
    if (annualTurnover <= 10000000) return 60;    // Up to 1 Cr
    if (annualTurnover <= 50000000) return 80;    // Up to 5 Cr
    if (annualTurnover <= 250000000) return 120;  // Up to 25 Cr
    if (annualTurnover <= 1000000000) return 160; // Up to 100 Cr
    return 200; // Above 100 Cr
  }

  calculateRiskMultiplier(riskAreas) {
    const riskWeights = {
      'Financial': 1.2,
      'Operational': 1.1,
      'Compliance': 1.15,
      'Strategic': 1.05
    };
    
    let multiplier = 1.0;
    for (const risk of riskAreas) {
      multiplier *= (riskWeights[risk] || 1.0);
    }
    
    return Math.min(multiplier, 2.0); // Cap at 2x
  }

  async generateMilestones(auditId, startDate, endDate) {
    const db = getDatabase();
    const duration = (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24);
    const quarterDuration = Math.floor(duration / 5);
    
    const milestones = [
      {
        name: 'Planning and Risk Assessment',
        description: 'Initial planning, risk assessment, and team briefing',
        daysOffset: 0,
        durationPercent: 15
      },
      {
        name: 'Preliminary Review',
        description: 'Review of internal controls and preliminary testing',
        daysOffset: 1,
        durationPercent: 20
      },
      {
        name: 'Field Work - Phase 1',
        description: 'Detailed testing of financial and operational areas',
        daysOffset: 1.5,
        durationPercent: 25
      },
      {
        name: 'Field Work - Phase 2',
        description: 'Compliance testing and management interviews',
        daysOffset: 2.5,
        durationPercent: 20
      },
      {
        name: 'Review and Reporting',
        description: 'Findings review, management discussion, and report preparation',
        daysOffset: 3.5,
        durationPercent: 20
      }
    ];
    
    const insertMilestone = db.prepare(`
      INSERT INTO audit_milestones (audit_id, milestone_name, description, start_date, end_date, completion_percentage)
      VALUES (?, ?, ?, ?, ?, 0)
    `);
    
    const transaction = db.transaction(() => {
      for (const milestone of milestones) {
        const milestoneStart = new Date(startDate);
        milestoneStart.setDate(milestoneStart.getDate() + Math.floor(duration * milestone.daysOffset / 5));
        
        const milestoneEnd = new Date(milestoneStart);
        milestoneEnd.setDate(milestoneEnd.getDate() + Math.floor(duration * milestone.durationPercent / 100));
        
        insertMilestone.run(
          auditId,
          milestone.name,
          milestone.description,
          milestoneStart.toISOString().split('T')[0],
          milestoneEnd.toISOString().split('T')[0]
        );
      }
    });
    
    transaction();
  }

  async generateAuditProgram(auditId) {
    const db = getDatabase();
    
    try {
      const audit = db.prepare(`
        SELECT a.*, i.industry_name, ra.act_name 
        FROM audits a 
        JOIN industries i ON a.industry_id = i.industry_id 
        JOIN regulatory_acts ra ON a.applicable_act_id = ra.act_id 
        WHERE a.audit_id = ?
      `).get(auditId);
      
      if (!audit) {
        return { success: false, message: 'Audit not found' };
      }
      
      // Get checklist items based on applicable act and risk areas
      const riskAreas = JSON.parse(audit.risk_areas || '["Financial", "Operational", "Compliance", "Strategic"]');
      
      const checklistItems = db.prepare(`
        SELECT * FROM checklist_items 
        WHERE act_id = ? AND checklist_category IN (${riskAreas.map(() => '?').join(',')})
        ORDER BY checklist_category, risk_weight DESC, sort_order
      `).all(audit.applicable_act_id, ...riskAreas);
      
      // Generate audit procedures
      const insertProcedure = db.prepare(`
        INSERT INTO audit_procedures (
          audit_id, checklist_item_id, procedure_description,
          sampling_methodology, sample_size, risk_assessment, planned_hours
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      // Get team allocations for assignment
      const allocations = db.prepare('SELECT * FROM team_allocations WHERE audit_id = ?').all(auditId);
      let allocationIndex = 0;
      
      const procedures = [];
      
      const transaction = db.transaction(() => {
        for (const item of checklistItems) {
          // Determine sampling methodology based on category and risk
          const sampling = this.determineSampling(item.checklist_category, item.risk_weight);
          
          // Calculate planned hours based on risk weight
          const plannedHours = Math.round(item.risk_weight * 2 * 10) / 10;
          
          // Assign to team member (round-robin)
          const assignedTo = allocations.length > 0 ? allocations[allocationIndex % allocations.length].member_id : null;
          allocationIndex++;
          
          const procedureDesc = this.generateProcedureDescription(item, audit);
          
          insertProcedure.run(
            auditId,
            item.item_id,
            procedureDesc,
            sampling.methodology,
            sampling.sampleSize,
            this.getRiskLevel(item.risk_weight),
            plannedHours
          );
          
          procedures.push({
            itemId: item.item_id,
            description: procedureDesc,
            sampling: sampling.methodology,
            sampleSize: sampling.sampleSize,
            riskLevel: this.getRiskLevel(item.risk_weight),
            plannedHours,
            assignedTo
          });
        }
      });
      
      transaction();
      
      return {
        success: true,
        data: {
          auditTitle: audit.audit_title,
          actName: audit.act_name,
          industryName: audit.industry_name,
          totalProcedures: procedures.length,
          procedures
        }
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  determineSampling(category, riskWeight) {
    if (riskWeight >= 2.0) {
      return { methodology: '100% Verification', sampleSize: 100 };
    } else if (riskWeight >= 1.5) {
      return { methodology: 'Statistical Sampling (95% confidence)', sampleSize: 50 };
    } else {
      return { methodology: 'Random Sampling', sampleSize: 25 };
    }
  }

  getRiskLevel(riskWeight) {
    if (riskWeight >= 2.0) return 'Critical';
    if (riskWeight >= 1.5) return 'High';
    if (riskWeight >= 1.0) return 'Medium';
    return 'Low';
  }

  generateProcedureDescription(checklistItem, audit) {
    const descriptions = {
      'Financial': `Perform detailed financial verification of ${checklistItem.item_description} for ${audit.financial_year}. Review supporting documents, ledgers, and reconciliations. Verify compliance with ${audit.act_name}.`,
      'Operational': `Review operational processes related to ${checklistItem.item_description}. Conduct walkthrough tests, examine process documentation, and verify internal controls.`,
      'Compliance': `Verify compliance with ${checklistItem.item_description} as per ${audit.act_name}, Section ${checklistItem.section_reference || 'applicable provisions'}. Review regulatory filings and correspondence.`,
      'Strategic': `Evaluate strategic implications of ${checklistItem.item_description}. Assess business impact, management approach, and alignment with organizational objectives.`
    };
    
    return descriptions[checklistItem.checklist_category] || `Review ${checklistItem.item_description} as per audit requirements.`;
  }

  async getAuditMilestones(auditId) {
    const db = getDatabase();
    
    try {
      const milestones = db.prepare(`
        SELECT am.*, tm.full_name as responsible_name 
        FROM audit_milestones am 
        LEFT JOIN team_members tm ON am.responsible_member_id = tm.member_id 
        WHERE am.audit_id = ? 
        ORDER BY am.start_date
      `).all(auditId);
      
      return { success: true, data: milestones };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = new AuditService();