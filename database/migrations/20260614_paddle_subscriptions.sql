-- Add Paddle Billing subscription fields and webhook idempotency table.
-- Safe to run repeatedly on MySQL 8.0.

DROP PROCEDURE IF EXISTS showrunner_add_column_if_missing;
DROP PROCEDURE IF EXISTS showrunner_add_index_if_missing;

DELIMITER //

CREATE PROCEDURE showrunner_add_column_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_column_name VARCHAR(64),
  IN p_column_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND COLUMN_NAME = p_column_name
  ) THEN
    SET @add_column_sql = CONCAT('ALTER TABLE `', p_table_name, '` ADD COLUMN ', p_column_definition);
    PREPARE add_column_stmt FROM @add_column_sql;
    EXECUTE add_column_stmt;
    DEALLOCATE PREPARE add_column_stmt;
  END IF;
END//

CREATE PROCEDURE showrunner_add_index_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64),
  IN p_index_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND INDEX_NAME = p_index_name
  ) THEN
    SET @add_index_sql = CONCAT('ALTER TABLE `', p_table_name, '` ADD ', p_index_definition);
    PREPARE add_index_stmt FROM @add_index_sql;
    EXECUTE add_index_stmt;
    DEALLOCATE PREPARE add_index_stmt;
  END IF;
END//

DELIMITER ;

CALL showrunner_add_column_if_missing('subscriptions', 'paddle_customer_id', 'paddle_customer_id VARCHAR(64) NULL AFTER current_period_end');
CALL showrunner_add_column_if_missing('subscriptions', 'paddle_subscription_id', 'paddle_subscription_id VARCHAR(64) NULL AFTER paddle_customer_id');
CALL showrunner_add_column_if_missing('subscriptions', 'paddle_price_id', 'paddle_price_id VARCHAR(64) NULL AFTER paddle_subscription_id');
CALL showrunner_add_column_if_missing('subscriptions', 'paddle_status', 'paddle_status VARCHAR(40) NULL AFTER paddle_price_id');
CALL showrunner_add_column_if_missing('subscriptions', 'paddle_updated_at', 'paddle_updated_at TIMESTAMP NULL AFTER paddle_status');

CALL showrunner_add_index_if_missing(
  'subscriptions',
  'uq_sub_paddle_subscription',
  'UNIQUE KEY uq_sub_paddle_subscription (paddle_subscription_id)'
);

CREATE TABLE IF NOT EXISTS paddle_events (
  id           VARCHAR(64) NOT NULL PRIMARY KEY,
  event_type   VARCHAR(80) NOT NULL,
  occurred_at  TIMESTAMP   NULL,
  processed_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP PROCEDURE IF EXISTS showrunner_add_column_if_missing;
DROP PROCEDURE IF EXISTS showrunner_add_index_if_missing;
