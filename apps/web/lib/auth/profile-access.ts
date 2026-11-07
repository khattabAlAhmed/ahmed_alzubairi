/** The columns the page gates read from the user's own `profiles` row. */
export type ProfileAccess = {
  role_id: string | null;
  status: string;
};

/**
 * The dashboard is for team members: a profile with a role that isn't
 * disabled. It never checks which role; each action checks its own permission.
 */
export function canOpenDashboard(profile: ProfileAccess | null) {
  return profile !== null && profile.role_id !== null && profile.status === "active";
}
