-- Comissões configuráveis e participação nos lucros (MySQL)

-- Pedidos: vendedor, tipo, IVA, custo e valor pago.
-- Remova as linhas das colunas que a tabela orders já tenha.
ALTER TABLE orders
  ADD COLUMN seller_id INT UNSIGNED NULL,
  ADD COLUMN order_type VARCHAR(255) NULL,
  ADD COLUMN vat_rate DECIMAL(5,2) DEFAULT 23,
  ADD COLUMN cost_total DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN amount_paid DECIMAL(12,2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS order_participants (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  role VARCHAR(255) NOT NULL,
  custom_percent DECIMAL(5,2) NULL,
  INDEX idx_order_participants_order (order_id)
);

CREATE TABLE IF NOT EXISTS commission_rules (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  active TINYINT(1) DEFAULT 1,
  priority INT DEFAULT 0,
  valid_from DATE NULL,
  valid_to DATE NULL,
  recipient_mode VARCHAR(255) NOT NULL DEFAULT 'seller_only',
  split_mode VARCHAR(255) DEFAULT 'equal',
  role_weights JSON NULL,
  base_type VARCHAR(255) NOT NULL DEFAULT 'order_total',
  calc_type VARCHAR(255) NOT NULL DEFAULT 'percent',
  value DECIMAL(12,2) DEFAULT 0,
  use_tiers TINYINT(1) DEFAULT 0,
  order_type VARCHAR(255) NULL,
  min_order_value DECIMAL(12,2) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS commission_tiers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  rule_id INT UNSIGNED NOT NULL,
  min_monthly_volume DECIMAL(12,2) NOT NULL DEFAULT 0,
  percent DECIMAL(5,2) NOT NULL,
  bonus_amount DECIMAL(12,2) DEFAULT 0,
  FOREIGN KEY (rule_id) REFERENCES commission_rules(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS commissions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NULL,
  user_id INT UNSIGNED NOT NULL,
  rule_id INT UNSIGNED NULL,
  tier_id INT UNSIGNED NULL,
  base_amount DECIMAL(12,2) DEFAULT 0,
  share_percent DECIMAL(5,2) DEFAULT 100,
  percent_applied DECIMAL(5,2) NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  converted_amount DECIMAL(12,2) DEFAULT 0,
  type VARCHAR(255) NOT NULL DEFAULT 'sale',
  status VARCHAR(255) NOT NULL DEFAULT 'pendente',
  period VARCHAR(7) NOT NULL,
  paid_at DATETIME NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_commissions_order (order_id),
  INDEX idx_commissions_user_period (user_id, period)
);

CREATE TABLE IF NOT EXISTS profit_share_conversions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  commission_id INT UNSIGNED NOT NULL,
  amount_eur DECIMAL(12,2) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  units DECIMAL(14,4) NOT NULL,
  converted_at DATETIME NOT NULL,
  period VARCHAR(7) NOT NULL,
  created_at DATETIME NOT NULL,
  INDEX idx_conversions_user_period (user_id, period)
);

CREATE TABLE IF NOT EXISTS profit_distributions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  distribution_date DATETIME NOT NULL,
  total_profit DECIMAL(12,2) NOT NULL,
  distributed_amount DECIMAL(12,2) NULL,
  distribution_details TEXT NULL,
  pool_percent DECIMAL(5,2) DEFAULT 0,
  pool_amount DECIMAL(12,2) DEFAULT 0,
  total_units DECIMAL(14,4) DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS profit_share_dividends (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  distribution_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  units DECIMAL(14,4) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(255) NOT NULL DEFAULT 'a_pagar',
  paid_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (distribution_id) REFERENCES profit_distributions(id)
);

-- Parâmetros da participação nos lucros (editáveis em configurations.html).
-- Valor vazio = sem limite.
INSERT IGNORE INTO configurations (config_key, config_value) VALUES
  ('profit_share_unit_price', '10'),
  ('profit_share_max_percent', '30'),
  ('profit_share_max_monthly_eur', '500'),
  ('profit_share_pool_percent', '10');
