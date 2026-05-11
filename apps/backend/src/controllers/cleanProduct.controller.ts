import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import * as cleanProductService from '../services/cleanProduct.service';
import { logAudit, getAuditLogsForResource } from '../services/audit.service';

// ─── shared schemas ───────────────────────────────────────────────────────────

const idSchema = z.object({ id: z.string().cuid() });

const nutrientsSchema = z.object({
  kcalPer100g: z.number().nonnegative(),
  proteinPer100g: z.number().nonnegative(),
  fatPer100g: z.number().nonnegative(),
  carbsPer100g: z.number().nonnegative(),
  fiberPer100g: z.number().nonnegative().optional(),
  sugarsPer100g: z.number().nonnegative().optional(),
  saltPer100g: z.number().nonnegative().optional(),
  saturatedFatPer100g: z.number().nonnegative().optional(),
  // Fat fractions (26.B)
  monounsaturatedFatPer100g: z.number().nonnegative().optional(),
  polyunsaturatedFatPer100g: z.number().nonnegative().optional(),
  transFatPer100g: z.number().nonnegative().optional(),
  omega3Per100g: z.number().nonnegative().optional(),
  omega6Per100g: z.number().nonnegative().optional(),
  epaPer100g: z.number().nonnegative().optional(),
  dhaPer100g: z.number().nonnegative().optional(),
  alaPer100g: z.number().nonnegative().optional(),
  // Carb fractions (26.C)
  starchPer100g: z.number().nonnegative().optional(),
  addedSugarsPer100g: z.number().nonnegative().optional(),
  // Minerals
  sodiumMg: z.number().nonnegative().optional(),
  potassiumMg: z.number().nonnegative().optional(),
  calciumMg: z.number().nonnegative().optional(),
  magnesiumMg: z.number().nonnegative().optional(),
  phosphorusMg: z.number().nonnegative().optional(),
  ironMg: z.number().nonnegative().optional(),
  zincMg: z.number().nonnegative().optional(),
  copperMg: z.number().nonnegative().optional(),
  manganeseMg: z.number().nonnegative().optional(),
  iodineUg: z.number().nonnegative().optional(),
  seleniumUg: z.number().nonnegative().optional(),
  chromiumUg: z.number().nonnegative().optional(),
  molybdenumUg: z.number().nonnegative().optional(),
  fluorideUg: z.number().nonnegative().optional(),
  chlorideMg: z.number().nonnegative().optional(),
  // Fat-soluble vitamins
  vitaminAUg: z.number().nonnegative().optional(),
  vitaminDUg: z.number().nonnegative().optional(),
  vitaminEMg: z.number().nonnegative().optional(),
  vitaminKUg: z.number().nonnegative().optional(),
  // Water-soluble vitamins
  vitaminCMg: z.number().nonnegative().optional(),
  vitaminB1Mg: z.number().nonnegative().optional(),
  vitaminB2Mg: z.number().nonnegative().optional(),
  vitaminB3Mg: z.number().nonnegative().optional(),
  vitaminB5Mg: z.number().nonnegative().optional(),
  vitaminB6Mg: z.number().nonnegative().optional(),
  folateUg: z.number().nonnegative().optional(),
  vitaminB12Ug: z.number().nonnegative().optional(),
  biotinUg: z.number().nonnegative().optional(),
  cholineMg: z.number().nonnegative().optional(),
  // Other
  cholesterolMg: z.number().nonnegative().optional(),
});

const aminoAcidsSchema = z.object({
  tryptophanPer100g: z.number().nonnegative().optional(),
  threoninePer100g: z.number().nonnegative().optional(),
  isoleucinePer100g: z.number().nonnegative().optional(),
  leucinePer100g: z.number().nonnegative().optional(),
  lysinePer100g: z.number().nonnegative().optional(),
  methioninePer100g: z.number().nonnegative().optional(),
  phenylalaninePer100g: z.number().nonnegative().optional(),
  valinePer100g: z.number().nonnegative().optional(),
  histidinePer100g: z.number().nonnegative().optional(),
});

