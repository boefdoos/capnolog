"use client";

import type { CartWeekTarget } from "@/lib/useCartProtocol";

export default function CartWeekBadge({ target }: { target: CartWeekTarget }) {
  return (
    <div className="panel text-center text-xs text-muted">
      Week {target.week} &middot; streef naar ongeveer {target.targetRR}/min
    </div>
  );
}
