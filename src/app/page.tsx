"use client";

import type { User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import AuthGate from "@/components/AuthGate";
import Loading from "@/components/Loading";
import SessionLogger from "@/components/SessionLogger";
import { useRole } from "@/lib/useRole";

/** Een begeleider die geen admin is, oefent niet zelf: meteen naar Begeleiding. */
function HomeInner({ user }: { user: User }) {
  const router = useRouter();
  const { isCoach, isAdmin, loading } = useRole(user.uid);
  const coachOnly = isCoach && !isAdmin;
  useEffect(() => {
    if (coachOnly) router.replace("/begeleiding");
  }, [coachOnly, router]);
  if (loading || coachOnly) return <Loading fullScreen />;
  return <SessionLogger uid={user.uid} />;
}

export default function Home() {
  return <AuthGate>{(user) => <HomeInner user={user} />}</AuthGate>;
}
