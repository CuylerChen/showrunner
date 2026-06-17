-- Add narration language selection to demos.
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

CALL showrunner_add_column_if_missing('demos', 'narration_language', 'narration_language VARCHAR(20) NOT NULL DEFAULT ''auto'' AFTER video_style');

DROP PROCEDURE IF EXISTS showrunner_add_column_if_missing;
