-- ============================
-- MINET LAP TRACKER SCHEMA
-- ============================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================
-- USERS TABLE
-- ============================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(64) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('superadmin', 'admin', 'security')),
  emp_id VARCHAR(64),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  must_set_password BOOLEAN NOT NULL DEFAULT TRUE,
  password_reset_required BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash TEXT,
  temp_password_hash TEXT,
  temp_password_issued_at TIMESTAMPTZ,
  last_password_change TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- ============================
-- EMPLOYEES TABLE
-- ============================
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_id VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  department VARCHAR(128),
  photo_url TEXT,
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_emp_id ON employees(emp_id);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);

-- ============================
-- DEVICES TABLE
-- ============================
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number VARCHAR(128) NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('COMPANY', 'BYOD')),
  make VARCHAR(128),
  model VARCHAR(128),
  color VARCHAR(64),
  assigned_to VARCHAR(64) REFERENCES employees(emp_id) ON DELETE SET NULL ON UPDATE CASCADE,
  last_action TEXT CHECK (last_action IN ('CHECK_IN', 'CHECK_OUT')),
  last_action_at TIMESTAMPTZ,
  qr_code_url TEXT,
  retired_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_serial_number ON devices(serial_number);
CREATE INDEX IF NOT EXISTS idx_devices_assigned_to ON devices(assigned_to);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(type);
CREATE INDEX IF NOT EXISTS idx_devices_active ON devices(serial_number) WHERE status = 'ACTIVE';

-- ============================
-- ACTIVITY LOGS TABLE
-- (Device check in / check out records)
-- ============================
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_id VARCHAR(64) NOT NULL,
  employee_name VARCHAR(255) NOT NULL,
  serial_number VARCHAR(128) NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('CHECK_IN', 'CHECK_OUT')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  logstamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  readable_logstamp TEXT,
  synced_from_offline BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_emp_id ON activity_logs(emp_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_serial_number ON activity_logs(serial_number);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp);

-- ============================
-- VISITORS TABLE
-- ============================
CREATE TABLE IF NOT EXISTS visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id VARCHAR(32) UNIQUE,
  type TEXT CHECK (type IN ('QUICK', 'STANDARD')),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(32),
  identifier VARCHAR(64),
  destination VARCHAR(255),
  reason VARCHAR(255),
  status TEXT NOT NULL DEFAULT 'IN' CHECK (status IN ('IN', 'OUT')),
  check_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_out_time TIMESTAMPTZ,
  -- Device fields for STANDARD visitors
  device_type VARCHAR(128),
  device_make_model VARCHAR(128),
  device_serial VARCHAR(128),
  device_color VARCHAR(64),
  handled_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitors_status ON visitors(status);
CREATE INDEX IF NOT EXISTS idx_visitors_check_in_time ON visitors(check_in_time);
CREATE INDEX IF NOT EXISTS idx_visitors_active ON visitors(check_in_time) WHERE status = 'IN';

-- ============================
-- VENDORS TABLE
-- ============================
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id VARCHAR(32) UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(32),
  company VARCHAR(255),
  supplies TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_vendors_company ON vendors(company);
CREATE INDEX IF NOT EXISTS idx_vendors_is_active ON vendors(is_active);

-- ============================
-- VENDOR VISITS TABLE
-- ============================
CREATE TABLE IF NOT EXISTS vendor_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  vendor_name VARCHAR(255),
  company_name VARCHAR(255),
  visitor_name VARCHAR(255),
  visitor_phone VARCHAR(32),
  purpose VARCHAR(255),
  status TEXT NOT NULL DEFAULT 'IN' CHECK (status IN ('IN', 'OUT')),
  check_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_out_time TIMESTAMPTZ,
  handled_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_visits_vendor_id ON vendor_visits(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_visits_status ON vendor_visits(status);
CREATE INDEX IF NOT EXISTS idx_vendor_visits_check_in_time ON vendor_visits(check_in_time);
CREATE INDEX IF NOT EXISTS idx_vendor_visits_active ON vendor_visits(check_in_time) WHERE status = 'IN';

-- ============================
-- AUDIT LOGS TABLE
-- ============================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  category TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT,
  actor_username TEXT,
  actor_role TEXT,
  actor_email TEXT,
  target_type TEXT,
  target_id TEXT,
  status TEXT DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'FAILURE')),
  description TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata_gin ON audit_logs USING GIN (metadata);