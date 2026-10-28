import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export function BackLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
      <ChevronLeft aria-hidden className="size-4" />
      {children}
    </Link>
  );
}
