import { configureStore, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { VideoMetadata, DownloadProgress, HistoryItem } from "./types";

interface VideoState {
  currentUrl: string;
  metadata: VideoMetadata | null;
  progress: DownloadProgress | null;
  isDownloading: boolean;
  history: HistoryItem[];
}

const initialState: VideoState = {
  currentUrl: "",
  metadata: null,
  progress: null,
  isDownloading: false,
  history: [],
};

export const videoSlice = createSlice({
  name: "video",
  initialState,
  reducers: {
    setCurrentUrl: (state, action: PayloadAction<string>) => {
      state.currentUrl = action.payload;
    },
    setMetadata: (state, action: PayloadAction<VideoMetadata | null>) => {
      state.metadata = action.payload;
    },
    setProgress: (state, action: PayloadAction<DownloadProgress | null>) => {
      state.progress = action.payload;
    },
    setIsDownloading: (state, action: PayloadAction<boolean>) => {
      state.isDownloading = action.payload;
    },
    addHistoryItem: (state, action: PayloadAction<HistoryItem>) => {
      state.history.unshift(action.payload);
    },
    clearAllHistory: (state) => {
      state.history = [];
    },
    removeHistoryItem: (state, action: PayloadAction<string>) => {
      state.history = state.history.filter((item) => item.id !== action.payload);
    },
  },
});

export const {
  setCurrentUrl,
  setMetadata,
  setProgress,
  setIsDownloading,
  addHistoryItem,
  clearAllHistory,
  removeHistoryItem,
} = videoSlice.actions;

export function createTestStore(preloadedState?: Partial<VideoState>) {
  return configureStore({
    reducer: {
      video: videoSlice.reducer,
    },
    preloadedState: preloadedState ? { video: { ...initialState, ...preloadedState } } : undefined,
  });
}

export type RootState = ReturnType<ReturnType<typeof createTestStore>["getState"]>;
export type AppDispatch = ReturnType<typeof createTestStore>["dispatch"];

