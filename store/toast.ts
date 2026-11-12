import { create } from 'zustand';

interface ToastState {
  title: string | null;
  body: string | null;
  show: (title: string, body?: string) => void;
  hide: () => void;
}
let timer: ReturnType<typeof setTimeout> | undefined;

export const useToast = create<ToastState>((set) => ({
  title: null,
  body: null,
  show: (title, body) => {
    clearTimeout(timer);
    set({ title, body: body ?? null });
    timer = setTimeout(() => set({ title: null, body: null }), 3500);
  },
  hide: () => set({ title: null, body: null }),
}));
