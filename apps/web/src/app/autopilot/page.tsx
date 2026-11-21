"use client";

import React from "react";
import { PageShell } from "@/components/page-shell";
import { AutopilotDashboard } from "@/components/autopilot-dashboard";

export default function AutopilotPage() {
  return (
    <PageShell activeTab="autopilot">
      {({ onOpenAuth }) => (
        <div className="w-full flex flex-col items-center">
          <AutopilotDashboard onOpenAuth={onOpenAuth} />
        </div>
      )}
    </PageShell>
  );
}
