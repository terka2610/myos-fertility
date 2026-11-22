import { useEffect, useState } from "react";

export const SYNTHETIC_ROLES = [
  "Fertility Centre",
  "Cryo Transport",
  "Cryogenic Storage",
  "Patient",
] as const;

export type SyntheticRole = (typeof SYNTHETIC_ROLES)[number];

export const SYNTHETIC_ROLE_STORAGE_KEY = "myos.synthetic-cryogenic-role";

export function isSyntheticRole(value: unknown): value is SyntheticRole {
  return typeof value === "string" && SYNTHETIC_ROLES.some((role) => role === value);
}

export function getInitialSyntheticRole(): SyntheticRole {
  if (typeof window === "undefined") return "Fertility Centre";
  const saved = window.localStorage.getItem(SYNTHETIC_ROLE_STORAGE_KEY);
  return isSyntheticRole(saved) ? saved : "Fertility Centre";
}

export function useSyntheticRole(): [SyntheticRole, (role: SyntheticRole) => void] {
  const [role, setRole] = useState<SyntheticRole>(getInitialSyntheticRole);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === SYNTHETIC_ROLE_STORAGE_KEY && isSyntheticRole(event.newValue)) {
        setRole(event.newValue);
      }
    };
    window.addEventListener("storage", handleStorage);
    const handleRole = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (isSyntheticRole(detail)) setRole(detail);
    };
    window.addEventListener("myos:synthetic-role", handleRole);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("myos:synthetic-role", handleRole);
    };
  }, []);

  const setSyntheticRole = (nextRole: SyntheticRole) => {
    window.localStorage.setItem(SYNTHETIC_ROLE_STORAGE_KEY, nextRole);
    window.dispatchEvent(new CustomEvent("myos:synthetic-role", { detail: nextRole }));
    setRole(nextRole);
  };

  return [role, setSyntheticRole];
}
