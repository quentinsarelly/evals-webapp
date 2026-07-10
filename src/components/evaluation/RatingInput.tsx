import React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { RATING_LABELS } from "@/lib/categoryDescriptions";

interface RatingInputProps {
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
  name: string;
}

const RatingInput: React.FC<RatingInputProps> = ({ value, onChange, disabled, name }) => {
  return (
    <RadioGroup
      value={value ? String(value) : undefined}
      onValueChange={(v) => onChange(Number(v))}
      disabled={disabled}
      className="grid grid-cols-2 sm:grid-cols-3 gap-2"
    >
      {[1, 2, 3, 4, 5, 6].map((score) => {
        const id = `${name}-${score}`;
        return (
          <div
            key={score}
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
              value === score && "border-primary bg-primary/5"
            )}
          >
            <RadioGroupItem value={String(score)} id={id} />
            <Label htmlFor={id} className="flex-1 cursor-pointer font-normal">
              {score}. {RATING_LABELS[score]}
            </Label>
          </div>
        );
      })}
    </RadioGroup>
  );
};

export default RatingInput;
