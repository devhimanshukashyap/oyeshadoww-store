"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  return (
    <button onClick={() => signOut({ callbackUrl: "/" })} className="btn-ghost">
      <LogOut size={16} />
      Log out
    </button>
  );
}
