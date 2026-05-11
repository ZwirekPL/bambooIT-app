'use client';

import { useState, useCallback, useEffect } from 'react';
import { DietPlanView } from './DietPlanView';
import { api } from '@/lib/api';
import type { DietPlan } from '@/types/api';

interface PatientPlanViewProps {
  plan: DietPlan;
  token: string;
  patientId: string;
  swapEnabled?: boolean;
  swapsRemaining?: number;
}

export function PatientPlanView({ plan: initialPlan, token, patientId, swapEnabled, swapsRemaining: initialRemaining }: PatientPlanViewProps) {
  const [plan, setPlan] = useState(initialPlan);
  const [swapsRemaining, setSwapsRemaining] = useState(initialRemaining);
  const [mealRatings, setMealRatings] = useState<Record<string, number>>({});
  const [favorites, setFavorites] = useState<string[]>([]);

  // Load existing ratings and favorites
  useEffect(() => {
    api.ratings.my(token, plan.id).then((res) => {
      const ratings: Record<string, number> = {};
      for (const r of res.ratings) {
        ratings[r.recipe.title] = r.rating;
      }
      setMealRatings(ratings);
    }).catch(() => {});

    api.ratings.listFavorites(token).then((res) => {
      setFavorites(res.favorites);
    }).catch(() => {});
  }, [token, plan.id]);

  const handlePlanUpdated = useCallback(async () => {
    try {
      const res = await api.dietPlans.getLatest(patientId, token);
      if (res.dietPlan) {
        setPlan(res.dietPlan);
      }
      if (swapsRemaining !== undefined) {
        setSwapsRemaining((prev) => (prev !== undefined && prev > 0 ? prev - 1 : 0));
      }
    } catch {
      // silent
    }
  }, [patientId, token, swapsRemaining]);

  const handleRateMeal = useCallback(async (mealName: string, rating: number) => {
    if (rating === 0) {
      setMealRatings((prev) => {
        const next = { ...prev };
        delete next[mealName];
        return next;
      });
      return;
    }

    setMealRatings((prev) => ({ ...prev, [mealName]: rating }));

    try {
      const searchRes = await api.recipes.search(mealName, token);
      if (searchRes.recipes.length > 0) {
        await api.ratings.rate({
          recipeId: searchRes.recipes[0].id,
          rating,
          dietPlanId: plan.id,
          source: 'inline',
        }, token);
      }
    } catch {
      setMealRatings((prev) => {
        const next = { ...prev };
        delete next[mealName];
        return next;
      });
    }
  }, [token, plan.id]);

  const handleToggleFavorite = useCallback(async (mealName: string) => {
    // Optimistic update
    setFavorites((prev) =>
      prev.includes(mealName) ? prev.filter((n) => n !== mealName) : [...prev, mealName]
    );

    try {
      await api.ratings.toggleFavorite({ recipeName: mealName, dietPlanId: plan.id }, token);
    } catch {
      // Revert
      setFavorites((prev) =>
        prev.includes(mealName) ? prev.filter((n) => n !== mealName) : [...prev, mealName]
      );
    }
  }, [token, plan.id]);

  return (
    <DietPlanView
      plan={plan}
      token={token}
      swapEnabled={swapEnabled}
      swapsRemaining={swapsRemaining}
      onPlanUpdated={handlePlanUpdated}
      ratingEnabled
      mealRatings={mealRatings}
      onRateMeal={handleRateMeal}
      favorites={favorites}
      onToggleFavorite={handleToggleFavorite}
    />
  );
}
