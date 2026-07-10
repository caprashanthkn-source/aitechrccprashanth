// dashboard.js - Main application logic
let currentStep = 1;
let appState = {
    selectedIndustry: null,
    applicableActs: [],
    selectedAct: null,
    clientData: null,
    riskAreas: [],
    checklistItems: [],
    auditId: null,
    teamAllocation: null
};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    // Load user info
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('userDisplay').textContent = user.fullName || 'User';
    
    // Load step 1
    loadStep(1);
});

function navigateToStep(step) {
    currentStep = step;
    loadStep(step);
    updateProgress();
    updateStepIndicators();
}

async function loadStep(step) {
    const workArea = document.getElementById('workArea');
    
    switch(step) {
        case 1:
            await loadIndustrySelection(workArea);
            break;
        case 2:
            await loadClientDetails(workArea);
            break;
        case 3:
            await loadRiskAssessment(workArea);
            break;
        case 4:
            await loadChecklistReview(workArea);
            break;
        case 5:
            await loadTeamAllocation(workArea);
            break;
        case 6:
            await loadReportGeneration(workArea);
            break;
    }
}

async function loadIndustrySelection(container) {
    const result = await window.api.getIndustryTypes();
    
    if (result.success) {
        const industries = result.data;
        const types = [...new Set(industries.map(i => i.industry_type))];
        
        container.innerHTML = `
            <h2>Select Industry Type</h2>
            <p>Choose the industry category for the audit client</p>
            <div class="form-grid" style="margin-top: 20px;">
                ${types.map(type => `
                    <div class="step" onclick="selectIndustryType('${type}')" 
                         style="cursor: pointer; ${appState.selectedIndustry?.industry_type === type ? 'border-color: #667eea;' : ''}">
                        <h3>${type}</h3>
                        <p style="color: #666; font-size: 14px;">
                            ${industries.filter(i => i.industry_type === type).map(i => i.industry_name).join(', ')}
                        </p>
                    </div>
                `).join('')}
            </div>
            <div id="actInfo" class="hidden" style="margin-top: 30px;">
                <h3>Applicable Regulatory Acts:</h3>
                <div id="actsList"></div>
            </div>
            <button class="btn-primary hidden" id="btnNextStep" onclick="navigateToStep(2)">
                Continue to Client Details →
            </button>
        `;
    }
}

async function selectIndustryType(type) {
    appState.selectedIndustry = { industry_type: type };
    
    const result = await window.api.getApplicableAct(type);
    
    if (result.success) {
        appState.applicableActs = result.data;
        
        document.getElementById('actInfo').classList.remove('hidden');
        document.getElementById('actsList').innerHTML = result.data.map(act => `
            <div class="team-member-card">
                <div>
                    <strong>${act.act_name}</strong>
                    <span style="color: #666; margin-left: 10px;">(${act.act_code})</span>
                </div>
                <div style="color: #666;">${act.description || ''}</div>
            </div>
        `).join('');
        
        document.getElementById('btnNextStep').classList.remove('hidden');
    }
    
    await loadIndustrySelection(document.getElementById('workArea'));
}

async function loadClientDetails(container) {
    container.innerHTML = `
        <h2>Client Information</h2>
        <p>Enter the client details for the audit engagement</p>
        <form id="clientForm" class="form-grid">
            <div class="form-group">
                <label>Client Name *</label>
                <input type="text" id="clientName" required>
            </div>
            <div class="form-group">
                <label>Client Type *</label>
                <select id="clientType" required>
                    <option value="">Select Type</option>
                    <option value="1">Proprietorship</option>
                    <option value="2">Partnership</option>
                    <option value="3">Private Limited</option>
                    <option value="4">Public Limited</option>
                    <option value="5">LLP</option>
                </select>
            </div>
            <div class="form-group">
                <label>Registration Number</label>
                <input type="text" id="regNumber">
            </div>
            <div class="form-group">
                <label>Annual Turnover (₹) *</label>
                <input type="number" id="annualTurnover" required placeholder="e.g., 50000000">
            </div>
            <div class="form-group">
                <label>Contact Person</label>
                <input type="text" id="contactPerson">
            </div>
            <div class="form-group">
                <label>Contact Email</label>
                <input type="email" id="contactEmail">
            </div>
            <div class="form-group">
                <label>Financial Year *</label>
                <input type="text" id="financialYear" placeholder="2023-24" required>
            </div>
            <div class="form-group">
                <label>Audit Start Date *</label>
                <input type="date" id="startDate" required>
            </div>
            <div class="form-group">
                <label>Audit End Date *</label>
                <input type="date" id="endDate" required>
            </div>
            <div class="form-group" style="grid-column: span 2;">
                <label>Address</label>
                <textarea id="address" rows="2"></textarea>
            </div>
        </form>
        <div style="display: flex; gap: 10px;">
            <button class="btn-secondary" onclick="navigateToStep(1)">← Back</button>
            <button class="btn-primary" onclick="saveClientDetails()">Save & Continue →</button>
        </div>
    `;
}

