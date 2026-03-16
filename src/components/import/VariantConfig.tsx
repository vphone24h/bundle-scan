import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export interface VariantLevel {
  label: string;
  values: string[];
}

export interface VariantConfig {
  enabled: boolean;
  levels: VariantLevel[];
}

interface VariantConfigProps {
  config: VariantConfig;
  onChange: (config: VariantConfig) => void;
  baseProductName: string;
}

const MAX_LEVELS = 3;

const DEFAULT_LABELS = ['Dung lượng', 'Màu sắc', 'Tình trạng'];

export function VariantConfigPanel({ config, onChange, baseProductName }: VariantConfigProps) {
  const { t } = useTranslation();
  const [newValues, setNewValues] = useState<string[]>(['', '', '']);
  const [isOpen, setIsOpen] = useState(true);

  const handleToggleEnabled = (checked: boolean) => {
    onChange({
      ...config,
      enabled: checked,
      levels: checked && config.levels.length === 0
        ? [{ label: DEFAULT_LABELS[0], values: [] }]
        : config.levels,
    });
  };

  const handleLabelChange = (levelIndex: number, label: string) => {
    const newLevels = [...config.levels];
    newLevels[levelIndex] = { ...newLevels[levelIndex], label };
    onChange({ ...config, levels: newLevels });
  };

  const handleAddValue = (levelIndex: number) => {
    const val = newValues[levelIndex]?.trim();
    if (!val) return;
    // Prevent duplicates
    if (config.levels[levelIndex].values.includes(val)) return;
    
    const newLevels = [...config.levels];
    newLevels[levelIndex] = {
      ...newLevels[levelIndex],
      values: [...newLevels[levelIndex].values, val],
    };
    onChange({ ...config, levels: newLevels });
    
    const nv = [...newValues];
    nv[levelIndex] = '';
    setNewValues(nv);
  };

  const handleRemoveValue = (levelIndex: number, valueIndex: number) => {
    const newLevels = [...config.levels];
    newLevels[levelIndex] = {
      ...newLevels[levelIndex],
      values: newLevels[levelIndex].values.filter((_, i) => i !== valueIndex),
    };
    onChange({ ...config, levels: newLevels });
  };

  const handleAddLevel = () => {
    if (config.levels.length >= MAX_LEVELS) return;
    const nextLabel = DEFAULT_LABELS[config.levels.length] || `Biến thể ${config.levels.length + 1}`;
    onChange({
      ...config,
      levels: [...config.levels, { label: nextLabel, values: [] }],
    });
  };

  const handleRemoveLevel = (levelIndex: number) => {
    const newLevels = config.levels.filter((_, i) => i !== levelIndex);
    onChange({ ...config, levels: newLevels });
  };

  const handleKeyDown = (e: React.KeyboardEvent, levelIndex: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddValue(levelIndex);
    }
  };

  // Generate preview combinations
  const getCombinationPreview = useCallback(() => {
    const activeLevels = config.levels.filter(l => l.values.length > 0);
    if (activeLevels.length === 0) return [];

    let combinations: string[][] = activeLevels[0].values.map(v => [v]);
    for (let i = 1; i < activeLevels.length; i++) {
      const newCombinations: string[][] = [];
      for (const combo of combinations) {
        for (const val of activeLevels[i].values) {
          newCombinations.push([...combo, val]);
        }
      }
      combinations = newCombinations;
    }

    return combinations.slice(0, 12).map(combo => 
      `${baseProductName} ${combo.join(' ')}`.trim()
    );
  }, [config.levels, baseProductName]);

  const previewNames = config.enabled ? getCombinationPreview() : [];
  const totalCombinations = config.levels.reduce((total, level) => {
    const count = level.values.length;
    return count > 0 ? (total === 0 ? count : total * count) : total;
  }, 0);

  return (
    <div className="space-y-3">
      {/* Toggle */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="variant-toggle"
          checked={config.enabled}
          onCheckedChange={(checked) => handleToggleEnabled(checked === true)}
        />
        <Label htmlFor="variant-toggle" className="flex items-center gap-1.5 cursor-pointer text-sm font-medium">
          <Layers className="h-4 w-4" />
          Thêm biến thể
        </Label>
      </div>

      {/* Variant Configuration */}
      {config.enabled && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="border rounded-lg bg-muted/30 overflow-hidden">
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors">
                <span className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  Cấu hình biến thể ({config.levels.length} cấp{totalCombinations > 0 ? ` • ${totalCombinations} tổ hợp` : ''})
                </span>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-4 border-t">
                {config.levels.map((level, levelIndex) => (
                  <div key={levelIndex} className="space-y-2 pt-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="shrink-0">Cấp {levelIndex + 1}</Badge>
                      <Input
                        value={level.label}
                        onChange={(e) => handleLabelChange(levelIndex, e.target.value)}
                        placeholder={`Tên biến thể cấp ${levelIndex + 1}`}
                        className="h-8 text-sm flex-1"
                      />
                      {config.levels.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive shrink-0"
                          onClick={() => handleRemoveLevel(levelIndex)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {/* Values */}
                    <div className="flex flex-wrap gap-1.5">
                      {level.values.map((val, valIndex) => (
                        <Badge key={valIndex} variant="secondary" className="gap-1 pr-1">
                          {val}
                          <button
                            onClick={() => handleRemoveValue(levelIndex, valIndex)}
                            className="ml-0.5 hover:text-destructive transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>

                    {/* Add value input */}
                    <div className="flex gap-2">
                      <Input
                        value={newValues[levelIndex] || ''}
                        onChange={(e) => {
                          const nv = [...newValues];
                          nv[levelIndex] = e.target.value;
                          setNewValues(nv);
                        }}
                        onKeyDown={(e) => handleKeyDown(e, levelIndex)}
                        placeholder={`Thêm giá trị ${level.label}...`}
                        className="h-8 text-sm flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => handleAddValue(levelIndex)}
                        disabled={!newValues[levelIndex]?.trim()}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Add level button */}
                {config.levels.length < MAX_LEVELS && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-dashed mt-2"
                    onClick={handleAddLevel}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Thêm biến thể cấp {config.levels.length + 1}
                  </Button>
                )}

                {/* Preview */}
                {previewNames.length > 0 && (
                  <div className="pt-3 border-t space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Xem trước tên sản phẩm:</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {previewNames.map((name, idx) => (
                        <p key={idx} className="text-xs text-foreground bg-background px-2 py-1 rounded">
                          {name}
                        </p>
                      ))}
                      {totalCombinations > 12 && (
                        <p className="text-xs text-muted-foreground italic">
                          ...và {totalCombinations - 12} tổ hợp khác
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}
    </div>
  );
}
