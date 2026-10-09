import { requirePageAccess } from "@/lib/auth";
import { MD_MANAGE_ROLES } from "@/lib/types";
import { getDesk } from "@/lib/data/desk";
import { lagosToday } from "@/lib/periods";
import { FundingClient } from "./funding-client";

export default async function FundingPage({ searchParams }: { searchParams: { job?: string } }) {
  const session = await requirePageAccess("/funding");
  const { jobs } = await getDesk();
  // Finance officers named before, to pick from.
  const officers = [...new Set(jobs.flatMap((j) => (j.funding?.tx ?? []).map((x) => x.finance_officer).filter(Boolean) as string[]))];
  return (
    <FundingClient
      jobs={jobs.filter((j) => !j.void)}
      officers={officers}
      canManage={MD_MANAGE_ROLES.includes(session.role)}
      today={lagosToday()}
      initialJob={searchParams.job ?? ""}
    />
  );
}
