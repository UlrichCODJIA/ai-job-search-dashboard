import { useState } from "react";

export function useConfirm<T>() {
  const [armed, setArmed] = useState<T | null>(null);

  const isArmed = (id: T) => armed === id;
  const arm = (id: T) => setArmed(id);
  const disarm = () => setArmed(null);

  return { isArmed, arm, disarm };
}
