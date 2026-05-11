'use client';

import type { Recipe } from '@/types/api';
import { RecipeFormDialog } from '../dietitian/RecipeFormDialog';

interface AdminRecipeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: Recipe | null;
  token: string;
  onSaved: () => void;
}

export function AdminRecipeFormDialog(props: AdminRecipeFormDialogProps) {
  return (
    <RecipeFormDialog
      {...props}
      translationNamespace="admin.recipes"
      apiNamespace="adminRecipes"
      cleanProductNamespace="adminCleanProducts"
    />
  );
}
