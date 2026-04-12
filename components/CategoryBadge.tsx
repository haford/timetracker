import type { Category } from "@/lib/types";

interface CategoryBadgeProps {
  category?: Category;
  small?: boolean;
}

export function CategoryBadge({ category, small }: CategoryBadgeProps) {
  if (!category) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium ${small ? "text-xs" : "text-sm"}`}
      style={{ backgroundColor: category.color + "22", color: category.color }}
    >
      <span
        className="inline-block rounded-full"
        style={{ width: small ? 6 : 8, height: small ? 6 : 8, backgroundColor: category.color }}
      />
      {category.name}
    </span>
  );
}