function saveClientDetails() {
    const clientData = {
        clientName: document.getElementById('clientName').value,
        clientTypeId: document.getElementById('clientType').value,
        registrationNumber: document.getElementById('regNumber').value,
        annualTurnover: parseFloat(document.getElementById('annualTurnover').value),
        contactPerson: document.getElementById('contactPerson').value,
        contactEmail: document.getElementById('contactEmail').value,
        financialYear: document.getElementById('financialYear').value,
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value,
        address: document.getElementById('address').value,
        industryType: appState.selectedIndustry.industry_type
    };
    
    // Validate required fields
    if (!clientData.clientName || !clientData.clientTypeId || !clientData.annualTurnover || 
        !clientData.financialYear || !clientData.startDate || !clientData.endDate) {
        alert('Please fill all required fields');
        return;
    }
    
    appState.clientData = clientData;
    navigateToStep(3);
}

async function loadRiskAssessment(container) {
    container.innerHTML = `
        <h2>Risk Assessment</h2>
        <p>Select the risk areas applicable to this audit engagement</p>
        <div class="form-grid" style="margin-top: 20px;">
            <div class="step" onclick="toggleRisk('Financial')" id="riskFinancial" style="cursor: pointer;">
                <h3>💰 Financial Risk</h3>
                <p>Risks related to financial reporting, transactions, and controls</p>
                <p style="color: #e74c3c; font-weight: 600;">Weight: 1.2x</p>
            </div>
            <div class="step" onclick="toggleRisk('Operational')" id="riskOperational" style="cursor: pointer;">
                <h3>⚙️ Operational Risk</h3>
                <p>Risks in business operations, processes, and efficiency</p>
                <p style="color: #e74c3c; font-weight: 600;">Weight: 1.1x</p>
            </div>
            <div class="step" onclick="toggleRisk('Compliance')" id="riskCompliance" style="cursor: pointer;">
                <h3>📋 Compliance Risk</h3>
                <p>Regulatory and statutory compliance risks</p>
                <p style="color: #e74c3c; font-weight: 600;">Weight: 1.15x</p>
            </div>
            <div class="step" onclick="toggleRisk('Strategic')" id="riskStrategic" style="cursor: pointer;">
                <h3>🎯 Strategic Risk</h3>
                <p>Business strategy and governance risks</p>
                <p style="color: #e74c3c; font-weight: 600;">Weight: 1.05x</p>
            </div>
        </div>
        <div style="margin-top: 20px;">
            <h3>Selected Risk Areas: <span id="selectedRisks">None</span></h3>
            <p>Combined Risk Multiplier: <strong id="riskMultiplier">1.0x</strong></p>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button class="btn-secondary" onclick="navigateToStep(2)">← Back</button>
            <button class="btn-primary" onclick="confirmRiskAssessment()">Confirm & Continue →</button>
        </div>
    `;
    
    // Highlight selected risks
    appState.riskAreas.forEach(risk => {
        const element = document.getElementById(`risk${risk}`);
        if (element) element.style.border = '2px solid #667eea';
    });
    
    updateRiskDisplay();
}

