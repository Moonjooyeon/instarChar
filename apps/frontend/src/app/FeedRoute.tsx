import React from "react";
import { FeedComposer } from "@/app/feed/FeedComposer";
import { FeedProfilePanel } from "@/app/feed/FeedProfilePanel";
import { FeedTimeline } from "@/app/feed/FeedTimeline";

export function FeedRoute({ ctx }) {
  const { canUseApp, step } = ctx;
  return (
    <>
      {canUseApp && step === "feed" && (
        <div className="al-phone">
          <FeedProfilePanel ctx={ctx} />
          <FeedComposer ctx={ctx} />
          <FeedTimeline ctx={ctx} />
        </div>
      )}
    </>
  );
}
