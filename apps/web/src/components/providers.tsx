"use client";

import React, { useState } from "react";
import { Provider } from "react-redux";
import { createTestStore } from "@/lib/store";

export function Providers({ children }: { children: React.ReactNode }) {
  const [store] = useState(() => createTestStore());

  return <Provider store={store}>{children}</Provider>;
}
