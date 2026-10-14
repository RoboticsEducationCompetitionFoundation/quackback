import { Link } from '@tanstack/react-router'
import { LEGAL_DOCUMENTS } from '@/lib/shared/legal'
import { openCookieSettings } from '@/lib/client/cookie-consent'
import { cn } from '@/lib/shared/utils'

export function LegalFooter({ className }: { className?: string }) {
  return (
    <footer className={cn('border-t border-border/50 px-4 py-4', className)}>
      <nav
        aria-label="Legal"
        className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
      >
        {LEGAL_DOCUMENTS.map((doc) => (
          <Link
            key={doc.slug}
            to="/legal/$slug"
            params={{ slug: doc.slug }}
            className="hover:text-foreground transition-colors"
          >
            {doc.title}
          </Link>
        ))}
        <button
          type="button"
          onClick={openCookieSettings}
          className="hover:text-foreground transition-colors"
        >
          Cookie Settings
        </button>
      </nav>
    </footer>
  )
}
