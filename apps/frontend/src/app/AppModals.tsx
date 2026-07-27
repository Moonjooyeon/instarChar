import React from "react";
import { AccountModals } from "@/app/modals/AccountModals";
import { DmSetupModals } from "@/app/modals/DmSetupModals";
import { PersonaFixModals } from "@/app/modals/PersonaFixModals";
import { PublicFollowModals } from "@/app/modals/PublicFollowModals";
import { SafetyModals } from "@/app/modals/SafetyModals";

export function AppModals({ ctx }) {
  return (
    <>
      <AccountModals ctx={ctx} />
      <PublicFollowModals ctx={ctx} />
      <DmSetupModals ctx={ctx} />
      <PersonaFixModals ctx={ctx} />
      <SafetyModals ctx={ctx} />
    </>
  );
}
