import { prisma } from '@db';

export interface OnboardingStatus {
  profileComplete: boolean;
  trialActive: boolean;
  interviewComplete: boolean;
  onboardingDone: boolean;
}

/**
 * Check onboarding completion status for a patient user.
 *
 * Steps:
 *  1. Registration — always true (user exists)
 *  2. Profile — sex, birthYear, heightCm, weightKg all filled
 *  3. Trial/Subscription — active Order or Subscription exists
 *  4. Interview — at least one Interview exists
 *  5. Tour — handled client-side (localStorage)
 *
 * onboardingDone = profileComplete && trialActive && interviewComplete
 */
// ─── Dietitian Onboarding ─────────────────────────────────────────────────────

export interface DietitianOnboardingStatus {
  profileComplete: boolean;
  hasPatients: boolean;
  onboardingDone: boolean;
}

/**
 * Check onboarding completion status for a dietitian user.
 *
 * Steps:
 *  1. Profile — firstName and lastName filled
 *  2. Has patients — at least one patient linked
 *  3. Tour — handled client-side (localStorage)
 *
 * onboardingDone = profileComplete (minimum required)
 */
export async function getDietitianOnboardingStatus(userId: string): Promise<DietitianOnboardingStatus> {
  const [user, patientCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        dietitianProfile: {
          select: { code: true },
        },
      },
    }),
    prisma.patient.count({
      where: { dietitianId: userId },
    }),
  ]);

  // Check profile: firstName and lastName from DietitianProfile or User
  const profile = await prisma.dietitianProfile.findUnique({
    where: { userId },
    select: { firstName: true, lastName: true },
  });

  const profileComplete = !!(profile?.firstName && profile?.lastName);
  const hasPatients = patientCount > 0;

  return {
    profileComplete,
    hasPatients,
    onboardingDone: profileComplete,
  };
}

// ─── Patient Onboarding ──────────────────────────────────────────────────────

export async function getOnboardingStatus(userId: string): Promise<OnboardingStatus> {
  const patient = await prisma.patient.findUnique({
    where: { userId },
    select: {
      id: true,
      sex: true,
      birthYear: true,
      heightCm: true,
      weightKg: true,
    },
  });

  if (!patient) {
    return {
      profileComplete: false,
      trialActive: false,
      interviewComplete: false,
      onboardingDone: false,
    };
  }

  // Step 2: Profile — all required fields present
  const profileComplete = !!(
    patient.sex &&
    patient.birthYear &&
    patient.heightCm &&
    patient.weightKg
  );

  // Step 3: Active subscription or paid order
  const [activeOrder, activeSubscription] = await Promise.all([
    prisma.order.findFirst({
      where: {
        patientId: patient.id,
        status: { in: ['PAID', 'ACTIVE', 'COMPLETED'] },
      },
      select: { id: true },
    }),
    prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['TRIALING', 'ACTIVE'] },
      },
      select: { id: true },
    }),
  ]);

  const trialActive = !!(activeOrder || activeSubscription);

  // Step 4: At least one interview submitted
  const interview = await prisma.interview.findFirst({
    where: { patientId: patient.id },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });

  const interviewComplete = !!interview;

  const onboardingDone = profileComplete && trialActive && interviewComplete;

  return {
    profileComplete,
    trialActive,
    interviewComplete,
    onboardingDone,
  };
}
