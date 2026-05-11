import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiError } from '../utils/errors';
import * as foodProductService from '../services/foodProduct.service';
import { logAudit } from '../services/audit.service';

// ─── shared schemas ───────────────────────────────────────────────────────────

const idSchema = z.object({ id: z.string().cuid() });
const measureIdSchema = z.object({ measureId: z.string().cuid() });

const nutrientsSchema = z.object({
  kcal: z.number().nonnegative(),
  protein_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
  saturatedFat_g: z.number().nonnegative().optional(),
  monounsaturatedFat_g: z.number().nonnegative().optional(),
  polyunsaturatedFat_g: z.number().nonnegative().optional(),
  transFat_g: z.number().nonnegative().optional(),
  sugars_g: z.number().nonnegative().optional(),
  addedSugars_g: z.number().nonnegative().optional(),
  fiber_g: z.number().nonnegative().optional(),
  starch_g: z.number().nonnegative().optional(),
  salt_g: z.number().nonnegative().optional(),
  sodium_mg: z.number().nonnegative().optional(),
  potassium_mg: z.number().nonnegative().optional(),
  calcium_mg: z.number().nonnegative().optional(),
  magnesium_mg: z.number().nonnegative().optional(),
  phosphorus_mg: z.number().nonnegative().optional(),
  iron_mg: z.number().nonnegative().optional(),
  zinc_mg: z.number().nonnegative().optional(),
  copper_mg: z.number().nonnegative().optional(),
  manganese_mg: z.number().nonnegative().optional(),
  iodine_ug: z.number().nonnegative().optional(),
  selenium_ug: z.number().nonnegative().optional(),
  vitaminA_ug: z.number().nonnegative().optional(),
  vitaminC_mg: z.number().nonnegative().optional(),
  vitaminD_ug: z.number().nonnegative().optional(),
  vitaminE_mg: z.number().nonnegative().optional(),
  vitaminK_ug: z.number().nonnegative().optional(),
  vitaminB1_mg: z.number().nonnegative().optional(),
  vitaminB2_mg: z.number().nonnegative().optional(),
  vitaminB3_mg: z.number().nonnegative().optional(),
  vitaminB5_mg: z.number().nonnegative().optional(),
  vitaminB6_mg: z.number().nonnegative().optional(),
  folate_ug: z.number().nonnegative().optional(),
  vitaminB12_ug: z.number().nonnegative().optional(),
  biotin_ug: z.number().nonnegative().optional(),
  cholesterol_mg: z.number().nonnegative().optional(),
});

const allergenSchema = z.object({
  allergenCode: z.enum(['gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soy', 'milk', 'nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs']),
  presence: z.enum(['CONTAINS', 'MAY_CONTAIN', 'FREE', 'UNKNOWN']),
  source: z.enum(['AUTO_RULE', 'MANUAL', 'HEURISTIC', 'SOURCE_DATA']).optional(),
  confidence: z.number().int().min(0).max(100).optional(),
  notes: z.string().optional(),
});

const createSchema = z.object({
  name: z.string().min(1).max(300),
  nameEn: z.string().max(300).optional(),
  source: z.string().max(50).optional(),
  sourceId: z.string().max(100).optional(),
  categoryId: z.string().cuid().optional(),
  description: z.string().max(2000).optional(),
  state: z.string().optional(),
  ediblePortionPercent: z.number().min(0).max(100).optional(),
  density_g_per_ml: z.number().positive().optional(),
  defaultServingGrams: z.number().positive().optional(),
  searchableSynonyms: z.array(z.string().max(200)).optional(),
  languageCode: z.string().length(2).optional(),
  glycemicIndex: z.number().int().min(0).optional(),
  fodmapLevel: z.string().optional(),
  processingLevel: z.string().optional(),
  notesClinical: z.string().max(5000).optional(),
  notesDietitian: z.string().max(5000).optional(),
  nutrients: nutrientsSchema,
  allergens: z.array(allergenSchema).optional(),
  measures: z.array(z.object({
    name: z.string().min(1).max(100),
    nameEn: z.string().max(100).optional(),
    grams: z.number().positive(),
    source: z.string().max(50).optional(),
  })).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  nameEn: z.string().max(300).optional(),
  categoryId: z.string().cuid().optional(),
  description: z.string().max(2000).optional(),
  state: z.string().optional(),
  defaultServingGrams: z.number().positive().optional(),
  glycemicIndex: z.number().int().min(0).optional(),
  fodmapLevel: z.string().optional(),
  processingLevel: z.string().optional(),
  isBabySafe: z.boolean().optional(),
  isPregnancySafe: z.boolean().optional(),
  isBreastfeedingSafe: z.boolean().optional(),
  notesClinical: z.string().max(5000).optional(),
  notesDietitian: z.string().max(5000).optional(),
  isActive: z.boolean().optional(),
  nutrients: nutrientsSchema.optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  categoryId: z.string().optional(),
  source: z.string().optional(),
  verificationStatus: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  allergenFree: z.string().optional(), // comma-separated
  dietFlags: z.string().optional(), // comma-separated
  minKcal: z.coerce.number().optional(),
  maxKcal: z.coerce.number().optional(),
  minProtein: z.coerce.number().optional(),
  maxProtein: z.coerce.number().optional(),
});

const searchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const measureSchema = z.object({
  name: z.string().min(1).max(100),
  nameEn: z.string().max(100).optional(),
  grams: z.number().positive(),
  source: z.string().max(50).optional(),
});

// ─── handlers ─────────────────────────────────────────────────────────────────

export async function list(req: Request, res: Response, next: NextFunction) {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid query parameters'));
  }
  try {
    const { allergenFree, dietFlags, ...rest } = parsed.data;
    const result = await foodProductService.listFoodProducts({
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
    const item = await foodProductService.getFoodProductById(parsed.data.id);
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
    const items = await foodProductService.searchFoodProducts(parsed.data.q, parsed.data.limit);
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
    const item = await foodProductService.createFoodProduct(parsed.data);
    logAudit({ userId: req.user?.sub, action: 'CREATE_FOOD_PRODUCT', resourceType: 'FOOD_PRODUCT', resourceId: item.id, ip: req.ip });
    return res.status(201).json({ ok: true, item });
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
    const item = await foodProductService.updateFoodProduct(idParsed.data.id, bodyParsed.data);
    logAudit({ userId: req.user?.sub, action: 'UPDATE_FOOD_PRODUCT', resourceType: 'FOOD_PRODUCT', resourceId: item.id, ip: req.ip });
    return res.json({ ok: true, item });
  } catch (err) {
    next(err);
  }
}

export async function verify(req: Request, res: Response, next: NextFunction) {
  const idParsed = idSchema.safeParse(req.params);
  if (!idParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));
  }
  const bodyParsed = z.object({
    status: z.enum(['MANUALLY_VERIFIED', 'REJECTED']),
  }).safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid status'));
  }
  try {
    const item = await foodProductService.verifyFoodProduct(idParsed.data.id, req.user!.sub, bodyParsed.data.status);
    logAudit({ userId: req.user?.sub, action: 'VERIFY_FOOD_PRODUCT', resourceType: 'FOOD_PRODUCT', resourceId: item.id, ip: req.ip });
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
    const result = await foodProductService.deleteFoodProduct(parsed.data.id);
    logAudit({ userId: req.user?.sub, action: 'DELETE_FOOD_PRODUCT', resourceType: 'FOOD_PRODUCT', resourceId: parsed.data.id, ip: req.ip });
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function addMeasure(req: Request, res: Response, next: NextFunction) {
  const idParsed = idSchema.safeParse(req.params);
  if (!idParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid id'));
  }
  const bodyParsed = measureSchema.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid measure data'));
  }
  try {
    const measure = await foodProductService.addHouseholdMeasure(idParsed.data.id, bodyParsed.data);
    return res.status(201).json({ ok: true, measure });
  } catch (err) {
    next(err);
  }
}

export async function deleteMeasure(req: Request, res: Response, next: NextFunction) {
  const parsed = measureIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json(apiError('VALIDATION_ERROR', 'Invalid measure id'));
  }
  try {
    const result = await foodProductService.deleteHouseholdMeasure(parsed.data.measureId);
    return res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function listCategories(_req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await foodProductService.listCategories();
    return res.json({ ok: true, categories });
  } catch (err) {
    next(err);
  }
}
