import type { HoverCardProps } from "metabase/ui";
import { HoverCard, useDelayGroup } from "metabase/ui";

export const POPOVER_DELAY: [number, number] = [1000, 300];
export const POPOVER_TRANSITION_DURATION = 150;

import { WidthBound, Dropdown, Target } from "./Popover.styled";

// When switching to another hover target in the same delay group,
// we don't closing immediatly but delay by a short amount to avoid flicker.
export const POPOVER_CLOSE_DELAY = 10;

export type PopoverProps = Pick<
  HoverCardProps,
  "children" | "position" | "disabled"
> & {
  delay?: [number, number];
  content: React.ReactNode;
};

export function Popover({
  position = "bottom-start",
  disabled,
  delay = POPOVER_DELAY,
  content,
  children,
}: PopoverProps) {
  const group = useDelayGroup();

  return (
    <HoverCard
      position={position}
      disabled={disabled}
      openDelay={group.shouldDelay ? delay[0] : 0}
      closeDelay={group.shouldDelay ? delay[1] : POPOVER_CLOSE_DELAY}
      onOpen={group.onOpen}
      onClose={group.onClose}
      transitionProps={{
        duration: group.shouldDelay ? POPOVER_TRANSITION_DURATION : 0,
      }}
    >
      <HoverCard.Target>{children}</HoverCard.Target>
      <Dropdown>
        {/* HACK: adds an element between the target and the card */}
        {/* to avoid the card from disappearing */}
        <Target />
        <WidthBound>{content}</WidthBound>
      </Dropdown>
    </HoverCard>
  );
}