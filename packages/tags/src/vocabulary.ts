/**
 * Zone Tags — Closed Vocabulary + Semantic Matching
 *
 * The tag system is the ONLY data structure for filtering.
 * Tags are hierarchical, closed-vocabulary, and system-only.
 *
 * ⚠️ Users never tag. The system tags everything.
 */

// ─── Initial Closed Vocabulary ───

export interface VocabularyEntry {
  path: string;
  label: string;
  labelEn: string;
  children?: VocabularyEntry[];
}

/**
 * Initial closed vocabulary for Zone v1.0.0
 * This will grow over time as new tags are demanded (≥3 requests).
 */
export const INITIAL_VOCABULARY: VocabularyEntry[] = [
  {
    path: 'services',
    label: 'خدمات',
    labelEn: 'Services',
    children: [
      { path: 'services/house_painting', label: 'نقاشی ساختمان', labelEn: 'House Painting' },
      { path: 'services/plumbing', label: 'لوله‌کشی', labelEn: 'Plumbing' },
      { path: 'services/electrical', label: 'برقکاری', labelEn: 'Electrical' },
      { path: 'services/cleaning', label: 'نظافت', labelEn: 'Cleaning' },
      { path: 'services/repair', label: 'تعمیرات', labelEn: 'Repair' },
      { path: 'services/moving', label: 'اسباب‌کشی', labelEn: 'Moving' },
      { path: 'services/carpentry', label: 'نجاری', labelEn: 'Carpentry' },
      { path: 'services/tiling', label: 'سرامیک‌کاری', labelEn: 'Tiling' },
      { path: 'services/air_conditioning', label: 'تجهیزات سرمایشی', labelEn: 'Air Conditioning' },
      { path: 'services/locksmith', label: 'قفل‌سازی', labelEn: 'Locksmith' },
      { path: 'services/landscaping', label: 'باغبانی', labelEn: 'Landscaping' },
      { path: 'services/appliance_repair', label: 'تعمیر لوازم', labelEn: 'Appliance Repair' },
    ],
  },
  {
    path: 'urgency',
    label: 'فوریت',
    labelEn: 'Urgency',
    children: [
      { path: 'urgency/normal', label: 'عادی', labelEn: 'Normal' },
      { path: 'urgency/urgent', label: 'فوری', labelEn: 'Urgent' },
      { path: 'urgency/emergency', label: 'اضطراری', labelEn: 'Emergency' },
    ],
  },
  {
    path: 'social',
    label: 'اجتماعی',
    labelEn: 'Social',
    children: [
      { path: 'social/sports', label: 'ورزش', labelEn: 'Sports' },
      { path: 'social/walking', label: 'پیاده‌روی', labelEn: 'Walking' },
      { path: 'social/gaming', label: 'بازی', labelEn: 'Gaming' },
      { path: 'social/food', label: 'غذا', labelEn: 'Food' },
      { path: 'social/party', label: 'جشن', labelEn: 'Party' },
      { path: 'social/trip', label: 'سفر', labelEn: 'Trip' },
      { path: 'social/study', label: 'مطالعه', labelEn: 'Study' },
      { path: 'social/volunteer', label: 'خیریه', labelEn: 'Volunteer' },
    ],
  },
  {
    path: 'support',
    label: 'حمایت',
    labelEn: 'Support',
    children: [
      { path: 'support/advice', label: 'مشاوره', labelEn: 'Advice' },
      { path: 'support/brainstorm', label: 'همفکری', labelEn: 'Brainstorm' },
      { path: 'support/help', label: 'کمک', labelEn: 'Help' },
    ],
  },
  {
    path: 'location',
    label: 'مکان',
    labelEn: 'Location',
    children: [
      // These will be populated dynamically based on neighbourhoods
      // e.g. location/vanak, location/narak
    ],
  },
];

// ─── Tag Service ───

export class TagService {
  private vocabulary: Map<string, VocabularyEntry> = new Map();
  private aliases: Map<string, string> = new Map();
  private demandQueue: Map<string, number> = new Map();

  constructor() {
    this.loadVocabulary(INITIAL_VOCABULARY);
  }

  /**
   * Load vocabulary entries into the lookup map
   */
  private loadVocabulary(entries: VocabularyEntry[]): void {
    for (const entry of entries) {
      this.vocabulary.set(entry.path, entry);
      if (entry.children) {
        this.loadVocabulary(entry.children);
      }
    }
  }

  /**
   * Suggest tags from the closed vocabulary based on a concept
   * This is the core of the semantic matching system.
   */
  async suggest(concept: string): Promise<string[]> {
    const normalizedConcept = concept.toLowerCase().trim();
    const matches: Array<{ path: string; score: number }> = [];

    // 1. Exact match
    for (const [path, entry] of this.vocabulary) {
      if (
        entry.label.includes(normalizedConcept) ||
        entry.labelEn.toLowerCase().includes(normalizedConcept) ||
        path.includes(normalizedConcept)
      ) {
        matches.push({ path, score: 1.0 });
      }
    }

    // 2. Alias match
    const aliasMatch = this.aliases.get(normalizedConcept);
    if (aliasMatch) {
      matches.push({ path: aliasMatch, score: 0.95 });
    }

    // 3. Partial match (substring)
    for (const [path, entry] of this.vocabulary) {
      if (
        entry.label.includes(normalizedConcept) ||
        entry.labelEn.toLowerCase().includes(normalizedConcept)
      ) {
        if (!matches.find((m) => m.path === path)) {
          matches.push({ path, score: 0.7 });
        }
      }
    }

    // Sort by score and return unique paths
    matches.sort((a, b) => b.score - a.score);
    return [...new Set(matches.map((m) => m.path))];
  }

  /**
   * Register a demand for a new tag
   * If demand reaches ≥3, the tag becomes a candidate for addition
   */
  async demand(concept: string): Promise<{ status: 'existing' | 'queued' | 'pending'; tag?: string }> {
    // Check if it already exists
    const existing = await this.suggest(concept);
    if (existing.length > 0) {
      return { status: 'existing', tag: existing[0] };
    }

    // Check demand queue
    const count = (this.demandQueue.get(concept) || 0) + 1;
    this.demandQueue.set(concept, count);

    if (count >= 3) {
      return { status: 'pending', tag: concept };
    }

    return { status: 'queued' };
  }

  /**
   * Add an alias for an existing tag
   */
  addAlias(alias: string, tagPath: string): void {
    this.aliases.set(alias.toLowerCase(), tagPath);
  }

  /**
   * Get the full vocabulary
   */
  getVocabulary(): VocabularyEntry[] {
    return INITIAL_VOCABULARY;
  }

  /**
   * Get flat list of all tag paths
   */
  getAllPaths(): string[] {
    return Array.from(this.vocabulary.keys());
  }

  /**
   * Check if a tag path exists in the vocabulary
   */
  exists(path: string): boolean {
    return this.vocabulary.has(path);
  }

  /**
   * Get a specific tag entry
   */
  get(path: string): VocabularyEntry | undefined {
    return this.vocabulary.get(path);
  }
}