function toggleRisk(risk) {
    const index = appState.riskAreas.indexOf(risk);
    if (index > -1) {
        appState.riskAreas.splice(index, 1);
    } else {
        appState.riskAreas.push(risk);
    }
    
    // Update UI
    const element = document.getElementById(`risk${risk}`);
    if (element) {
        element.style.border = index > -1 ? '2px solid transparent' : '2px solid #667eea';
    }
    
    updateRiskDisplay();
}

function updateRiskDisplay() {
    const selectedRisks = document.getElementById('selectedRisks');
    const riskMultiplier = document.getElementById('riskMultiplier');
    
    if (selectedRisks) {
        selectedRisks.textContent = appState.riskAreas.length > 0 ? appState.riskAreas.join(', ') : 'None';
    }
    
    if (riskMultiplier) {
        const weights = {
            'Financial': 1.2,
            'Operational': 1.1,
            'Compliance': 1.15,
            'Strategic': 1.05
        };
        
        let multiplier = 1.0;
        appState.riskAreas.forEach(risk => {
            multiplier *= weights[risk] || 1.0;
        });
        
        riskMultiplier.textContent = `${Math.min(multiplier, 2.0).toFixed(2)}x`;
    }
}

function confirmRiskAssessment() {
    if (appState.riskAreas.length === 0) {
        alert('Please select at least one risk area');
        return;
    }
    navigateToStep(4);
}

async function loadChecklistReview(container) {
    if (!appState.applicableActs || appState.applicableActs.length === 0) {
        container.innerHTML = '<p>Please select an industry first.</p>';
        return;
    }
    
    const actId = appState.applicableActs[0].act_id;
    const result = await window.api.getChecklistByAct(actId);
    
    if (result.success) {
        appState.checklistItems = result.data;
        
        // Group by category
        const categories = {};
        result.data.forEach(item => {
            if (!categories[item.checklist_category]) {
                categories[item.checklist_category] = [];
            }
            categories[item.checklist_category].push(item);
        });
        
        container.innerHTML = `
            <h2>Audit Checklist - ${appState.applicableActs[0].act_name}</h2>
            <p>Review the checklist items based on selected risk areas</p>
            ${Object.entries(categories).map(([category, items]) => `
                <div class="checklist-category">
                    <h3>${category} (${items.length} items)</h3>
                    ${items.map(item => `
                        <div class="checklist-item">
                            <input type="checkbox" checked>
                            <span style="flex: 1;">${item.item_description}</span>
                            <span class="risk-badge risk-${
                                item.risk_weight >= 2.0 ? 'high' : 
                                item.risk_weight >= 1.5 ? 'medium' : 'low'
                            }">
                                Risk: ${item.risk_weight.toFixed(1)}
                            </span>
                            <span style="margin-left: 10px; color: #666;">
                                ${item.section_reference || ''}
                            </span>
                        </div>
                    `).join('')}
                </div>
            `).join('')}
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button class="btn-secondary" onclick="navigateToStep(3)">← Back</button>
                <button class="btn-primary" onclick="createAuditPlan()">Create Audit Plan →</button>
            </div>
        `;
    }
}

async function createAuditPlan() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    const auditData = {
        clientId: 1, // Would be created first in production
        auditTitle: `Statutory Audit - ${appState.clientData.clientName} (${appState.clientData.financialYear})`,
        industryId: 1, // Would be looked up
        applicableActId: appState.applicableActs[0].act_id,
        financialYear: appState.clientData.financialYear,
        annualTurnover: appState.clientData.annualTurnover,
        riskAreas: appState.riskAreas,
        startDate: appState.clientData.startDate,
        endDate: appState.clientData.endDate,
        createdBy: user.userId
    };
    
    const result = await window.api.createAuditPlan(auditData);
    
    if (result.success) {
        appState.auditId = result.auditId;
        alert(`Audit plan created successfully!\nPlanned Hours: ${result.totalPlannedHours}`);
        navigateToStep(5);
    } else {
        alert('Error creating audit plan: ' + result.message);
    }
}

async function loadTeamAllocation(container) {
    container.innerHTML = `
        <h2>Team Allocation</h2>
        <p>Optimize team allocation based on availability and expertise</p>
        <button class="btn-primary" onclick="optimizeTeam()">Optimize Team Allocation</button>
        <div id="teamResult" style="margin-top: 20px;"></div>
        <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button class="btn-secondary" onclick="navigateToStep(4)">← Back</button>
            <button class="btn-primary" onclick="navigateToStep(6)">Continue to Reports →</button>
        </div>
    `;
}

