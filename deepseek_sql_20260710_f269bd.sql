-- ============================================
-- AUDIT PLANNING ASSISTANT DATABASE SCHEMA
-- ============================================

-- Users table for authentication
CREATE TABLE users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    role VARCHAR(20) CHECK(role IN ('admin', 'manager', 'auditor')) DEFAULT 'auditor',
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- Client types
CREATE TABLE client_types (
    type_id INTEGER PRIMARY KEY AUTOINCREMENT,
    type_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT
);

-- Industries
CREATE TABLE industries (
    industry_id INTEGER PRIMARY KEY AUTOINCREMENT,
    industry_name VARCHAR(100) UNIQUE NOT NULL,
    industry_type VARCHAR(50) CHECK(industry_type IN ('Manufacturer', 'Trader', 'Service Provider')) NOT NULL,
    applicable_act_id INTEGER,
    FOREIGN KEY (applicable_act_id) REFERENCES regulatory_acts(act_id)
);

-- Regulatory Acts
CREATE TABLE regulatory_acts (
    act_id INTEGER PRIMARY KEY AUTOINCREMENT,
    act_name VARCHAR(200) NOT NULL,
    act_code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    effective_date DATE,
    amendment_version VARCHAR(20)
);

-- Checklist items mapped to Acts
CREATE TABLE checklist_items (
    item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    act_id INTEGER NOT NULL,
    section_reference VARCHAR(100),
    checklist_category VARCHAR(100) CHECK(category IN ('Financial', 'Operational', 'Compliance', 'Strategic')),
    item_description TEXT NOT NULL,
    risk_weight DECIMAL(3,2) DEFAULT 1.00,
    is_mandatory BOOLEAN DEFAULT 1,
    sort_order INTEGER,
    FOREIGN KEY (act_id) REFERENCES regulatory_acts(act_id)
);

-- Clients table
CREATE TABLE clients (
    client_id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_name VARCHAR(200) NOT NULL,
    client_type_id INTEGER,
    industry_id INTEGER,
    annual_turnover DECIMAL(15,2),
    registration_number VARCHAR(100),
    contact_person VARCHAR(100),
    contact_email VARCHAR(100),
    contact_phone VARCHAR(20),
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_type_id) REFERENCES client_types(type_id),
    FOREIGN KEY (industry_id) REFERENCES industries(industry_id)
);

-- Team members table
CREATE TABLE team_members (
    member_id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name VARCHAR(100) NOT NULL,
    designation VARCHAR(100),
    expertise_areas TEXT, -- JSON array of expertise
    qualification VARCHAR(100),
    years_experience INTEGER,
    current_workload_hours DECIMAL(5,1) DEFAULT 0,
    max_capacity_hours DECIMAL(5,1) DEFAULT 40,
    is_available BOOLEAN DEFAULT 1,
    email VARCHAR(100),
    phone VARCHAR(20)
);

-- Team allocation table
CREATE TABLE team_allocations (
    allocation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    role_assigned VARCHAR(100),
    hours_allocated DECIMAL(5,1),
    start_date DATE,
    end_date DATE,
    status VARCHAR(20) CHECK(status IN ('Planned', 'Active', 'Completed')) DEFAULT 'Planned',
    FOREIGN KEY (audit_id) REFERENCES audits(audit_id),
    FOREIGN KEY (member_id) REFERENCES team_members(member_id)
);

-- Audits table
CREATE TABLE audits (
    audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    audit_title VARCHAR(200),
    industry_id INTEGER,
    applicable_act_id INTEGER,
    financial_year VARCHAR(9),
    annual_turnover DECIMAL(15,2),
    risk_areas TEXT, -- JSON array: ['Financial', 'Operational', 'Compliance', 'Strategic']
    audit_start_date DATE,
    audit_end_date DATE,
    total_planned_hours DECIMAL(6,1),
    status VARCHAR(20) CHECK(status IN ('Planned', 'In Progress', 'Completed', 'Cancelled')) DEFAULT 'Planned',
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(client_id),
    FOREIGN KEY (industry_id) REFERENCES industries(industry_id),
    FOREIGN KEY (applicable_act_id) REFERENCES regulatory_acts(act_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);

-- Audit plan milestones
CREATE TABLE audit_milestones (
    milestone_id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_id INTEGER NOT NULL,
    milestone_name VARCHAR(200),
    description TEXT,
    start_date DATE,
    end_date DATE,
    responsible_member_id INTEGER,
    completion_percentage DECIMAL(5,2) DEFAULT 0,
    FOREIGN KEY (audit_id) REFERENCES audits(audit_id),
    FOREIGN KEY (responsible_member_id) REFERENCES team_members(member_id)
);

-- Audit program procedures
CREATE TABLE audit_procedures (
    procedure_id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_id INTEGER NOT NULL,
    checklist_item_id INTEGER,
    procedure_description TEXT,
    sampling_methodology VARCHAR(100),
    sample_size INTEGER,
    risk_assessment VARCHAR(20) CHECK(risk_assessment IN ('Low', 'Medium', 'High', 'Critical')),
    assigned_to INTEGER,
    planned_hours DECIMAL(4,1),
    FOREIGN KEY (audit_id) REFERENCES audits(audit_id),
    FOREIGN KEY (checklist_item_id) REFERENCES checklist_items(item_id),
    FOREIGN KEY (assigned_to) REFERENCES team_members(member_id)
);

-- Indexes for performance optimization
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_clients_type ON clients(client_type_id);
CREATE INDEX idx_clients_industry ON clients(industry_id);
CREATE INDEX idx_checklist_act ON checklist_items(act_id);
CREATE INDEX idx_audits_client ON audits(client_id);
CREATE INDEX idx_allocations_audit ON team_allocations(audit_id);
CREATE INDEX idx_allocations_member ON team_allocations(member_id);
CREATE INDEX idx_milestones_audit ON audit_milestones(audit_id);
CREATE INDEX idx_procedures_audit ON audit_procedures(audit_id);