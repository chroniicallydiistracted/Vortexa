import { create } from 'zustand';

export type Layer = { id: string; templateRaw: string; opacity?: number };
type Store = {
  layers: Layer[];
  time: string; // ISO date/time or date (YYYY-MM-DD)
  addLayer: (l: Layer)=>void;
  removeLayer: (id: string)=>void;
  setTime: (iso: string)=>void;
  setOpacity: (id: string, opacity: number)=>void;
};

export const useStore = create<Store>((set)=> ({
  layers: [],
  time: new Date().toISOString().slice(0,10), // default to today (YYYY-MM-DD)
  addLayer: (l)=> set(s => ({ layers: [...s.layers, l]})),
  removeLayer: (id)=> set(s => ({ layers: s.layers.filter(x=>x.id!==id)})),
  setTime: (iso)=> set({ time: iso }),
  setOpacity: (id, opacity) => set(s=> ({ layers: s.layers.map(x=> x.id===id? { ...x, opacity } : x)}))
}));
