
-- DMC dump 1.0.0
-- ------------------------------------------------------

-- IF SET FOREIGN_KEY_CHECKS = 0;
SET FOREIGN_KEY_CHECKS=0;

-- ----------------------------
-- Table structure for config
-- ----------------------------

CREATE TABLE `config` (
 `id` int NOT NULL AUTO_INCREMENT,
 `config_key` varchar(100) NOT NULL COMMENT '配置键名',
 `config_value` text COMMENT '配置值(JSON格式)',
 `description` varchar(500) DEFAULT NULL COMMENT '配置描述',
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 UNIQUE KEY `config_key` (`config_key`),
 KEY `idx_config_key` (`config_key`)
) ENGINE=InnoDB AUTO_INCREMENT=195 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='系统配置表';

TRUNCATE TABLE `config`;


-- ----------------------------
-- Table structure for key_results
-- ----------------------------

CREATE TABLE `key_results` (
 `id` int NOT NULL AUTO_INCREMENT,
 `objective_id` int NOT NULL,
 `title` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
 `sort_order` int DEFAULT '0',
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 KEY `objective_id` (`objective_id`),
 CONSTRAINT `key_results_ibfk_1` FOREIGN KEY (`objective_id`) REFERENCES `objectives` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

TRUNCATE TABLE `key_results`;


-- ----------------------------
-- Table structure for kr_claims
-- ----------------------------

CREATE TABLE `kr_claims` (
 `id` int NOT NULL AUTO_INCREMENT,
 `kr_id` int NOT NULL,
 `objective_id` int NOT NULL,
 `user_eng_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 `user_chn_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 `claimed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 KEY `kr_id` (`kr_id`),
 KEY `objective_id` (`objective_id`),
 CONSTRAINT `kr_claims_ibfk_1` FOREIGN KEY (`kr_id`) REFERENCES `key_results` (`id`) ON DELETE CASCADE,
 CONSTRAINT `kr_claims_ibfk_2` FOREIGN KEY (`objective_id`) REFERENCES `objectives` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

TRUNCATE TABLE `kr_claims`;


-- ----------------------------
-- Table structure for next_week_plan
-- ----------------------------

CREATE TABLE `next_week_plan` (
 `id` int NOT NULL AUTO_INCREMENT,
 `user_kr_id` int NOT NULL,
 `user_eng_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 `user_chn_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 `estimated_man_days` decimal(10,2) DEFAULT '0.00' COMMENT '预计本周占用人天',
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 UNIQUE KEY `unique_user_kr` (`user_kr_id`,`user_eng_name`),
 KEY `idx_user_kr_id` (`user_kr_id`),
 KEY `idx_user_eng_name` (`user_eng_name`)
) ENGINE=InnoDB AUTO_INCREMENT=141 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='下周计划表';

TRUNCATE TABLE `next_week_plan`;


-- ----------------------------
-- Table structure for objectives
-- ----------------------------

CREATE TABLE `objectives` (
 `id` int NOT NULL AUTO_INCREMENT,
 `title` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
 `sort_order` int DEFAULT '0',
 `created_by` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 `obj_type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '业务' COMMENT '目标类型：业务、管理、专业',
 `weight` int DEFAULT '0' COMMENT '权重（百分比）',
 PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

TRUNCATE TABLE `objectives`;


-- ----------------------------
-- Table structure for overall_progress
-- ----------------------------

CREATE TABLE `overall_progress` (
 `id` int NOT NULL AUTO_INCREMENT,
 `user_kr_id` int NOT NULL,
 `user_eng_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 `user_chn_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 UNIQUE KEY `unique_kr_user` (`user_kr_id`,`user_eng_name`),
 CONSTRAINT `overall_progress_ibfk_1` FOREIGN KEY (`user_kr_id`) REFERENCES `user_key_results` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

TRUNCATE TABLE `overall_progress`;


-- ----------------------------
-- Table structure for platforms
-- ----------------------------

CREATE TABLE `platforms` (
 `id` int NOT NULL AUTO_INCREMENT,
 `name` varchar(255) NOT NULL COMMENT '平台名称',
 `url` varchar(1000) NOT NULL COMMENT '平台链接',
 `description` text COMMENT '平台说明',
 `thumbnail` varchar(1000) DEFAULT NULL COMMENT '缩略图URL',
 `tags` json DEFAULT NULL COMMENT '标签列表',
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
 `category` varchar(50) NOT NULL DEFAULT '实用工具' COMMENT '分类：文档知识、实用工具、需求相关',
 `added_by_eng_name` varchar(255) DEFAULT NULL,
 `added_by_chn_name` varchar(255) DEFAULT NULL,
 PRIMARY KEY (`id`),
 KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='平台信息表';

TRUNCATE TABLE `platforms`;


-- ----------------------------
-- Table structure for team_reports
-- ----------------------------

CREATE TABLE `team_reports` (
 `id` int NOT NULL AUTO_INCREMENT,
 `permalink` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
 `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
 `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
 `created_by` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 UNIQUE KEY `permalink` (`permalink`),
 KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

TRUNCATE TABLE `team_reports`;


-- ----------------------------
-- Table structure for team_weekly_reports
-- ----------------------------

CREATE TABLE `team_weekly_reports` (
 `id` int NOT NULL AUTO_INCREMENT,
 `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
 `content` text COLLATE utf8mb4_unicode_ci,
 `created_by` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
 `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
 `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

TRUNCATE TABLE `team_weekly_reports`;


-- ----------------------------
-- Table structure for todo_progress
-- ----------------------------

CREATE TABLE `todo_progress` (
 `id` int NOT NULL AUTO_INCREMENT,
 `todo_id` int NOT NULL,
 `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 `created_by` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 KEY `todo_id` (`todo_id`),
 CONSTRAINT `todo_progress_ibfk_1` FOREIGN KEY (`todo_id`) REFERENCES `todos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

TRUNCATE TABLE `todo_progress`;


-- ----------------------------
-- Table structure for todos
-- ----------------------------

CREATE TABLE `todos` (
 `id` int NOT NULL AUTO_INCREMENT,
 `title` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
 `assignee_eng_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 `assignee_chn_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
 `created_by` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 KEY `idx_assignee` (`assignee_eng_name`),
 KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

TRUNCATE TABLE `todos`;


-- ----------------------------
-- Table structure for user_key_results
-- ----------------------------

CREATE TABLE `user_key_results` (
 `id` int NOT NULL AUTO_INCREMENT,
 `user_objective_id` int NOT NULL,
 `user_eng_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 `title` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
 `risks_issues` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '风险和问题',
 `sort_order` int DEFAULT NULL,
 `source_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 `source_kr_id` int DEFAULT NULL,
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 KEY `user_objective_id` (`user_objective_id`),
 KEY `idx_user` (`user_eng_name`),
 CONSTRAINT `user_key_results_ibfk_1` FOREIGN KEY (`user_objective_id`) REFERENCES `user_objectives` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

TRUNCATE TABLE `user_key_results`;


-- ----------------------------
-- Table structure for user_objectives
-- ----------------------------

CREATE TABLE `user_objectives` (
 `id` int NOT NULL AUTO_INCREMENT,
 `user_eng_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 `title` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
 `obj_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '业务',
 `weight` int DEFAULT '0',
 `sort_order` int DEFAULT NULL,
 `source_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 `source_id` int DEFAULT NULL,
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 KEY `idx_user` (`user_eng_name`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

TRUNCATE TABLE `user_objectives`;


-- ----------------------------
-- Table structure for weekly_progress
-- ----------------------------

CREATE TABLE `weekly_progress` (
 `id` int NOT NULL AUTO_INCREMENT,
 `user_kr_id` int NOT NULL,
 `user_eng_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 `user_chn_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 KEY `user_kr_id` (`user_kr_id`),
 CONSTRAINT `weekly_progress_ibfk_1` FOREIGN KEY (`user_kr_id`) REFERENCES `user_key_results` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=82 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

TRUNCATE TABLE `weekly_progress`;


-- IF SET FOREIGN_KEY_CHECKS = 0;
SET FOREIGN_KEY_CHECKS=1;
