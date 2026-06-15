"use client";

import IdentityContractPanel from "@/components/identity/IdentityContractPanel";
import { PageHeader } from "@/components/grc/Primitives";

export default function DeveloperIdentityPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Identity Contract"
        description="Verify the current user source, topbar initials, actor value, and write-stamp fields."
      />
      <IdentityContractPanel />
    </div>
  );
}
