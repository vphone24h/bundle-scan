import { useState } from 'react';
import { Category } from '@/types/warehouse';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronDown, FolderOpen, Folder, Pencil, Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategoryTreeProps {
  categories: Category[];
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onAddChild: (parentId: string) => void;
}

function buildTree(categories: Category[]): Category[] {
  const map = new Map<string, Category>();
  const roots: Category[] = [];

  categories.forEach((cat) => {
    map.set(cat.id, { ...cat, children: [] });
  });

  categories.forEach((cat) => {
    const node = map.get(cat.id)!;
    if (cat.parentId) {
      const parent = map.get(cat.parentId);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function CategoryNode({
  category,
  level,
  onEdit,
  onDelete,
  onAddChild,
}: {
  category: Category;
  level: number;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onAddChild: (parentId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = category.children && category.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-muted/50 group',
          level > 0 && 'ml-6'
        )}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            'h-6 w-6 flex items-center justify-center rounded hover:bg-muted',
            !hasChildren && 'invisible'
          )}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        
        {hasChildren || level === 0 ? (
          expanded ? (
            <FolderOpen className="h-5 w-5 text-primary" />
          ) : (
            <Folder className="h-5 w-5 text-primary" />
          )
        ) : (
          <Folder className="h-5 w-5 text-muted-foreground" />
        )}

        <span className="flex-1 font-medium">{category.name}</span>

        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onAddChild(category.id)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(category)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={() => onDelete(category)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="animate-fade-in">
          {category.children!.map((child) => (
            <CategoryNode
              key={child.id}
              category={child}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoryTree({ categories, onEdit, onDelete, onAddChild }: CategoryTreeProps) {
  const tree = buildTree(categories);

  return (
    <div className="space-y-1">
      {tree.map((category) => (
        <CategoryNode
          key={category.id}
          category={category}
          level={0}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddChild={onAddChild}
        />
      ))}
      {tree.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          Chưa có danh mục nào
        </div>
      )}
    </div>
  );
}
