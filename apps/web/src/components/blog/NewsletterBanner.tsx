import { Bell, ArrowRight } from 'lucide-react';

interface NewsletterBannerProps {
  text: string;
  placeholder: string;
  buttonLabel: string;
}

/**
 * Newsletter signup banner — UI only. Backend wiring (Resend audience
 * add or similar) lands with BE-1. Form is disabled until then so users
 * cannot submit and assume something happened.
 */
export function NewsletterBanner({ text, placeholder, buttonLabel }: NewsletterBannerProps) {
  return (
    <section className="bg-paper px-5 py-12 md:px-12 md:py-16">
      <div className="mx-auto w-full max-w-[1440px]">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-white px-6 py-6 sm:flex-row md:px-10">
          <Bell className="h-5 w-5 shrink-0 text-bamboo-deep" aria-hidden="true" />
          <p className="flex-1 text-center text-sm font-medium text-navy sm:text-left">
            {text}
          </p>
          <div className="flex w-full gap-2 sm:w-auto">
            <input
              type="email"
              placeholder={placeholder}
              disabled
              className="w-full flex-1 rounded-full border border-line bg-paper px-4 py-2.5 text-sm text-navy placeholder:text-navy-soft/60 outline-none disabled:cursor-not-allowed disabled:opacity-60 sm:w-56"
            />
            <button
              type="button"
              disabled
              className="inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-full bg-bamboo px-5 py-2.5 text-sm font-semibold text-navy-deep opacity-60"
            >
              {buttonLabel}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
