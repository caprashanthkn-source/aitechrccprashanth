// services/teamService.js - Team allocation optimization engine
const { getDatabase } = require('../database/dbInit');

class TeamService {
  async getAvailableMembers() {
    const db = getDatabase();
    
    try {
      const members = db.prepare(`
        SELECT *, 
          (max_capacity_hours - current_workload_hours) as available_hours 
        FROM team_members 
        WHERE is_available = 1 
        ORDER BY years_experience DESC
      `).all();
      
      return { success: true, data: members };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getMemberWorkload(memberId) {
    const db = getDatabase();
    
    try {
      const allocations = db.prepare(`
        SELECT ta.*, a.audit_title, a.audit_start_date, a.audit_end_date
        FROM team_allocations ta 
        JOIN audits a ON ta.audit_id = a.audit_id 
        WHERE ta.member_id = ? AND ta.status IN ('Planned', 'Active')
        ORDER BY ta.start_date
      `).all(memberId);
      
      return { success: true, data: allocations };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async optimizeTeamAllocation(auditId, requiredSkills) {
    const db = getDatabase();
    
    try {
      // Get audit details
      const audit = db.prepare('SELECT * FROM audits WHERE audit_id = ?').get(auditId);
      if (!audit) {
        return { success: false, message: 'Audit not found' };
      }

      // Parse required skills
      const skills = JSON.parse(requiredSkills || '["Financial Audit", "Tax Audit", "Compliance Audit"]');
      
      // Get available team members matching skills
      const members = db.prepare(`
        SELECT *,
          (max_capacity_hours - current_workload_hours) as available_hours
        FROM team_members 
        WHERE is_available = 1 
        ORDER BY 
          CASE 
            WHEN expertise_areas LIKE '%${skills[0]}%' THEN 1
            WHEN expertise_areas LIKE '%${skills[1] || 'General'}%' THEN 2
            ELSE 3 
          END,
          years_experience DESC
      `).all();
      
      if (members.length === 0) {
        return { success: false, message: 'No available team members' };
      }

      // Get total audit hours needed
      const totalProcedures = db.prepare(`
        SELECT SUM(planned_hours) as total_hours FROM audit_procedures WHERE audit_id = ?
      `).get(auditId);
      
      const totalHours = totalProcedures?.total_hours || audit.total_planned_hours || 80;
      
      // Allocation algorithm
      const allocations = [];
      let remainingHours = totalHours;
      let memberIndex = 0;
      
      // Allocate lead auditor (most experienced)
      const leadAuditor = members[0];
      const leadHours = Math.min(remainingHours * 0.3, leadAuditor.available_hours * 0.5);
      
      allocations.push({
        memberId: leadAuditor.member_id,
        fullName: leadAuditor.full_name,
        designation: leadAuditor.designation,
        roleAssigned: 'Lead Auditor',
        hoursAllocated: Math.round(leadHours * 10) / 10,
        expertise: JSON.parse(leadAuditor.expertise_areas)
      });
      
      remainingHours -= leadHours;
      memberIndex = 1;
      
      // Allocate team members
      while (remainingHours > 0 && memberIndex < members.length) {
        const member = members[memberIndex];
        const allocHours = Math.min(remainingHours / (members.length - memberIndex + 1), member.available_hours * 0.4);
        
        allocations.push({
          memberId: member.member_id,
          fullName: member.full_name,
          designation: member.designation,
          roleAssigned: 'Team Member',
          hoursAllocated: Math.round(allocHours * 10) / 10,
          expertise: JSON.parse(member.expertise_areas)
        });
        
        remainingHours -= allocHours;
        memberIndex++;
      }
      
      // Save allocations to database
      const insertAllocation = db.prepare(`
        INSERT INTO team_allocations (audit_id, member_id, role_assigned, hours_allocated, start_date, end_date, status)
        VALUES (?, ?, ?, ?, ?, ?, 'Planned')
      `);
      
      const transaction = db.transaction(() => {
        // Clear existing allocations
        db.prepare('DELETE FROM team_allocations WHERE audit_id = ?').run(auditId);
        
        // Insert new allocations
        for (const alloc of allocations) {
          insertAllocation.run(
            auditId,
            alloc.memberId,
            alloc.roleAssigned,
            alloc.hoursAllocated,
            audit.audit_start_date,
            audit.audit_end_date
          );
        }
        
        // Update team member workload
        for (const alloc of allocations) {
          db.prepare(`
            UPDATE team_members 
            SET current_workload_hours = current_workload_hours + ? 
            WHERE member_id = ?
          `).run(alloc.hoursAllocated, alloc.memberId);
        }
      });
      
      transaction();
      
      return {
        success: true,
        data: {
          totalHours,
          allocations,
          startDate: audit.audit_start_date,
          endDate: audit.audit_end_date
        }
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = new TeamService();