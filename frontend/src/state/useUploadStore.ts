import { create } from "zustand";
import type { UserDatasetInfo } from "../types/ocean";
import * as api from "../api/client";
import { useDataStore } from "./useDataStore";
import { useOceanStore } from "./useOceanStore";

interface UploadState {
  userDatasets: UserDatasetInfo[];
  userDataOpen: boolean;
  userDataLoading: boolean;
  userDataError: string | null;

  openUserData: () => Promise<void>;
  closeUserData: () => void;
  uploadUserData: (file: File) => Promise<void>;
  deleteUserData: (index: number) => Promise<void>;
  loadUserField: (index: number, variable: string) => Promise<void>;
}

export const useUploadStore = create<UploadState>((set) => ({
  userDatasets: [],
  userDataOpen: false,
  userDataLoading: false,
  userDataError: null,

  openUserData: async () => {
    set({ userDataOpen: true, userDataError: null });
    try {
      const userDatasets = await api.listUserData();
      set({ userDatasets });
    } catch {
      // list stays empty — the upload buttons still work
    }
  },

  closeUserData: () =>
    set({ userDataOpen: false, userDataError: null }),

  uploadUserData: async (file) => {
    set({ userDataLoading: true, userDataError: null });
    try {
      const uploaded = await api.uploadUserData(file);
      set((s) => ({
        userDatasets: [...s.userDatasets.filter((d) => d.index !== uploaded.index), uploaded],
        userDataLoading: false,
      }));
    } catch (err) {
      set({
        userDataError: err instanceof Error ? err.message : "Upload failed",
        userDataLoading: false,
      });
      throw err;
    }
  },

  deleteUserData: async (index) => {
    try {
      await api.deleteUserData(index);
      set((s) => ({ userDatasets: s.userDatasets.filter((d) => d.index !== index) }));
    } catch {
      // keep the entry; user can retry or close the modal
    }
  },

  loadUserField: async (index, variable) => {
    set({ userDataLoading: true, userDataError: null });
    try {
      const field = await api.getUserDataField({ index, variable });
      const name = variable.toLowerCase();
      let colorscale = "thermal";
      if (name.includes("salinity")) colorscale = "viridis";
      else if (name.includes("chlorophyll")) colorscale = "chlorophyll";
      else if (name.includes("current") || name.includes("velocity")) colorscale = "rdbu";
      else if (name.includes("temperature") || name.includes("temp")) colorscale = "thermal";

      useDataStore.setState({ field, fieldLoading: false, fieldError: null });
      useOceanStore.setState({ variable, colorscale });
    } catch (err) {
      useDataStore.setState({
        fieldError: err instanceof Error ? err.message : "Failed to load data",
        fieldLoading: false,
      });
    }
  },
}));
