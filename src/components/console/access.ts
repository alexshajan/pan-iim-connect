import { createContext, useContext } from "react";
import type { Screen } from "@/lib/console-access";

// Lives outside the route file so split route chunks share one context instance.
export type Access = { canEdit: boolean; roles: string[]; screens: Set<Screen>; userId: string | null };
export const AccessCtx = createContext<Access>({ canEdit: false, roles: [], screens: new Set(), userId: null });
export const useConsoleAccess = () => useContext(AccessCtx);
