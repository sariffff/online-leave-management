import { create } from "zustand";

type InboxState = {
  filteredCount: number;
  setFilteredCount: (n: number) => void;
  reset: () => void;
};

export const useInboxStore = create<InboxState>((set) => ({
  filteredCount: 0,
  setFilteredCount: (n) => set({ filteredCount: n }),
  reset: () => set({ filteredCount: 0 }),
}));
