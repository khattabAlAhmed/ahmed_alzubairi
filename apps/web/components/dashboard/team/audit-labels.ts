import { CONTENT_TYPES } from "@repo/shared";

/** `DashboardTeam.audit.actions`: labels by action group, then by name. */
export type ActionLabels = Record<string, Record<string, string>>;
/** `DashboardTeam.audit.entities` or `DashboardContent.types`. */
export type EntityLabels = Record<string, string>;

const CONTENT = new Set<string>(CONTENT_TYPES);

/**
 * An action's label in the UI language. The log is permanent, so a stored
 * action may have no label any more: it is then shown as stored.
 */
export function actionLabel(action: string, labels: ActionLabels): string {
  const dot = action.indexOf(".");
  if (dot < 0) return action;
  return labels[action.slice(0, dot)]?.[action.slice(dot + 1)] ?? action;
}

/** An entity's label: a content type's name, a table's name, or the stored text. */
export function entityLabel(
  entity: string,
  entities: EntityLabels,
  contentTypes: EntityLabels,
): string {
  if (CONTENT.has(entity) && contentTypes[entity]) return contentTypes[entity];
  return entities[entity] ?? entity;
}