async function optimizeTeam() {
    if (!appState.auditId) {
        alert('Please create an audit plan first');
        return;
    }
    
    const requiredSkills = JSON.stringify(['Financial Audit', 'Tax Audit', 'Compliance Audit']);
    const result = await window.api.optimizeAllocation(appState.auditId, requiredSkills);
    
    if (result.success) {
        appState.teamAllocation = result.data;
        
        document.getElementById('teamResult').innerHTML = `
            <h3>Optimized Team Allocation</h3>
            <p>Total Planned Hours: <strong>${result.data.totalHours}</strong></p>
            <p>Period: ${result.data.startDate} to ${result.data.endDate}</p>
            <table class="allocation-table">
                <thead>
                    <tr>
                        <th>Team Member</th>
                        <th>Designation</th>
                        <th>Role</th>
                        <th>Hours Allocated</th>
                        <th>Expertise</th>
                    </tr>
                </thead>
                <tbody>
                    ${result.data.allocations.map(alloc => `
                        <tr>
                            <td>${alloc.fullName}</td>
                            <td>${alloc.designation}</td>
                            <td>${alloc.roleAssigned}</td>
                            <td>${alloc.hoursAllocated}</td>
                            <td>${alloc.expertise.join(', ')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } else {
        alert('Optimization failed: ' + result.message);
    }
}

async function loadReportGeneration(container) {
    container.innerHTML = `
        <h2>Generate Reports</h2>
        <p>Export audit plan and program documents</p>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 20px;">
            <div class="step" onclick="exportWord()" style="cursor: pointer;">
                <h3>📄 Export as Word</h3>
                <p>Generate detailed audit plan document in DOCX format</p>
            </div>
            <div class="step" onclick="exportPDF()" style="cursor: pointer;">
                <h3>📑 Export as PDF</h3>
                <p>Generate audit report in PDF format</p>
            </div>
        </div>
        <div style="margin-top: 30px;">
            <h3>Audit Summary</h3>
            <div id="auditSummary"></div>
        </div>
        <button class="btn-secondary" onclick="navigateToStep(5)" style="margin-top: 20px;">← Back</button>
    `;
    
    loadAuditSummary();
}

async function loadAuditSummary() {
    if (appState.auditId) {
        const milestones = await window.api.getAuditMilestones(appState.auditId);
        
        if (milestones.success) {
            document.getElementById('auditSummary').innerHTML = `
                <table class="allocation-table">
                    <thead>
                        <tr>
                            <th>Milestone</th>
                            <th>Start Date</th>
                            <th>End Date</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${milestones.data.map(m => `
                            <tr>
                                <td>${m.milestone_name}</td>
                                <td>${m.start_date}</td>
                                <td>${m.end_date}</td>
                                <td>${m.description}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
    }
}

async function exportWord() {
    if (!appState.auditId) {
        alert('No audit plan to export');
        return;
    }
    
    const result = await window.api.exportWord(appState.auditId);
    
    if (result.success) {
        alert('Document exported successfully!\nSaved to: ' + result.filePath);
    } else {
        alert('Export failed: ' + result.message);
    }
}

async function exportPDF() {
    if (!appState.auditId) {
        alert('No audit plan to export');
        return;
    }
    
    const result = await window.api.exportPDF(appState.auditId);
    
    if (result.success) {
        alert('PDF exported successfully!');
    } else {
        alert('PDF export: ' + result.message);
    }
}

function updateProgress() {
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
        progressBar.style.width = `${((currentStep - 1) / 5) * 100}%`;
    }
}

function updateStepIndicators() {
    const steps = document.querySelectorAll('.step');
    steps.forEach((step, index) => {
        step.classList.remove('active', 'completed');
        if (index + 1 < currentStep) {
            step.classList.add('completed');
        } else if (index + 1 === currentStep) {
            step.classList.add('active');
        }
    });
}

function handleLogout() {
    localStorage.clear();
    window.location.href = 'index.html';
}