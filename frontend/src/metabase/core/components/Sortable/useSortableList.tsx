import { useState, useMemo, useEffect } from "react";
import type {
  DragOverEvent,
  DragStartEvent,
  Modifier,
  SensorDescriptor,
} from "@dnd-kit/core";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { SortableContext, arrayMove } from "@dnd-kit/sortable";
import { Sortable } from "./Sortable";

interface useSortableListProps<T> {
  items: T[];
  getId: (item: T) => string;
  renderItem: (item: T) => JSX.Element;
  onSortStart: (event: DragStartEvent) => void;
  onSortEnd: ({ id, newIndex }: { id: string; newIndex: number }) => void;
  disableSort?: boolean;
  sensors?: SensorDescriptor<any>[];
  modifiers?: Modifier[];
}

export function useSortableList<T>({
  items,
  getId,
  renderItem,
  onSortStart,
  onSortEnd,
  disableSort = false,
  sensors = [],
  modifiers = [],
}: useSortableListProps<T>) {
  const [itemIds, setItemIds] = useState<any[]>([]);
  const [activeItem, setActiveItem] = useState<T | null>(null);

  useEffect(() => {
    setItemIds(items.map(getId));
  }, [items, getId]);

  const sortableElements = useMemo(
    () =>
      itemIds.map(id => {
        const item = items.find(item => getId(item) === id);
        if (item) {
          return (
            <Sortable id={id} key={`sortable-${id}`} disabled={disableSort}>
              {renderItem(item)}
            </Sortable>
          );
        }
      }),
    [itemIds, items, renderItem, disableSort, getId],
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
    onSortStart(event);
    const item = items.find(item => getId(item) === event.active.id);
    if (item) {
      setActiveItem(item);
    }
  };

  const handleDragEnd = () => {
    if (activeItem) {
      onSortEnd({
        id: getId(activeItem),
        newIndex: itemIds.findIndex(id => id === getId(activeItem)),
      });
      setActiveItem(null);
    }
  };

  const sortableList = (
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

  return {
    sortableList,
  };
}
