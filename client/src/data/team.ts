import type { DictKey } from "@/lib/i18n/en";

/** Team OP, who built AstroBlink. Names are shown as written; roles come from the dictionaries. */
export const TEAM_NAME = "Team OP";

export const TEAM: readonly { name: string; roles: readonly DictKey[] }[] = [
  { name: "Md. Fatin Shadab Turja", roles: ["team.role.builder"] },
  { name: "Naeem Abdullah Sadik", roles: ["team.role.builder"] },
  { name: "Abdullah Shahriar", roles: ["team.role.builder", "team.role.presenter"] },
  { name: "Ritu Datta", roles: ["team.role.data", "team.role.video"] },
  { name: "MD. Shahed Khan", roles: ["team.role.designer"] },
  { name: "Tahsin Faiyaz", roles: ["team.role.builder"] },
];
