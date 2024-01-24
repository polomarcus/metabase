import type { ElementType, ReactNode, CSSProperties } from "react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SortableDiv } from "./Sortable.styled";

export interface SortableProps {
  id: UniqueIdentifier;
  as?: ElementType;
  children: ReactNode;
  disabled?: boolean;
  draggingStyle?: CSSProperties;
}

/**
 * Wrapper to use with dnd-kit's Sortable preset
 * https://docs.dndkit.com/presets/sortable
 */
function _Sortable({
  id,
  as = "div",
  children,
  disabled = false,
  draggingStyle,
}: SortableProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled,
  });

  return (
    <SortableDiv
      style={isDragging ? draggingStyle : {}}
      as={as}
      transform={CSS.Transform.toString(transform)}
      transition={transition}
      isDragging={isDragging}
      ref={setNodeRef}
      {...attributes}
      {...listeners}
    >
      {children}
    </SortableDiv>
  );
}

export const Sortable = Object.assign(_Sortable, {
  Div: SortableDiv,
});
