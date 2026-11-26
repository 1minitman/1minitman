import { boolean, integer, jsonb, numeric, pgTable, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { TIMESTAMPTZ } from './types';

// Schema section 18 (platform config). Constraints, indexes and foreign keys are owned by the
// SQL migrations; models carry only what queries need: names, types, nullability, defaults.

/** Admin-tunable values (daily caps, intro window, ...). Public ones are served by GET /v1/config. */
export const remoteConfig = pgTable('remote_config', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  valueType: text('value_type').$type<'int' | 'number' | 'bool' | 'string' | 'json'>().notNull(),
  description: text().notNull(),
  isPublic: boolean('is_public').notNull().default(false),
  sourceRef: text('source_ref'),
  version: integer().notNull().default(1),
  approvalId: uuid('approval_id'),
  updatedBy: uuid('updated_by'),
  updatedAt: timestamp('updated_at', TIMESTAMPTZ).notNull().defaultNow(),
  permissionKey: text('permission_key').notNull().default('config.remote'),
  minValue: numeric('min_value'),
  maxValue: numeric('max_value'),
  unit: text(),
  groupKey: text('group_key'),
});

/** Feature flags and kill switches (offers.enabled, calls.enabled, ...). */
export const featureFlags = pgTable('feature_flags', {
  key: text().primaryKey(),
  description: text().notNull(),
  enabled: boolean().notNull().default(false),
  rolloutPercent: smallint('rollout_percent').notNull().default(0),
  rules: jsonb().notNull().default({}),
  isKillSwitch: boolean('is_kill_switch').notNull().default(false),
  approvalId: uuid('approval_id'),
  updatedBy: uuid('updated_by'),
  updatedAt: timestamp('updated_at', TIMESTAMPTZ).notNull().defaultNow(),
});

/**
 * Rate-limit policies [TR §13.3]: 15 seeded rows, loaded by the API at start and on change.
 * Production changes need an approved `security.rate_limits` approval (enforce_config_approval).
 */
export const rateLimitPolicies = pgTable('rate_limit_policies', {
  key: text().primaryKey(),
  scope: text().$type<'ip' | 'device' | 'account' | 'phone' | 'email' | 'account_ip'>().notNull(),
  maxRequests: integer('max_requests').notNull(),
  windowSeconds: integer('window_seconds').notNull(),
  lockoutSeconds: integer('lockout_seconds'),
  algorithm: text()
    .$type<'sliding_window' | 'token_bucket' | 'fixed_window'>()
    .notNull()
    .default('sliding_window'),
  appliesTo: text('applies_to').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  description: text().notNull(),
  approvalId: uuid('approval_id'),
  updatedBy: uuid('updated_by'),
  updatedAt: timestamp('updated_at', TIMESTAMPTZ).notNull().defaultNow(),
});
