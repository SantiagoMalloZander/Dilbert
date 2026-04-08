"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex items-center gap-2 text-sm">
      <Link
        href="/app/crm"
        className="text-[#9fb0c8] hover:text-[#35d6ae] transition-colors"
      >
        CRM
      </Link>

      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <ChevronRight className="h-4 w-4 text-[#6f85a3]" />
          {item.href ? (
            <Link
              href={item.href}
              className="text-[#9fb0c8] hover:text-[#35d6ae] transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-[#f8fafc] font-medium">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}
