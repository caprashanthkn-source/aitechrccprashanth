// services/reportService.js - Document generation and export
const { getDatabase } = require('../database/dbInit');
const { Document, Packer, Paragraph, Table, TableRow, TableCell, HeadingLevel, AlignmentType, BorderStyle } = require('docx');
const fs = require('fs');

class ReportService {
  async exportToWord(auditId, filePath) {
    const db = getDatabase();
    
    try {
      // Fetch all audit data
      const audit = db.prepare(`
        SELECT a.*, c.client_name, i.industry_name, ra.act_name, ra.act_code,
               ct.type_name as client_type
        FROM audits a 
        JOIN clients c ON a.client_id = c.client_id 
        JOIN industries i ON a.industry_id = i.industry_id 
        JOIN regulatory_acts ra ON a.applicable_act_id = ra.act_id 
        LEFT JOIN client_types ct ON c.client_type_id = ct.type_id 
        WHERE a.audit_id = ?
      `).get(auditId);
      
      if (!audit) {
        return { success: false, message: 'Audit not found' };
      }
      
      // Get milestones
      const milestones = db.prepare(`
        SELECT * FROM audit_milestones WHERE audit_id = ? ORDER BY start_date
      `).all(auditId);
      
      // Get procedures
      const procedures = db.prepare(`
        SELECT ap.*, ci.item_description, ci.checklist_category, ci.section_reference,
               tm.full_name as assignee_name
        FROM audit_procedures ap 
        JOIN checklist_items ci ON ap.checklist_item_id = ci.item_id 
        LEFT JOIN team_members tm ON ap.assigned_to = tm.member_id 
        WHERE ap.audit_id = ? 
        ORDER BY ci.checklist_category, ci.sort_order
      `).all(auditId);
      
      // Get team allocations
      const allocations = db.prepare(`
        SELECT ta.*, tm.full_name, tm.designation, tm.expertise_areas 
        FROM team_allocations ta 
        JOIN team_members tm ON ta.member_id = tm.member_id 
        WHERE ta.audit_id = ?
      `).all(auditId);
      
      // Create Word document
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // Title
            new Paragraph({
              text: 'AUDIT PLAN & PROGRAM',
              heading: HeadingLevel.TITLE,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }),
            
            // Client Information Section
            new Paragraph({
              text: '1. CLIENT INFORMATION',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 }
            }),
            this.createInfoTable([
              ['Client Name', audit.client_name],
              ['Client Type', audit.client_type || 'N/A'],
              ['Industry', audit.industry_name],
              ['Registration No.', audit.registration_number || 'N/A'],
              ['Financial Year', audit.financial_year],
              ['Annual Turnover', `₹ ${this.formatCurrency(audit.annual_turnover)}`]
            ]),
            
            // Audit Details Section
            new Paragraph({
              text: '2. AUDIT DETAILS',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 }
            }),
            this.createInfoTable([
              ['Audit Title', audit.audit_title],
              ['Applicable Act', `${audit.act_name} (${audit.act_code})`],
              ['Risk Areas', JSON.parse(audit.risk_areas || '[]').join(', ')],
              ['Start Date', audit.audit_start_date],
              ['End Date', audit.audit_end_date],
              ['Total Planned Hours', `${audit.total_planned_hours} hours`]
            ]),
            
            // Team Allocation Section
            new Paragraph({
              text: '3. TEAM ALLOCATION',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 }
            }),
            this.createTeamTable(allocations),
            
            // Milestones Section
            new Paragraph({
              text: '4. AUDIT MILESTONES',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 }
            }),
            this.createMilestoneTable(milestones),
            
            // Audit Program Section
            new Paragraph({
              text: '5. AUDIT PROGRAM',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 }
            }),
            this.createProcedureTable(procedures)
          ]
        }]
      });
      
      // Write to file
      const buffer = await Packer.toBuffer(doc);
      fs.writeFileSync(filePath, buffer);
      
      return { success: true, message: 'Document exported successfully', filePath };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  createInfoTable(data) {
    const rows = data.map(([label, value]) => 
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: label, bold: true })],
            width: { size: 4000, type: 'dxa' }
          }),
          new TableCell({
            children: [new Paragraph({ text: value })],
            width: { size: 5000, type: 'dxa' }
          })
        ]
      })
    );
    
    return new Table({
      rows,
      width: { size: 9000, type: 'dxa' }
    });
  }

  createTeamTable(allocations) {
    if (allocations.length === 0) {
      return new Paragraph({ text: 'No team allocations found.' });
    }
    
    const headerRow = new TableRow({
      children: ['Name', 'Designation', 'Role', 'Hours', 'Expertise'].map(text =>
        new TableCell({
          children: [new Paragraph({ text, bold: true })],
          width: { size: 1800, type: 'dxa' }
        })
      )
    });
    
    const dataRows = allocations.map(alloc =>
      new TableRow({
        children: [
          alloc.full_name,
          alloc.designation,
          alloc.role_assigned,
          alloc.hours_allocated.toString(),
          JSON.parse(alloc.expertise_areas || '[]').join(', ')
        ].map(text =>
          new TableCell({
            children: [new Paragraph({ text })],
            width: { size: 1800, type: 'dxa' }
          })
        )
      })
    );
    
    return new Table({
      rows: [headerRow, ...dataRows],
      width: { size: 9000, type: 'dxa' }
    });
  }

  createMilestoneTable(milestones) {
    const headerRow = new TableRow({
      children: ['Milestone', 'Description', 'Start Date', 'End Date', 'Completion'].map(text =>
        new TableCell({
          children: [new Paragraph({ text, bold: true })],
          width: { size: 1800, type: 'dxa' }
        })
      )
    });
    
    const dataRows = milestones.map(m =>
      new TableRow({
        children: [
          m.milestone_name,
          m.description,
          m.start_date,
          m.end_date,
          `${m.completion_percentage}%`
        ].map(text =>
          new TableCell({
            children: [new Paragraph({ text: text.toString() })],
            width: { size: 1800, type: 'dxa' }
          })
        )
      })
    );
    
    return new Table({
      rows: [headerRow, ...dataRows],
      width: { size: 9000, type: 'dxa' }
    });
  }

  createProcedureTable(procedures) {
    const headerRow = new TableRow({
      children: ['Category', 'Reference', 'Procedure', 'Sampling', 'Risk', 'Hours', 'Assignee'].map(text =>
        new TableCell({
          children: [new Paragraph({ text, bold: true, size: 18 })],
          width: { size: 1285, type: 'dxa' }
        })
      )
    });
    
    const dataRows = procedures.map(p =>
      new TableRow({
        children: [
          p.checklist_category,
          p.section_reference || 'N/A',
          p.procedure_description?.substring(0, 100) + '...',
          p.sampling_methodology,
          p.risk_assessment,
          p.planned_hours.toString(),
          p.assignee_name || 'Unassigned'
        ].map(text =>
          new TableCell({
            children: [new Paragraph({ text: text?.toString() || '', size: 16 })],
            width: { size: 1285, type: 'dxa' }
          })
        )
      })
    );
    
    return new Table({
      rows: [headerRow, ...dataRows],
      width: { size: 9000, type: 'dxa' }
    });
  }

  formatCurrency(amount) {
    if (!amount) return '0';
    return amount.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  async exportToPDF(auditId, filePath) {
    // PDF export implementation (using html-pdf or similar)
    return { success: false, message: 'PDF export to be implemented' };
  }
}

module.exports = new ReportService();