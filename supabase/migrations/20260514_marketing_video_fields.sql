-- Add marketing video fields to existing MySQL databases.
-- Safe to run repeatedly on MySQL 8.0.

DROP PROCEDURE IF EXISTS showrunner_add_column_if_missing;

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

DELIMITER ;

CALL showrunner_add_column_if_missing('demos', 'audience', 'audience TEXT NULL AFTER description');
CALL showrunner_add_column_if_missing('demos', 'key_points', 'key_points TEXT NULL AFTER audience');
CALL showrunner_add_column_if_missing('demos', 'brand_tone', 'brand_tone VARCHAR(80) NULL AFTER key_points');
CALL showrunner_add_column_if_missing('demos', 'source_summary', 'source_summary TEXT NULL AFTER brand_tone');
CALL showrunner_add_column_if_missing('demos', 'thumbnail_url', 'thumbnail_url TEXT NULL AFTER source_summary');
CALL showrunner_add_column_if_missing('demos', 'view_count', 'view_count INT NOT NULL DEFAULT 0 AFTER share_token');
CALL showrunner_add_column_if_missing('demos', 'cta_url', 'cta_url TEXT NULL AFTER view_count');
CALL showrunner_add_column_if_missing('demos', 'cta_text', 'cta_text VARCHAR(100) NULL AFTER cta_url');
CALL showrunner_add_column_if_missing('demos', 'session_cookies', 'session_cookies TEXT NULL AFTER cta_text');

CALL showrunner_add_column_if_missing('steps', 'visual_type', 'visual_type ENUM(''screenshot'',''template'',''cta'') NOT NULL DEFAULT ''template'' AFTER narration');
CALL showrunner_add_column_if_missing('steps', 'visual_asset_url', 'visual_asset_url TEXT NULL AFTER visual_type');

DROP PROCEDURE IF EXISTS showrunner_add_column_if_missing;