const bioactivesSchema = z.object({
  purinesMg: z.number().nonnegative().optional(),
  oxalateMg: z.number().nonnegative().optional(),
  caffeineMg: z.number().nonnegative().optional(),
  polyphenolsMg: z.number().nonnegative().optional(),
  betaCaroteneUg: z.number().nonnegative().optional(),
  lycopeneUg: z.number().nonnegative().optional(),
  luteinZeaxanthinUg: z.number().nonnegative().optional(),
});

const portionSchema = z.object({
  portionName: z.string().min(1).max(100),
  weightG: z.number().positive(),
  source: z.enum(['ILEWAZY', 'OPENFOODFACTS', 'MANUAL']).optional(),
});

const allergenSchema = z.object({
  allergenCode: z.enum(['gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soy', 'milk', 'nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs']),
  presence: z.enum(['CONTAINS', 'MAY_CONTAIN', 'FREE', 'UNKNOWN']),
  source: z.enum(['AUTO_RULE', 'MANUAL', 'HEURISTIC', 'SOURCE_DATA']).optional(),
  confidence: z.number().int().min(0).max(100).optional(),
});

const dietFlagSchema = z.object({
  flagCode: z.string().min(1).max(50),
  value: z.boolean(),
  source: z.enum(['AUTO_RULE', 'MANUAL', 'HEURISTIC', 'SOURCE_DATA']).optional(),
  confidence: z.number().int().min(0).max(100).optional(),
});

const createSchema = z.object({
  name: z.string().min(1).max(300),
  nameEn: z.string().max(300).optional(),
  type: z.enum(['BASE', 'RETAIL', 'MANUAL']).default('MANUAL'),
  brand: z.string().max(200).optional(),
  barcode: z.string().max(50).optional(),
  category: z.string().min(1).max(100),
  subcategory: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().url().optional(),
  sourcePrimary: z.enum(['ILEWAZY', 'USDA', 'OPENFOODFACTS', 'MANUAL']).default('MANUAL'),
  sourceSecondary: z.enum(['ILEWAZY', 'USDA', 'OPENFOODFACTS', 'MANUAL']).optional(),
  sourceUrl: z.string().url().optional(),
  sourceId: z.string().max(100).optional(),
  qualityScore: z.number().int().min(0).max(100).optional(),
  hasMicronutrients: z.boolean().optional(),
  glycemicIndex: z.number().int().min(0).max(100).optional(),
  glycemicLoadPer100g: z.number().nonnegative().max(70).optional(),
  fodmapLevel: z.enum(['LOW', 'MODERATE', 'HIGH', 'UNKNOWN']).optional(),
  packageWeightG: z.number().int().positive().optional(),
  servingWeightG: z.number().int().positive().optional(),
  nutrients: nutrientsSchema,
  aminoAcids: aminoAcidsSchema.optional(),
  bioactives: bioactivesSchema.optional(),
  portions: z.array(portionSchema).optional(),
  allergens: z.array(allergenSchema).optional(),
  dietFlags: z.array(dietFlagSchema).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  nameEn: z.string().max(300).optional(),
  brand: z.string().max(200).optional(),
  barcode: z.string().max(50).optional().nullable(),
  category: z.string().min(1).max(100).optional(),
  subcategory: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().url().optional(),
  qualityScore: z.number().int().min(0).max(100).optional(),
  verificationStatus: z.enum(['VERIFIED', 'UNVERIFIED', 'FLAGGED']).optional(),
  glycemicIndex: z.number().int().min(0).max(100).optional().nullable(),
  glycemicLoadPer100g: z.number().nonnegative().max(70).optional().nullable(),
  fodmapLevel: z.enum(['LOW', 'MODERATE', 'HIGH', 'UNKNOWN']).optional().nullable(),
  packageWeightG: z.number().int().positive().optional().nullable(),
  servingWeightG: z.number().int().positive().optional().nullable(),
  nutrients: nutrientsSchema.optional(),
  aminoAcids: aminoAcidsSchema.optional(),
  bioactives: bioactivesSchema.optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  type: z.enum(['BASE', 'RETAIL', 'MANUAL']).optional(),
  category: z.string().optional(),
  verificationStatus: z.enum(['VERIFIED', 'UNVERIFIED', 'FLAGGED']).optional(),
  allergenFree: z.string().optional(),
  dietFlags: z.string().optional(),
  minKcal: z.coerce.number().optional(),
  maxKcal: z.coerce.number().optional(),
  minQuality: z.coerce.number().int().min(0).max(100).optional(),
  maxQuality: z.coerce.number().int().min(0).max(100).optional(),
});

const searchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  type: z.enum(['BASE', 'RETAIL', 'MANUAL']).optional(),
  category: z.string().optional(),
});

const previewNutritionSchema = z.object({
  ingredients: z.array(z.object({
    cleanProductId: z.string().cuid(),
    grams: z.number().positive(),
  })).min(1),
  servings: z.number().int().min(1).default(1),
});

// ─── dietitian create schema (simplified) ─────────────────────────────────────

const dietitianCreateSchema = z.object({
  name: z.string().min(1).max(300),
  nameEn: z.string().max(300).optional(),
  category: z.string().min(1).max(100),
  subcategory: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  nutrients: nutrientsSchema,
  portions: z.array(portionSchema).optional(),
});

// ─── handlers ─────────────────────────────────────────────────────────────────

export async function list(req: Request, res: Response, next: NextFunction) {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid query parameters'));
  }
  try {
    const { allergenFree, dietFlags, ...rest } = parsed.data;
    const result = await cleanProductService.listCleanProducts({
      ...rest,
      allergenFree: allergenFree?.split(',').filter(Boolean),
      dietFlags: dietFlags?.split(',').filter(Boolean),
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  const parsed = idSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));
  }
  try {
    const item = await cleanProductService.getCleanProductById(parsed.data.id);
    return res.json({ ok: true, item });
  } catch (err) {
    next(err);
  }
}

export async function search(req: Request, res: Response, next: NextFunction) {
  const parsed = searchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Missing or invalid q parameter'));
  }
  try {
    const items = await cleanProductService.searchCleanProducts(parsed.data.q, parsed.data.limit, parsed.data.type, parsed.data.category);
    return res.json({ ok: true, items });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }
  try {
    const item = await cleanProductService.createCleanProduct({
      ...parsed.data,
      createdByUserId: req.user?.sub,
    });
    logAudit({ userId: req.user?.sub, action: 'CREATE_CLEAN_PRODUCT', resourceType: 'CLEAN_PRODUCT', resourceId: item.id, ip: req.ip });
    return res.status(201).json({ ok: true, item });
  } catch (err) {
    next(err);
  }
}

export async function dietitianCreate(req: Request, res: Response, next: NextFunction) {
  const parsed = dietitianCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }
  try {
    const item = await cleanProductService.createCleanProduct({
      ...parsed.data,
      type: 'MANUAL',
      sourcePrimary: 'MANUAL',
      qualityScore: 70,
      verificationStatus: 'VERIFIED',
      createdByUserId: req.user!.sub,
    });
    logAudit({ userId: req.user?.sub, action: 'CREATE_CLEAN_PRODUCT', resourceType: 'CLEAN_PRODUCT', resourceId: item.id, ip: req.ip });
    return res.status(201).json({ ok: true, item });
  } catch (err) {
    next(err);
  }
}

export async function dietitianUpdate(req: Request, res: Response, next: NextFunction) {
  const idParsed = idSchema.safeParse(req.params);
  if (!idParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));
  const bodyParsed = dietitianCreateSchema.safeParse(req.body);
  if (!bodyParsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));

  try {
    const existing = await cleanProductService.getCleanProductById(idParsed.data.id);
    if (existing.type !== 'MANUAL' || existing.createdByUserId !== req.user!.sub) {
      return res.status(403).json(apiError('FORBIDDEN', 'Can only edit your own MANUAL products'));
    }
    const item = await cleanProductService.updateCleanProduct(idParsed.data.id, bodyParsed.data);
    logAudit({ userId: req.user?.sub, action: 'UPDATE_CLEAN_PRODUCT', resourceType: 'CLEAN_PRODUCT', resourceId: item.id, ip: req.ip });
    return res.json({ ok: true, item });
  } catch (err) {
    next(err);
  }
}

