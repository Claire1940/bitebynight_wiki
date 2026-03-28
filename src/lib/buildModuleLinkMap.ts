import { getAllContent, CONTENT_TYPES } from '@/lib/content'
import type { Language, ContentItem } from '@/lib/content'

export interface ArticleLink {
  url: string
  title: string
}

export type ModuleLinkMap = Record<string, ArticleLink | null>

interface ArticleWithType extends ContentItem {
  contentType: string
}

// Module sub-field mapping: moduleKey -> { field, nameKey }
const MODULE_FIELDS: Record<string, { field: string; nameKey: string }> = {
  biteByNightBeginnerGuide: { field: 'steps', nameKey: 'title' },
  biteByNightReleaseDate: { field: 'cards', nameKey: 'name' },
  biteByNightCodes: { field: 'items', nameKey: 'name' },
  biteByNightClassesGuide: { field: 'solutions', nameKey: 'name' },
  biteByNightClassTierList: { field: 'tiers', nameKey: 'class' },
  biteByNightKillersGuide: { field: 'killers', nameKey: 'name' },
  biteByNightKillerTierList: { field: 'tiers', nameKey: 'killer' },
  biteByNightSurvivorGuide: { field: 'steps', nameKey: 'title' },
  biteByNightSpringtrapGuide: { field: 'sections', nameKey: 'name' },
  biteByNightTheMimicGuide: { field: 'priorities', nameKey: 'name' },
  biteByNightEnnardGuide: { field: 'groups', nameKey: 'name' },
  biteByNightMapsGuide: { field: 'maps', nameKey: 'name' },
  biteByNightSkinsGuide: { field: 'items', nameKey: 'name' },
  biteByNightMarionetteGuide: { field: 'items', nameKey: 'title' },
  biteByNightLoreGuide: { field: 'items', nameKey: 'title' },
  biteByNightWiki: { field: 'items', nameKey: 'title' },
}

// Extra keywords per module to boost semantic matching beyond title/sub-item text
const MODULE_EXTRA_KEYWORDS: Record<string, string[]> = {
  biteByNightBeginnerGuide: ['beginner', 'start', 'new player', 'tutorial', 'basics'],
  biteByNightReleaseDate: ['release', 'launch', 'date', 'early access', 'when'],
  biteByNightCodes: ['code', 'redeem', 'promo', 'free', 'reward'],
  biteByNightClassesGuide: ['class', 'customer', 'fighter', 'healer', 'security guard', 'survivor'],
  biteByNightClassTierList: ['tier', 'rank', 'best class', 'meta'],
  biteByNightKillersGuide: ['killer', 'springtrap', 'mimic', 'ennard', 'marionette', 'mangle'],
  biteByNightKillerTierList: ['killer tier', 'best killer', 'rank'],
  biteByNightSurvivorGuide: ['survivor', 'escape', 'objective', 'generator'],
  biteByNightSpringtrapGuide: ['springtrap', 'trap', 'axe', 'cleaver', 'scream'],
  biteByNightTheMimicGuide: ['mimic', 'mode', 'speed', 'strength', 'stealth', 'stance'],
  biteByNightEnnardGuide: ['ennard', 'disguise', 'hijack', 'wire', 'pull'],
  biteByNightMapsGuide: ['map', 'forest', 'warehouse', 'location'],
  biteByNightSkinsGuide: ['skin', 'cosmetic', 'variant', 'appearance'],
  biteByNightMarionetteGuide: ['marionette', 'puppet', 'charlie', 'upcoming'],
  biteByNightLoreGuide: ['lore', 'story', 'fnaf', 'narrative'],
  biteByNightWiki: ['wiki', 'hub', 'database', 'navigation', 'browse'],
}

const FILLER_WORDS = ['bite', 'night', 'by', '2026', '2025', 'complete', 'guide', 'best', 'the', 'and', 'for', 'how', 'with', 'our', 'this', 'your', 'all', 'from', 'learn']

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getSignificantTokens(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter(w => w.length > 2 && !FILLER_WORDS.includes(w))
}

function matchScore(queryText: string, article: ArticleWithType, extraKeywords?: string[]): number {
  const normalizedQuery = normalize(queryText)
  const normalizedTitle = normalize(article.frontmatter.title)
  const normalizedDesc = normalize(article.frontmatter.description || '')
  const normalizedSlug = article.slug.replace(/-/g, ' ').toLowerCase()

  let score = 0

  // Exact phrase match in title
  if (normalizedTitle.includes(normalizedQuery)) {
    score += 100
  }

  // Token overlap
  const queryTokens = getSignificantTokens(queryText)
  for (const token of queryTokens) {
    if (normalizedTitle.includes(token)) score += 20
    if (normalizedDesc.includes(token)) score += 5
    if (normalizedSlug.includes(token)) score += 15
  }

  // Extra keyword boost
  if (extraKeywords) {
    for (const kw of extraKeywords) {
      const nkw = normalize(kw)
      if (normalizedTitle.includes(nkw)) score += 10
      if (normalizedSlug.includes(nkw)) score += 8
      if (normalizedDesc.includes(nkw)) score += 3
    }
  }

  return score
}

function findBestMatch(queryText: string, articles: ArticleWithType[], extraKeywords?: string[]): ArticleLink | null {
  let bestScore = 0
  let bestArticle: ArticleWithType | null = null

  for (const article of articles) {
    const score = matchScore(queryText, article, extraKeywords)
    if (score > bestScore) {
      bestScore = score
      bestArticle = article
    }
  }

  if (bestScore >= 20 && bestArticle) {
    return {
      url: `/${bestArticle.contentType}/${bestArticle.slug}`,
      title: bestArticle.frontmatter.title,
    }
  }

  return null
}

export async function buildModuleLinkMap(locale: Language): Promise<ModuleLinkMap> {
  // 1. Load all articles across all content types
  const allArticles: ArticleWithType[] = []
  for (const contentType of CONTENT_TYPES) {
    const items = await getAllContent(contentType, locale)
    for (const item of items) {
      allArticles.push({ ...item, contentType })
    }
  }

  // 2. Load module data from en.json (use English for keyword matching)
  const enMessages = (await import('../locales/en.json')).default as any

  const linkMap: ModuleLinkMap = {}

  // 3. For each module, match h2 title and sub-items
  for (const [moduleKey, fieldConfig] of Object.entries(MODULE_FIELDS)) {
    const moduleData = enMessages.modules?.[moduleKey]
    if (!moduleData) continue

    const extraKw = MODULE_EXTRA_KEYWORDS[moduleKey]

    // Match module h2 title
    const moduleTitle = moduleData.title as string
    if (moduleTitle) {
      linkMap[moduleKey] = findBestMatch(moduleTitle, allArticles, extraKw)
    }

    // Match sub-items
    const subItems = moduleData[fieldConfig.field] as any[]
    if (Array.isArray(subItems)) {
      for (let i = 0; i < subItems.length; i++) {
        const itemName = subItems[i]?.[fieldConfig.nameKey] as string
        if (itemName) {
          const key = `${moduleKey}::${fieldConfig.field}::${i}`
          linkMap[key] = findBestMatch(itemName, allArticles, extraKw)
        }
      }
    }
  }

  return linkMap
}
