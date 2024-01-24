import type React from "react";
import { useState, useMemo, useEffect } from "react";
import _ from "underscore";
import type {
  DragOverEvent,
  DragStartEvent,
  Modifier,
  SensorDescriptor,
} from "@dnd-kit/core";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { SortableContext, arrayMove } from "@dnd-kit/sortable";
import { isNotNull } from "metabase/lib/types";
import { Sortable, type SortableProps } from "./Sortable";

type itemId = number | string;

interface useSortableListProps<T> {
  items: T[];
  getId: (item: T) => itemId;
  renderItem: (item: T, id?: itemId) => JSX.Element;
  onSortStart?: (event: DragStartEvent) => void;
  onSortEnd?: ({ id, newIndex }: { id: itemId; newIndex: number }) => void;
  disableSort?: boolean;
  sensors?: SensorDescriptor<any>[];
  modifiers?: Modifier[];
  sortableWrapper?: React.ComponentType<SortableProps>;
  wrapperProps?: Record<any, any>;
}

export const SortableList = <T,>({
  items,
  getId,
  renderItem,
  onSortStart,
  onSortEnd,
  disableSort = false,
  sensors = [],
  modifiers = [],
  sortableWrapper: SortableWrapper = Sortable,
  wrapperProps,
}: useSortableListProps<T>) => {
  const [itemIds, setItemIds] = useState<itemId[]>([]);
  const [indexedItems, setIndexedItems] = useState<Record<itemId, T>>({});
  const [activeItem, setActiveItem] = useState<T | null>(null);

  useEffect(() => {
    setItemIds(items.map(getId));
    setIndexedItems(_.indexBy(items, getId));
  }, [items, getId]);

  const sortableElements = useMemo(
    () =>
      itemIds
        .map(id => {
          // const item = items.find(item => getId(item) === id);
          const item = indexedItems[id];
          if (item) {
            return (
              <SortableWrapper
                id={id}
                key={`sortable-${id}`}
                disabled={disableSort}
                {...wrapperProps}
              >
                {renderItem(item, id)}
              </SortableWrapper>
            );
          }
        })
        .filter(isNotNull),
    [
      itemIds,
      renderItem,
      disableSort,
      wrapperProps,
      indexedItems,
      SortableWrapper,
    ],
  );

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (over && active.id !== over.id) {
      setItemIds(ids => {
        const oldIndex = ids.indexOf(active.id);
        const newIndex = ids.indexOf(over.id);
        return arrayMove(ids, oldIndex, newIndex);
      });
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    document.body.classList.add("grabbing");
    if (onSortStart) {
      onSortStart(event);
    }

    const item = items.find(item => getId(item) === event.active.id);
    if (item) {
      setActiveItem(item);
    }
  };

  const handleDragEnd = () => {
    document.body.classList.remove("grabbing");
    if (activeItem && onSortEnd) {
      onSortEnd({
        id: getId(activeItem),
        newIndex: itemIds.findIndex(id => id === getId(activeItem)),
      });
      setActiveItem(null);
    }
  };

  return (
    <DndContext
      onDragOver={handleDragOver}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      sensors={sensors}
      modifiers={modifiers}
    >
      <SortableContext items={itemIds}>{sortableElements}</SortableContext>
      <DragOverlay>{activeItem ? renderItem(activeItem) : null}</DragOverlay>
    </DndContext>
  );
};
