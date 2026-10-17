"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { initials } from "@/lib/initials";
import { useOnlineUsers, type Awareness } from "@/lib/presence";

const MAX_SHOWN = 5;

/** One circle per online user (you included), at most 5, then "+N". */
export function Avatars({ awareness }: { awareness: Awareness }) {
  const users = useOnlineUsers(awareness);
  const shown = users.slice(0, MAX_SHOWN);
  const hidden = users.slice(MAX_SHOWN);

  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((user) => (
        <Tooltip key={user.id}>
          <TooltipTrigger
            render={<span tabIndex={0} className="rounded-full" />}
          >
            <Avatar size="sm" className="ring-2 ring-background">
              <AvatarFallback
                className="text-[10px] font-medium text-white"
                style={{ backgroundColor: user.color }}
              >
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {user.name}
            {user.isYou && " (you)"}
          </TooltipContent>
        </Tooltip>
      ))}
      {hidden.length > 0 && (
        <Tooltip>
          <TooltipTrigger
            render={<span tabIndex={0} className="rounded-full" />}
          >
            <Avatar size="sm" className="ring-2 ring-background">
              <AvatarFallback className="text-[10px] font-medium">
                +{hidden.length}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {hidden.map((u) => u.name).join(", ")}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
