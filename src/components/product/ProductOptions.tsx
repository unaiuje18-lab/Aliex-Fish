import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ProductOption } from '@/types/database';

interface ProductOptionsProps {
  options: ProductOption[];
}

export function ProductOptions({ options }: ProductOptionsProps) {
  // Group options by group_title
  const groupedOptions = options.reduce((acc, option) => {
    if (!acc[option.group_title]) {
      acc[option.group_title] = [];
    }
    acc[option.group_title].push(option);
    return acc;
  }, {} as Record<string, ProductOption[]>);

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
    // Select first option of each group by default
    const initial: Record<string, string> = {};
    Object.entries(groupedOptions).forEach(([group, opts]) => {
      if (opts.length > 0) {
        initial[group] = opts[0].id;
      }
    });
    return initial;
  });

  if (options.length === 0) return null;

  return (
    <div className="space-y-4">
      {Object.entries(groupedOptions).map(([groupTitle, groupOptions]) => (
        <div key={groupTitle} className="space-y-2">
          <h3 className="font-medium text-sm text-foreground">{groupTitle}</h3>
          <div className="flex flex-wrap gap-2">
            {groupOptions.map((option) => {
              const isSelected = selectedOptions[groupTitle] === option.id;
              
              return (
                <button
                  key={option.id}
                  onClick={() => setSelectedOptions(prev => ({ ...prev, [groupTitle]: option.id }))}
                  className={cn(
                    "relative flex flex-col items-center p-2 rounded-lg border-2 transition-all min-w-[70px]",
                    isSelected 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  {option.option_image_url && (
                    <div className="w-12 h-12 rounded overflow-hidden mb-1.5">
                      <img
                        src={option.option_image_url}
                        alt={option.option_label}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <span className="text-xs font-medium text-center">
                    {option.option_label}
                  </span>
                  {option.extra_text && (
                    <span className="text-[10px] text-muted-foreground text-center">
                      {option.extra_text}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
