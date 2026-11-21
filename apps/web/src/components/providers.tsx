"use client";

import React, { useRef } from "react";
import { Provider } from "react-redux";
import { createTestStore } from "@/lib/store";

export function Providers({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<ReturnType<typeof createTestStore>>(null);
  if (!storeRef.current) {
    storeRef.current = createTestStore();
  }

  return <Provider store={storeRef.current}>{children}</Provider>;
}
