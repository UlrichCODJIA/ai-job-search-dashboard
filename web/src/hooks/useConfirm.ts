import { useState } from "react";

/** The "click once to arm as 'Confirm?', click again to actually act, reset on
 * success" state machine shared by delete buttons across the dashboard (e.g.
 * Profile.tsx's document delete, Salary.tsx's company delete). `id` identifies
 * whichever row/item a given button belongs to, so only that one button shows
 * the armed "Confirm?" state at a time. */
export function useConfirm<T>() {
  const [armed, setArmed] = useState<T | null>(null);

  const isArmed = (id: T) => armed === id;
  const arm = (id: T) => setArmed(id);
  const disarm = () => setArmed(null);

  return { isArmed, arm, disarm };
}
