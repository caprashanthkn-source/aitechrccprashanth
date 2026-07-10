// database/dbInit.js - Database initialization and seed data
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'data', 'audit_planner.db');

let db;

function initDatabase() {
  // Create database directory if not exists
  const fs = require('fs');
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(DB_PATH);
  
  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  
  // Create tables
  createTables();
  
  // Seed initial data
  seedData();
  
  return db;
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
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

    CREATE TABLE IF NOT EXISTS client_types (
      type_id INTEGER PRIMARY KEY AUTOINCREMENT,
      type_name VARCHAR(50) UNIQUE NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS regulatory_acts (
      act_id INTEGER PRIMARY KEY AUTOINCREMENT,
      act_name VARCHAR(200) NOT NULL,
      act_code VARCHAR(50) UNIQUE NOT NULL,
      description TEXT,
      effective_date DATE,
      amendment_version VARCHAR(20)
    );

    CREATE TABLE IF NOT EXISTS industries (
      industry_id INTEGER PRIMARY KEY AUTOINCREMENT,
      industry_name VARCHAR(100) UNIQUE NOT NULL,
      industry_type VARCHAR(50) CHECK(industry_type IN ('Manufacturer', 'Trader', 'Service Provider')) NOT NULL,
      applicable_act_id INTEGER,
      FOREIGN KEY (applicable_act_id) REFERENCES regulatory_acts(act_id)
    );

    CREATE TABLE IF NOT EXISTS checklist_items (
      item_id INTEGER PRIMARY KEY AUTOINCREMENT,
      act_id INTEGER NOT NULL,
      section_reference VARCHAR(100),
      checklist_category VARCHAR(100) CHECK(checklist_category IN ('Financial', 'Operational', 'Compliance', 'Strategic')),
      item_description TEXT NOT NULL,
      risk_weight DECIMAL(3,2) DEFAULT 1.00,
      is_mandatory BOOLEAN DEFAULT 1,
      sort_order INTEGER,
      FOREIGN KEY (act_id) REFERENCES regulatory_acts(act_id)
    );

    CREATE TABLE IF NOT EXISTS clients (
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

    CREATE TABLE IF NOT EXISTS team_members (
      member_id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name VARCHAR(100) NOT NULL,
      designation VARCHAR(100),
      expertise_areas TEXT,
      qualification VARCHAR(100),
      years_experience INTEGER,
      current_workload_hours DECIMAL(5,1) DEFAULT 0,
      max_capacity_hours DECIMAL(5,1) DEFAULT 40,
      is_available BOOLEAN DEFAULT 1,
      email VARCHAR(100),
      phone VARCHAR(20)
    );

    CREATE TABLE IF NOT EXISTS audits (
      audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      audit_title VARCHAR(200),
      industry_id INTEGER,
      applicable_act_id INTEGER,
      financial_year VARCHAR(9),
      annual_turnover DECIMAL(15,2),
      risk_areas TEXT,
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

    CREATE TABLE IF NOT EXISTS team_allocations (
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

    CREATE TABLE IF NOT EXISTS audit_milestones (
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

    CREATE TABLE IF NOT EXISTS audit_procedures (
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

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_clients_type ON clients(client_type_id);
    CREATE INDEX IF NOT EXISTS idx_clients_industry ON clients(industry_id);
    CREATE INDEX IF NOT EXISTS idx_checklist_act ON checklist_items(act_id);
    CREATE INDEX IF NOT EXISTS idx_audits_client ON audits(client_id);
    CREATE INDEX IF NOT EXISTS idx_allocations_audit ON team_allocations(audit_id);
    CREATE INDEX IF NOT EXISTS idx_allocations_member ON team_allocations(member_id);
    CREATE INDEX IF NOT EXISTS idx_milestones_audit ON audit_milestones(audit_id);
    CREATE INDEX IF NOT EXISTS idx_procedures_audit ON audit_procedures(audit_id);
  `);
}

function seedData() {
  // Check if data already exists
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count > 0) return;

  // Seed client types
  const insertClientType = db.prepare('INSERT INTO client_types (type_name, description) VALUES (?, ?)');
  insertClientType.run('Proprietorship', 'Single owner business entity');
  insertClientType.run('Partnership', 'Business owned by two or more partners');
  insertClientType.run('Private Limited', 'Privately held limited company');
  insertClientType.run('Public Limited', 'Publicly traded limited company');
  insertClientType.run('LLP', 'Limited Liability Partnership');

  // Seed regulatory acts
  const insertAct = db.prepare('INSERT INTO regulatory_acts (act_name, act_code, description) VALUES (?, ?, ?)');
  insertAct.run('Companies Act, 2013', 'CA2013', 'Applicable to all companies registered under Companies Act');
  insertAct.run('Income Tax Act, 1961', 'ITA1961', 'Tax audit requirements under Section 44AB');
  insertAct.run('GST Act, 2017', 'GST2017', 'Goods and Services Tax audit requirements');
  insertAct.run('Factories Act, 1948', 'FA1948', 'Applicable to manufacturing units');
  insertAct.run('Shops and Establishments Act', 'SEA', 'Applicable to commercial establishments');

  // Seed industries with applicable acts
  const insertIndustry = db.prepare('INSERT INTO industries (industry_name, industry_type, applicable_act_id) VALUES (?, ?, ?)');
  insertIndustry.run('Automobile Manufacturing', 'Manufacturer', 1);
  insertIndustry.run('Textile Manufacturing', 'Manufacturer', 1);
  insertIndustry.run('Electronics Manufacturing', 'Manufacturer', 4);
  insertIndustry.run('Wholesale Trading', 'Trader', 2);
  insertIndustry.run('Retail Trading', 'Trader', 5);
  insertIndustry.run('E-commerce Trading', 'Trader', 3);
  insertIndustry.run('IT Services', 'Service Provider', 2);
  insertIndustry.run('Consulting Services', 'Service Provider', 2);
  insertIndustry.run('Healthcare Services', 'Service Provider', 5);

  // Seed checklist items
  const insertChecklist = db.prepare('INSERT INTO checklist_items (act_id, section_reference, checklist_category, item_description, risk_weight, is_mandatory, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)');

  // Companies Act checklists
  insertChecklist.run(1, 'Sec 128', 'Financial', 'Verify books of accounts maintained as per Section 128', 1.5, 1, 1);
  insertChecklist.run(1, 'Sec 129', 'Financial', 'Check financial statements compliance with Schedule III', 2.0, 1, 2);
  insertChecklist.run(1, 'Sec 134', 'Compliance', 'Verify Board Report contents and disclosures', 1.0, 1, 3);
  insertChecklist.run(1, 'Sec 139', 'Compliance', 'Verify auditor appointment compliance', 1.5, 1, 4);
  insertChecklist.run(1, 'Sec 177', 'Operational', 'Review Audit Committee constitution and meetings', 1.0, 0, 5);
  insertChecklist.run(1, 'Sec 185', 'Financial', 'Check loans to directors compliance', 2.0, 1, 6);
  insertChecklist.run(1, 'Sec 188', 'Operational', 'Review related party transactions', 1.5, 1, 7);

  // Income Tax Act checklists
  insertChecklist.run(2, 'Sec 44AB', 'Financial', 'Verify tax audit applicability based on turnover', 2.0, 1, 1);
  insertChecklist.run(2, 'Sec 40A(2)', 'Financial', 'Check payments to related parties', 1.5, 1, 2);
  insertChecklist.run(2, 'Sec 43B', 'Compliance', 'Verify statutory dues payment compliance', 2.0, 1, 3);
  insertChecklist.run(2, 'Sec 36', 'Financial', 'Verify allowability of expenses claimed', 1.5, 1, 4);

  // GST Act checklists
  insertChecklist.run(3, 'Sec 35', 'Compliance', 'Verify GST registration and returns filing', 2.0, 1, 1);
  insertChecklist.run(3, 'Sec 16', 'Financial', 'Check Input Tax Credit reconciliation', 2.0, 1, 2);
  insertChecklist.run(3, 'Rule 59', 'Operational', 'Verify outward supply reporting', 1.5, 1, 3);

  // Seed team members
  const insertMember = db.prepare('INSERT INTO team_members (full_name, designation, expertise_areas, qualification, years_experience, current_workload_hours, max_capacity_hours, is_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  insertMember.run('Rahul Sharma', 'Senior Auditor', '["Financial Audit", "Tax Audit", "GST"]', 'CA', 12, 20, 40, 1);
  insertMember.run('Priya Patel', 'Audit Manager', '["Compliance Audit", "Internal Audit", "Risk Assessment"]', 'CA, CIA', 15, 25, 40, 1);
  insertMember.run('Amit Kumar', 'Junior Auditor', '["Financial Audit", "GST"]', 'CA Inter', 3, 10, 40, 1);
  insertMember.run('Sneha Gupta', 'Senior Auditor', '["Operational Audit", "Process Audit", "IT Audit"]', 'CA, CISA', 10, 15, 40, 1);
  insertMember.run('Vikram Singh', 'Audit Assistant', '["Financial Audit", "Documentation"]', 'B.Com', 2, 5, 40, 1);
  insertMember.run('Neha Jain', 'Tax Specialist', '["Tax Audit", "GST Audit", "Transfer Pricing"]', 'CA', 8, 30, 40, 1);

  // Seed admin user (password: admin123)
  const passwordHash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password_hash, full_name, email, role) VALUES (?, ?, ?, ?, ?)').run('admin', passwordHash, 'System Administrator', 'admin@auditfirm.com', 'admin');
}

function getDatabase() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

module.exports = { initDatabase, getDatabase };