export async function dietitianDelete(req: Request, res: Response, next: NextFunction) {
  const parsed = idSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));

  try {
    const existing = await cleanProductService.getCleanProductById(parsed.data.id);
    if (existing.type !== 'MANUAL' || existing.createdByUserId !== req.user!.sub) {
      return res.status(403).json(apiError('FORBIDDEN', 'Can only delete your own MANUAL products'));
    }
    const result = await cleanProductService.deleteCleanProduct(parsed.data.id);
    logAudit({ userId: req.user?.sub, action: 'DELETE_CLEAN_PRODUCT', resourceType: 'CLEAN_PRODUCT', resourceId: parsed.data.id, ip: req.ip });
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  const idParsed = idSchema.safeParse(req.params);
  if (!idParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));
  }
  const bodyParsed = updateSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }
  try {
    const item = await cleanProductService.updateCleanProduct(idParsed.data.id, bodyParsed.data);
    logAudit({ userId: req.user?.sub, action: 'UPDATE_CLEAN_PRODUCT', resourceType: 'CLEAN_PRODUCT', resourceId: item.id, ip: req.ip });
    return res.json({ ok: true, item });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  const parsed = idSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));
  }
  try {
    const result = await cleanProductService.deleteCleanProduct(parsed.data.id);
    logAudit({ userId: req.user?.sub, action: 'DELETE_CLEAN_PRODUCT', resourceType: 'CLEAN_PRODUCT', resourceId: parsed.data.id, ip: req.ip });
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

// ─── bulk action ─────────────────────────────────────────────────────────────

const bulkActionSchema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(500),
  action: z.enum(['verify', 'flag', 'unverify', 'delete', 'changeCategory']),
  category: z.string().min(1).max(100).optional(),
});

export async function bulkAction(req: Request, res: Response, next: NextFunction) {
  const parsed = bulkActionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }
  try {
    const result = await cleanProductService.bulkActionCleanProducts(parsed.data);
    logAudit({
      userId: req.user?.sub,
      action: 'BULK_UPDATE_CLEAN_PRODUCTS',
      resourceType: 'CLEAN_PRODUCT',
      resourceId: `bulk:${parsed.data.action}:${parsed.data.ids.length}`,
      ip: req.ip,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

// ─── history (audit log) ─────────────────────────────────────────────────────

export async function getHistory(req: Request, res: Response, next: NextFunction) {
  const parsed = idSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));
  }
  try {
    const logs = await getAuditLogsForResource('CLEAN_PRODUCT', parsed.data.id);
    return res.json({ ok: true, logs });
  } catch (err) {
    next(err);
  }
}

export async function getStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await cleanProductService.getProductStats();
    return res.json({ ok: true, stats });
  } catch (err) {
    next(err);
  }
}

export async function getCategories(_req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await cleanProductService.getDistinctCategories();
    return res.json({ ok: true, categories });
  } catch (err) {
    next(err);
  }
}

// ─── duplicates ──────────────────────────────────────────────────────────────

const duplicatesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  minGroupSize: z.coerce.number().int().min(2).max(100).default(2),
  category: z.string().optional(),
});

export async function findDuplicates(req: Request, res: Response, next: NextFunction) {
  const parsed = duplicatesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid query parameters'));
  }
  try {
    const result = await cleanProductService.findDuplicates(parsed.data);
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

// ─── merge ───────────────────────────────────────────────────────────────────

const mergeSchema = z.object({
  targetId: z.string().cuid(),
  sourceId: z.string().cuid(),
  fieldsFromSource: z.array(z.string().max(50)).optional(),
});

export async function mergeProducts(req: Request, res: Response, next: NextFunction) {
  const parsed = mergeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }
  try {
    const merged = await cleanProductService.mergeProducts(parsed.data);
    logAudit({
      userId: req.user?.sub,
      action: 'MERGE_CLEAN_PRODUCTS',
      resourceType: 'CLEAN_PRODUCT',
      resourceId: parsed.data.targetId,
      ip: req.ip,
      metadata: { sourceId: parsed.data.sourceId, fieldsFromSource: parsed.data.fieldsFromSource },
    });
    return res.json({ ok: true, item: merged });
  } catch (err) {
    next(err);
  }
}

// ─── preview nutrition ───────────────────────────────────────────────────────

export async function previewNutrition(req: Request, res: Response, next: NextFunction) {
  const parsed = previewNutritionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid request body'));
  }
  try {
    const result = await cleanProductService.previewNutrition(parsed.data.ingredients, parsed.data.servings);
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}
