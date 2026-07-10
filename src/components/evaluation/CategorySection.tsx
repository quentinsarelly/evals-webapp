import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import RatingInput from "./RatingInput";
import TextListField from "./TextListField";
import { Category } from "@/lib/types";
import { CATEGORY_DESCRIPTIONS } from "@/lib/categoryDescriptions";

export interface CategoryFormValue {
  rating: number | null;
  wins: string[];
  areasOfOpportunity: string[];
}

interface CategorySectionProps {
  category: Category;
  value: CategoryFormValue;
  onChange: (value: CategoryFormValue) => void;
  disabled?: boolean;
}

const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  value,
  onChange,
  disabled,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{category.labelEs}</CardTitle>
        {CATEGORY_DESCRIPTIONS[category.key] && (
          <p className="text-sm text-muted-foreground">
            {CATEGORY_DESCRIPTIONS[category.key]}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-sm font-medium mb-2">Evaluación (1-6)</div>
          <RatingInput
            name={category.key}
            value={value.rating}
            onChange={(rating) => onChange({ ...value, rating })}
            disabled={disabled}
          />
        </div>

        <Separator />

        <TextListField
          label="Logros"
          values={value.wins}
          onChange={(wins) => onChange({ ...value, wins })}
          maxItems={category.maxWins}
          disabled={disabled}
          placeholder="Comparte un ejemplo observable..."
        />

        <TextListField
          label="Áreas de oportunidad"
          values={value.areasOfOpportunity}
          onChange={(areasOfOpportunity) => onChange({ ...value, areasOfOpportunity })}
          maxItems={category.maxAreas}
          disabled={disabled}
          placeholder="Comparte un ejemplo observable..."
        />
      </CardContent>
    </Card>
  );
};

export default CategorySection;
