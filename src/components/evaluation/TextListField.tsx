import React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

interface TextListFieldProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  maxItems: number;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Dynamic add/remove list of short text entries -- replaces the old
 * template's fixed 3-cell-per-category layout (D26/D27/D28 etc). The
 * exporter still only prints up to `maxItems` lines into the template, but
 * nothing in the form itself hardcodes that limit as a UI constraint beyond
 * disabling the "add" button.
 */
const TextListField: React.FC<TextListFieldProps> = ({
  label,
  values,
  onChange,
  maxItems,
  disabled,
  placeholder,
}) => {
  const items = values.length > 0 ? values : [""];

  const updateItem = (index: number, value: string) => {
    const next = [...items];
    next[index] = value;
    onChange(next);
  };

  const removeItem = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [""]);
  };

  const addItem = () => {
    onChange([...items, ""]);
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{label}</div>
      {items.map((value, index) => (
        <div key={index} className="flex gap-2">
          <Textarea
            value={value}
            onChange={(e) => updateItem(index, e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
            rows={2}
            className="flex-1"
          />
          {items.length > 1 && !disabled && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeItem(index)}
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      {!disabled && items.length < maxItems && (
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus className="mr-1 h-3 w-3" />
          Agregar
        </Button>
      )}
    </div>
  );
};

export default TextListField;
