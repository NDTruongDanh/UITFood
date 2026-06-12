import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Info, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateMenuItemHeader } from '@/features/menu/components/create/CreateMenuItemHeader';
import { ProductEssenceCard } from '@/features/menu/components/create/ProductEssenceCard';
import { DietaryTagsCard } from '@/features/menu/components/create/DietaryTagsCard';
import { MediaUploadCard } from '@/features/menu/components/create/MediaUploadCard';
import { MarketVisibilityCard } from '@/features/menu/components/create/MarketVisibilityCard';
import { ModifiersCard } from '@/features/menu/components/create/ModifiersCard';
import { NutritionAssistantCard } from '@/features/menu/components/create/NutritionAssistantCard';
import { CreateMenuItemFooter } from '@/features/menu/components/create/CreateMenuItemFooter';
import {
  createMenuItemSchema,
  type CreateMenuItemFormValues,
} from '@/features/menu/schemas/menu.schema';
import {
  useCreateMenuItem,
  useUpdateMenuItem,
} from '@/features/menu/hooks/useMenuMutations';
import { useMenuCategories } from '@/features/menu/hooks/useMenu';
import { useMyRestaurant } from '@/features/restaurant/hooks/useRestaurants';
import type { MenuItem } from '@/features/menu/types';

export default function CreateMenuItemPage() {
  const navigate = useNavigate();
  const [savedItem, setSavedItem] = useState<MenuItem | null>(null);
  const { data: restaurant, isLoading: restaurantLoading } = useMyRestaurant();
  const restaurantId = restaurant?.id;

  const { data: categories = [] } = useMenuCategories(restaurantId);
  const {
    mutate: createItem,
    isPending: createPending,
    error: createError,
  } = useCreateMenuItem(restaurantId ?? '');
  const {
    mutate: updateItem,
    isPending: updatePending,
    error: updateError,
  } = useUpdateMenuItem(restaurantId ?? '');

  const methods = useForm<CreateMenuItemFormValues>({
    resolver: zodResolver(createMenuItemSchema),
    defaultValues: {
      name: '',
      description: '',
      sku: '',
      imageUrl: '',
      tags: [],
    },
  });

  const onSubmit = (values: CreateMenuItemFormValues) => {
    if (!restaurantId) return;

    const itemFields = {
      name: values.name,
      price: values.price,
      categoryId: values.categoryId || undefined,
      description: values.description || undefined,
      sku: values.sku || undefined,
      imageUrl: values.imageUrl || undefined,
      tags: values.tags,
    };

    if (savedItem) {
      updateItem(
        {
          id: savedItem.id,
          dto: itemFields,
        },
        { onSuccess: (item) => setSavedItem(item) },
      );
      return;
    }

    createItem(
      {
        restaurantId,
        ...itemFields,
      },
      { onSuccess: (item) => setSavedItem(item) },
    );
  };

  const isSaving = createPending || updatePending;
  const submitError = createError ?? updateError;
  const savedItemId = savedItem?.id;

  if (restaurantLoading) {
    return (
      <div className="w-full py-2 px-1">
        <p className="text-muted-foreground text-sm">Loading restaurant...</p>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="w-full py-2 px-1">
        <h1 className="text-4xl font-extrabold text-foreground tracking-tight mb-4">
          Create New Item
        </h1>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-destructive">
          <p className="font-bold mb-1">Restaurant not found</p>
          <p className="text-sm">
            Your restaurant account must be <strong>approved</strong> before you
            can add menu items. Check your restaurant status in the database or
            contact an admin.
          </p>
          <button
            type="button"
            onClick={() => navigate('/menu')}
            className="mt-4 text-sm font-bold underline"
          >
            Back to menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <div className="w-full py-2 px-1">
        <CreateMenuItemHeader
          onCancel={() => navigate('/menu')}
          onSave={methods.handleSubmit(onSubmit)}
          isEditMode={!!savedItem}
          isPending={isSaving}
        />

        {submitError && (
          <p className="text-sm text-destructive mb-4 px-1">
            {submitError.message}
          </p>
        )}

        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-8 space-y-8">
            <ProductEssenceCard
              categories={categories}
              restaurantId={restaurantId!}
            />
            <DietaryTagsCard />
            {savedItemId ? (
              <ModifiersCard menuItemId={savedItemId} />
            ) : (
              <div className="space-y-6 bg-card rounded-3xl p-8 shadow-sm border border-border/50">
                <div className="flex items-start gap-4">
                  <Info className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      Modifiers
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      Add size options, extras, and other customizations after
                      creating this menu item. Modifiers will be available after
                      the first save.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="col-span-12 lg:col-span-4 space-y-8">
            <MediaUploadCard menuItemId={savedItemId} />
            {savedItemId ? (
              <NutritionAssistantCard
                menuItemId={savedItemId}
                currentNutrition={savedItem.nutrition}
              />
            ) : (
              <NutritionSaveGateCard
                onSave={methods.handleSubmit(onSubmit)}
                isPending={isSaving}
              />
            )}
            <MarketVisibilityCard />
          </div>
        </div>

        <CreateMenuItemFooter
          onDiscard={() => navigate('/menu')}
          onPublish={methods.handleSubmit(onSubmit)}
          isPending={isSaving}
          isEditMode={!!savedItem}
        />
      </div>
    </FormProvider>
  );
}

function NutritionSaveGateCard({
  onSave,
  isPending,
}: {
  onSave: () => void;
  isPending: boolean;
}) {
  return (
    <div className="bg-card rounded-3xl p-8 shadow-sm border border-border/50">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        AI Nutrition
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Save this item to unlock recipe analysis and verified nutrition values.
      </p>
      <Button
        type="button"
        onClick={onSave}
        disabled={isPending}
        className="mt-5 w-full gap-2"
      >
        <Sparkles className="h-4 w-4" />
        {isPending ? 'Saving...' : 'Save and analyze'}
      </Button>
    </div>
  );
}
