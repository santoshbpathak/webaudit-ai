import {
  Accessibility,
  BarChart3,
  FileInput,
  FileText,
  Gauge,
  Megaphone,
  MousePointerClick,
  Network,
  Search,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export interface ModuleMeta {
  id: string;
  slug: string;
  name: string;
  icon: LucideIcon;
  summary: string;
}

/** Category reports: one per audit module. Slugs are URL-stable. */
export const MODULE_META: ModuleMeta[] = [
  {
    id: "M01",
    slug: "seo",
    name: "Technical SEO",
    icon: Search,
    summary: "Indexability, titles, descriptions, canonicals, headings, structured data and internal links.",
  },
  {
    id: "M02",
    slug: "performance",
    name: "Performance",
    icon: Gauge,
    summary:
      "Lighthouse lab metrics on sampled pages: LCP, CLS, TBT, page weight and render-blocking resources.",
  },
  {
    id: "M03",
    slug: "accessibility",
    name: "Accessibility",
    icon: Accessibility,
    summary: "Machine-detectable barriers found by axe-core. Manual WCAG testing is still required.",
  },
  {
    id: "M04",
    slug: "analytics",
    name: "Analytics (GA4 / GTM)",
    icon: BarChart3,
    summary: "Whether measurement tags load and fire correctly in the tested page loads.",
  },
  {
    id: "M05",
    slug: "advertising",
    name: "Ad pixels",
    icon: Megaphone,
    summary: "Advertising pixels observed on sampled pages, duplicates and failed loads.",
  },
  {
    id: "M06",
    slug: "forms",
    name: "Lead forms",
    icon: FileInput,
    summary: "Form usability and consent patterns — inspected passively, never submitted.",
  },
  {
    id: "M07",
    slug: "ux",
    name: "CRO / UX",
    icon: MousePointerClick,
    summary: "Calls to action, mobile overflow and tap targets — testable hypotheses.",
  },
  {
    id: "M08",
    slug: "privacy",
    name: "Privacy & consent",
    icon: ShieldCheck,
    summary: "Tracking and cookies relative to the consent banner. Indicators, not legal determinations.",
  },
  {
    id: "M09",
    slug: "content",
    name: "Content",
    icon: FileText,
    summary: "Thin pages, language declaration, exact and near-duplicate content, broken images.",
  },
  {
    id: "M10",
    slug: "architecture",
    name: "Architecture",
    icon: Network,
    summary: "Internal link graph, click depth, orphaned and unlisted pages.",
  },
];

export const moduleBySlug = (slug: string) => MODULE_META.find((m) => m.slug === slug);
export const moduleById = (id: string) => MODULE_META.find((m) => m.id === id);
