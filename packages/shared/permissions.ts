export const PERMISSIONS = {
  CONSULTATIONS_VIEW_ALL: "consultations.view_all",
  CONSULTATIONS_REPLY: "consultations.reply",
  CONSULTATIONS_ASSIGN: "consultations.assign",
  DOCUMENT_REQUESTS_RECOMMEND: "document_requests.recommend",
  DOCUMENTS_VIEW: "documents.view",
  DOCUMENT_REQUESTS_DECIDE: "document_requests.decide",
  DOCUMENTS_MANAGE: "documents.manage",
  CONTENT_MANAGE: "content.manage",
  TESTIMONIALS_APPROVE: "testimonials.approve",
  TRAINING_MANAGE: "training.manage",
  MESSAGES_VIEW: "messages.view",
  CLIENTS_VIEW_ALL: "clients.view_all",
  DATA_DELETE: "data.delete",
  TEAM_MANAGE: "team.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_KEYS = [
  "admin",
  "assistant_consultant",
  "content_editor",
  "training_coordinator",
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

/**
 * The default permissions of each seeded role (project.md §5). The seed
 * migration and its tests compare against this. At runtime, roles are data:
 * code checks a permission, never a role.
 */
export const ROLE_PERMISSIONS: Record<RoleKey, readonly Permission[]> = {
  admin: Object.values(PERMISSIONS),
  assistant_consultant: [
    PERMISSIONS.CONSULTATIONS_REPLY,
    PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND,
    PERMISSIONS.DOCUMENTS_VIEW,
    PERMISSIONS.MESSAGES_VIEW,
  ],
  content_editor: [
    PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND,
    PERMISSIONS.DOCUMENTS_VIEW,
    PERMISSIONS.CONTENT_MANAGE,
  ],
  training_coordinator: [
    PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND,
    PERMISSIONS.DOCUMENTS_VIEW,
    PERMISSIONS.TRAINING_MANAGE,
  ],
};
