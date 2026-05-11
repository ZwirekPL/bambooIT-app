import { Bell, ArrowRight } from 'lucide-react';

interface NewsletterBannerProps {
  text: string;
  placeholder: string;
  buttonLabel: string;
}

export function NewsletterBanner({ text, placeholder, buttonLabel }: NewsletterBannerProps) {
  return (
    <section className="py-10">
      <div className="container mx-auto px-4 md:px-6">
        <div className="rounded-2xl bg-[#F5F0E8] px-6 py-5 flex flex-col sm:flex-row items-center gap-4">
          <Bell className="h-5 w-5 text-sage-600 shrink-0" />
          <p className="text-sm font-medium text-foreground text-center sm:text-left flex-1">
            {text}
          </p>
          {/* UI placeholder — backend not yet connected */}
          <div className="flex gap-2 w-full sm:w-auto">
            <input
              type="email"
              placeholder={placeholder}
              disabled
              className="flex-1 sm:w-52 rounded-xl border border-input bg-white px-4 py-2 text-sm focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              disabled
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#F97316] px-4 py-2 text-sm font-semibold text-white opacity-60 cursor-not-allowed"
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
