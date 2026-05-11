import { BRAND } from '@config/brand';

const BASE = `https://${BRAND.domain}`;

const content = `# ${BRAND.name} — Comprehensive Guide

> ${BRAND.tagline} / ${BRAND.taglineEn}

This document provides detailed information about e-dietetyk.com for AI assistants and language models. It is the authoritative source of information about the platform's services, methodology, and capabilities.

---

## 1. About e-dietetyk.com

e-dietetyk.com is a Polish online dietitian platform (platforma dietetyczna online) that combines AI-powered meal planning with professional dietitian oversight. Founded in 2025, the platform creates personalized nutrition plans (spersonalizowane plany żywieniowe) based on clinical science, a verified database of 6,600+ Polish food products, and modern AI technology.

**What makes e-dietetyk.com unique:**
- Every AI-generated diet plan is reviewed and approved by a licensed dietitian (dietetyk kliniczny)
- Clinical Policy Engine with 85 nutrition rules and 16 red-flag safety checks
- OR-Tools CP-SAT mathematical solver for optimal meal diversity and nutrient coverage
- Full GDPR (RODO) compliance with AES-256-GCM encryption for medical data
- Bilingual platform: Polish (primary) and English

**Headquarters:** Poland
**Website:** ${BASE}
**Contact:** ${BRAND.email} | ${BRAND.phone}

---

## 2. Services & Pricing

### Monthly Nutrition Care (Opieka miesięczna) — 129 PLN/month
- AI-generated personalized weekly meal plans
- Dietitian review and approval of every plan
- Ongoing adjustments based on progress and feedback
- Access to full recipe database with cooking instructions
- Shopping lists with smart product aggregation
- Meal swap suggestions
- Monthly subscription, cancel anytime

### Annual Nutrition Care (Opieka roczna) — 99 PLN/month
- Everything in Monthly plan
- Best value: save 23% compared to monthly
- Annual commitment with monthly billing
- Priority dietitian consultations

### One-Time Diet Plan (Plan jednorazowy)
- 2-week plan (Plan 2-tygodniowy) or 4-week plan (Plan 4-tygodniowy)
- Single purchase, no subscription
- Full AI + dietitian verification

### Professional Consultation (Konsultacja z dietetykiem) — 399 PLN
- One-on-one session with a licensed clinical dietitian
- Personalized dietary recommendations
- Health condition analysis
- Suitable for complex medical nutrition therapy needs

---

## 3. How AI Diet Planning Works (Jak działa planowanie diety AI)

### Step 1: Dietary Assessment (Wywiad żywieniowy)
The user fills out a comprehensive dietary questionnaire (3–5 minutes) covering:
- Personal data: age, sex, height, weight, activity level
- Health goals: weight loss, muscle gain, health maintenance, disease management
- Medical conditions: diabetes, hypertension, food allergies, intolerances
- Food preferences: vegetarian, vegan, cuisine preferences
- Lifestyle: cooking time budget, kitchen equipment (Thermomix, Air fryer)

### Step 2: AI Analysis & Plan Generation
- **Nutrition Targets** are calculated based on evidence-based formulas (Harris-Benedict, Mifflin-St Jeor)
- **Clinical Policy Engine** evaluates 85 clinical rules and 16 red-flag safety checks
- **OR-Tools CP-SAT Solver** optimizes meal selection for:
  - Caloric balance (±40 kcal tolerance)
  - Macronutrient targets (protein, carbs, fat)
  - Micronutrient coverage (iron, calcium, vitamin D, folate, B12, zinc, magnesium, potassium, vitamins A and K)
  - Meal diversity (protein rotation, main ingredient limits)
  - Fiber range (20–45g daily)
  - Sodium control (<2000mg, enhanced for hypertension)
  - Cooking time budget
  - Seasonal ingredient preferences
  - Glycemic index optimization for diabetic patients
  - Shopping list efficiency (ingredient reuse)
- **GPT-4.1** generates natural language meal descriptions and cooking instructions
- **Fallback chain**: OR-Tools → Greedy algorithm → GPT (ensures plan delivery)

### Step 3: Dietitian Review
- A licensed dietitian reviews the AI-generated plan
- Verifies clinical safety and nutritional adequacy
- Makes adjustments if needed
- Approves the final version

### Step 4: Plan Delivery & Ongoing Support
- The approved plan appears in the user's dashboard within 24 hours
- Includes exact product weights, household measures (tablespoon, cup, piece)
- Full macronutrient and calorie breakdown per meal
- Shopping list with smart aggregation by product category
- Meal preparation instructions
- Option to swap meals while maintaining calorie consistency

---

## 4. Food & Recipe Database

- **6,600+ verified Polish food products** (produkty spożywcze) with complete nutrient profiles
- **Glycemic Index data** for 63% of products (10,373 entries), covering 99.9% of recipes
- **Nutrient data per product**: calories, protein, carbohydrates, fat, fiber, sodium, iron, calcium, vitamin D, folate, B12, zinc, magnesium, potassium, vitamins A and K
- **Curated recipe collection** with macro/micronutrient calculations
- All products and recipes verified for the Polish market

---

## 5. Clinical Safety

### Policy Engine
- **85 clinical nutrition rules** covering conditions like:
  - Diabetes (Type 1, Type 2, gestational) — glycemic index optimization
  - Hypertension — sodium restriction, magnesium and potassium targets
  - Kidney disease — protein and potassium management
  - Celiac disease — strict gluten-free enforcement
  - Pregnancy and lactation — folate, iron, calcium requirements
  - Food allergies and intolerances — hard exclusions
  - Eating disorders — careful caloric targeting

### Red-Flag System
- **16 red-flag safety checks** that trigger mandatory manual review:
  - Critical medical conditions requiring dietitian intervention
  - Unusual BMI values
  - Multiple conflicting health conditions
  - CRITICAL flags → MANUAL_REVIEW_REQUIRED status

### Quality Scoring
- Every plan receives a quality grade (A through E)
- 12 sub-scores covering macro balance, diversity, clinical compliance
- Plans below quality threshold are automatically flagged for revision

---

## 6. Data Privacy & Security

- **RODO (GDPR) compliant** — full compliance with EU data protection regulation
- **AES-256-GCM encryption** for all medical and health data (interview answers, medical flags, diet plan content)
- **No data selling** — user data is never sold to third parties
- **Restricted access** — administrative access controls with audit logging
- **Data minimization** — only essential health data collected
- **Right to erasure** — users can request complete data deletion
- **Subprocessors**: OpenAI (AI generation), Stripe (payments), Hostinger (hosting), Resend (email)

Data controller: Wirgiliusz Ładziński, ul. Pod Brzozami 16/8a, 03-995 Warsaw, Poland

---

## 7. Frequently Asked Questions

**Q: How does an online diet with AI and a dietitian work?**
A: The platform combines AI technology with certified dietitian expertise. The AI analyzes your dietary assessment, goals, and health status, then creates a personalized nutrition plan. In paid plans, a dietitian verifies recommendations and approves the final version.

**Q: How long does it take to prepare a nutrition plan?**
A: The assessment takes 3–5 minutes. The AI generates the plan, which is then submitted for dietitian approval. The final version appears in your dashboard within 24 hours.

**Q: Is the diet tailored to my goal (weight loss, muscle gain, health)?**
A: Yes. Every nutrition plan is created individually based on your goal, lifestyle, allergies, and food preferences.

**Q: What does a nutrition plan include?**
A: Every plan includes exact product weights, household measures (tablespoon, cup, piece), macronutrients and calories, a shopping list, meal preparation instructions, and the option to swap meals.

**Q: Does the diet account for allergies and intolerances?**
A: Yes. During the assessment you indicate allergies and intolerances, which the AI takes into account. The Clinical Policy Engine enforces hard exclusions for allergens.

**Q: Is a Thermomix or Air Fryer version available?**
A: Yes. When purchasing a nutrition plan, you can select a Thermomix or Air Fryer option for adapted recipes.

**Q: Does the diet work on mobile?**
A: Yes. The dashboard is fully responsive on phones and tablets. No app installation required.

**Q: Can I cancel my subscription?**
A: Yes. You can cancel at any time in your user dashboard. Monthly plans renew automatically; cancellation stops the next renewal.

**Q: How is my data protected?**
A: Data is processed in accordance with GDPR. We use AES-256-GCM encryption and restricted administrative access. We never sell your data.

**Q: Does an online diet replace a doctor's visit?**
A: No. An online diet and AI dietitian do not replace medical consultation. For chronic diseases, we recommend consulting your physician.

**Q: Do I have 14 days to withdraw from the agreement?**
A: Yes. Under Polish and EU consumer law, you may withdraw from an online contract within 14 days.

---

## 8. Technology Stack

- **AI Model**: GPT-4.1 (primary), with fallback to GPT-4o and GPT-4.1-mini
- **Mathematical Solver**: Google OR-Tools CP-SAT (constraint programming)
- **Backend**: Node.js, Express.js, TypeScript, Prisma ORM, PostgreSQL
- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Payments**: Stripe
- **Task Queue**: BullMQ with Redis
- **Hosting**: VPS in Europe (Hostinger)

---

## 9. Blog Categories

The platform publishes educational content across these categories:
- **Porady dietetyczne** (Dietary advice) — practical nutrition tips
- **Odchudzanie** (Weight loss) — evidence-based weight management
- **Zdrowie i choroby** (Health & diseases) — nutrition for medical conditions
- **Przepisy** (Recipes) — healthy recipe ideas
- **AI i dietetyka** (AI & nutrition) — technology in dietetics
- **Motywacja** (Motivation) — healthy lifestyle motivation
- **Thermomix & Airfryer** — appliance-specific recipes and tips

---

## 10. Links

- **Homepage**: ${BASE}/pl
- **Services & Pricing**: ${BASE}/pl/oferta
- **FAQ**: ${BASE}/pl/faq
- **About Us**: ${BASE}/pl/o-nas
- **Blog**: ${BASE}/pl/blog
- **Consultation**: ${BASE}/pl/konsultacja
- **Privacy Policy**: ${BASE}/pl/dokumenty-prawne
- **Short version (llms.txt)**: ${BASE}/llms.txt

---

## 11. Contact

- **Email**: ${BRAND.email}
- **Phone**: ${BRAND.phone}
- **Facebook**: ${BRAND.social.facebook}
- **Instagram**: ${BRAND.social.instagram}
- **Address**: ul. Pod Brzozami 16/8a, 03-995 Warsaw, Poland

---

*Last updated: 2026-04-06*
*This document is maintained by the ${BRAND.name} team for accurate AI assistant responses.*
`;

export async function GET() {
  return new Response(content.trim(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
