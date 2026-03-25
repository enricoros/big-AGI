export function shouldAutoDisarmDeleteArm(args: {
  deleteArmed: boolean;
  isActive: boolean;
  wasActive: boolean;
}) {
  const { deleteArmed, isActive, wasActive } = args;
  return deleteArmed && wasActive && !isActive;
}
