"use client";

import AuthGate from "@/components/AuthGate";
import SessionLogger from "@/components/SessionLogger";

export default function Home() {
  return <AuthGate>{(user) => <SessionLogger uid={user.uid} />}</AuthGate>;
}
