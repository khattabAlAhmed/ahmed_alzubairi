import { z } from "zod";
import { CONTENT_TYPES } from "./content";

/**
 * Every `audit_log.action` the app writes. The strings are stored, so a value
 * here never changes: add a new one instead.
 */
export const AUDIT_ACTIONS = [
  // Phase 2
  "content.publish",
  "content.unpublish",
  "content.edit",
  "approval.grant",
  "approval.withdraw",
  "settings.update",
  // Phase 3
  "team.invite",
  "team.role_change",
  "team.disable",
  "team.enable",
  "role.create",
  "role.update",
  "client.disable",
  "client.enable",
  "account.disable",
  "email_template.update",
] as const;

export const auditActionSchema = z.enum(AUDIT_ACTIONS);

export type AuditAction = z.infer<typeof auditActionSchema>;

/**
 * Every `audit_log.entity` the app writes: the table the action touched. Team,
 * client and account actions are on `profiles`.
 */
export const AUDIT_ENTITIES = [
  ...CONTENT_TYPES,
  "site_settings",
  "profiles",
  "roles",
  "email_templates",
] as const;

export const auditEntitySchema = z.enum(AUDIT_ENTITIES);

export type AuditEntity = z.infer<typeof auditEntitySchema>;
