import { configureStore, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { VideoMetadata, DownloadProgress, HistoryItem, UserProfile } from "./types";

export interface VideoState {
  currentUrl: string;
  metadata: VideoMetadata | null;
  progress: DownloadProgress | null;
  isDownloading: boolean;
  history: HistoryItem[];
}

export interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
}

const initialVideoState: VideoState = {
  currentUrl: "",
  metadata: null,
  progress: null,
  isDownloading: false,
  history: [],
};

const initialAuthState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
};

export const videoSlice = createSlice({
  name: "video",
  initialState: initialVideoState,
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

export const authSlice = createSlice({
  name: "auth",
  initialState: initialAuthState,
  reducers: {
    setAuthUser: (state, action: PayloadAction<{ user: UserProfile; token: string }>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
    },
    updateUserProfile: (state, action: PayloadAction<UserProfile>) => {
      state.user = action.payload;
    },
    logoutUser: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
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

export const {
  setAuthUser,
  updateUserProfile,
  logoutUser,
} = authSlice.actions;

export function createTestStore(
  preloadedState?:
    | { video?: Partial<VideoState>; auth?: Partial<AuthState> }
    | Partial<VideoState>
) {
  let videoPreloaded: VideoState | undefined;
  let authPreloaded: AuthState | undefined;

  if (preloadedState) {
    if ("video" in preloadedState || "auth" in preloadedState) {
      const complex = preloadedState as { video?: Partial<VideoState>; auth?: Partial<AuthState> };
      if (complex.video) videoPreloaded = { ...initialVideoState, ...complex.video };
      if (complex.auth) authPreloaded = { ...initialAuthState, ...complex.auth };
    } else {
      videoPreloaded = { ...initialVideoState, ...(preloadedState as Partial<VideoState>) };
    }
  }

  return configureStore({
    reducer: {
      video: videoSlice.reducer,
      auth: authSlice.reducer,
    },
    preloadedState: {
      video: videoPreloaded || initialVideoState,
      auth: authPreloaded || initialAuthState,
    },
  });
}

export type RootState = ReturnType<ReturnType<typeof createTestStore>["getState"]>;
export type AppDispatch = ReturnType<typeof createTestStore>["dispatch"];


