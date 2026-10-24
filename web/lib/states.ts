// The names of the flow's states that can be opened directly, on preview
// builds, from the /states page. Kept in a plain file (not in the component)
// because both a server page and a browser component read the list.
export const STATE_NAMES = [
  "file-added",
  "bad-file-scan",
  "bad-file-big",
  "running",
  "running-fast",
  "done",
  "done-question",
  "error",
  "limited",
  "limited-visitor",
  "paused",
] as const;

export type StateName = (typeof STATE_NAMES)[number];
