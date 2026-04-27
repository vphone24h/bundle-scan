import { ReactNode } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

/**
 * Reusable vertical drag-and-drop sortable list.
 * Use <SortableList items={...} onReorder={...}>{(item, i) => <SortableItem id={item.id}>...</SortableItem>}</SortableList>
 * Inside the render, place <DragHandle /> where the grip should appear.
 */

interface SortableListProps<T extends { id: string }> {
  items: T[];
  onReorder: (items: T[]) => void;
  children: (item: T, index: number) => ReactNode;
  className?: string;
  disabled?: boolean;
}

export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  children,
  className,
  disabled,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  };

  if (disabled) {
    return <div className={className}>{items.map((it, i) => children(it, i))}</div>;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className={className}>{items.map((it, i) => children(it, i))}</div>
      </SortableContext>
    </DndContext>
  );
}

interface SortableItemProps {
  id: string;
  children: ReactNode | ((args: { dragHandleProps: Record<string, unknown>; isDragging: boolean }) => ReactNode);
  className?: string;
}

export function SortableItem({ id, children, className }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.85 : 1,
  };
  const dragHandleProps = { ...attributes, ...listeners };
  return (
    <div ref={setNodeRef} style={style} className={className}>
      {typeof children === 'function' ? children({ dragHandleProps, isDragging }) : children}
    </div>
  );
}

/**
 * Standalone vertical drag handle button.
 * Spread dragHandleProps from SortableItem render-prop onto this.
 */
export function DragHandle({
  dragHandleProps,
  className,
  title = 'Kéo để sắp xếp',
}: {
  dragHandleProps: Record<string, unknown>;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      {...dragHandleProps}
      className={
        className ||
        'h-8 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-grab active:cursor-grabbing touch-none shrink-0'
      }
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}