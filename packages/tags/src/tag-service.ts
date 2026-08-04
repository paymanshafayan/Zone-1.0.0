/**
 * Zone Tag Service — Complete Implementation
 *
 * Phase 4: Closed vocabulary + semantic matching + demand queue + device sync
 *
 * The tag system is the ONLY data structure for filtering.
 * - Tags are hierarchical, closed-vocabulary, and system-only
 * - Users never tag — the system tags everything
 * - New tags are added only when demanded ≥3 times
 * - Semantic matching uses pgvector for similarity
 * - Vocabulary is synced to devices for on-device processing
 */

import { Logger } from '@zone/core';
import {
  INITIAL_VOCABULARY,
  type VocabularyEntry,
} from './vocabulary';

// ─── Types ───

export interface Tag {
  id: string;
  path: string;
  label: string;
  labelEn: string;
  parentId: string | null;
  demandCount: number;
  isApproved: boolean;
  aliases: string[];
  createdAt: Date;
}

export interface TagSuggestion {
  path: string;
  label: string;
  labelEn: string;
  score: number;
  source: 'exact' | 'alias' | 'semantic' | 'partial';
}

export interface DemandEntry {
  concept: string;
  count: number;
  firstRequestedAt: Date;
  lastRequestedAt: Date;
  status: 'queued' | 'pending' | 'approved' | 'rejected';
}

export interface VocabularySyncPayload {
  version: number;
  timestamp: number;
  tags: Array<{
    path: string;
    label: string;
    labelEn: string;
    aliases: string[];
  }>;
  deletedPaths: string[];
}

// ─── Semantic Matching ───

/**
 * Simple semantic similarity using keyword overlap and path proximity.
 * In production, this will use pgvector with embeddings.
 * This implementation is for development and testing.
 */
export class SemanticMatcher {
  private tagVectors: Map<string, Set<string>> = new Map();

  /**
   * Build a simple keyword vector for a tag
   * In production, this would be an embedding from a model
   */
  buildVector(tag: Tag, extraKeywords: string[] = []): Set<string> {
    const keywords = new Set<string>();

    // From path segments
    const segments = tag.path.split('/');
    for (const segment of segments) {
      keywords.add(segment.toLowerCase());
      // Add common variations
      keywords.add(segment.replace(/_/g, ' ').toLowerCase());
    }

    // From labels
    const labelWords = tag.label.split(/\s+/);
    for (const word of labelWords) {
      keywords.add(word.toLowerCase());
    }

    const labelEnWords = tag.labelEn.split(/\s+/);
    for (const word of labelEnWords) {
      keywords.add(word.toLowerCase());
    }

    // From aliases
    for (const alias of tag.aliases) {
      keywords.add(alias.toLowerCase());
      const aliasWords = alias.split(/\s+/);
      for (const word of aliasWords) {
        keywords.add(word.toLowerCase());
      }
    }

    // Extra keywords
    for (const kw of extraKeywords) {
      keywords.add(kw.toLowerCase());
    }

    this.tagVectors.set(tag.path, keywords);
    return keywords;
  }

  /**
   * Calculate Jaccard similarity between two sets
   */
  similarity(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;

    let intersection = 0;
    for (const item of a) {
      if (b.has(item)) intersection++;
    }

    const union = a.size + b.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Find the most similar tags to a concept
   */
  findSimilar(
    concept: string,
    tags: Tag[],
    topK: number = 5,
    minSimilarity: number = 0.2
  ): TagSuggestion[] {
    const conceptWords = new Set(
      concept.toLowerCase().split(/\s+/).filter((w) => w.length > 1)
    );

    const results: TagSuggestion[] = [];

    for (const tag of tags) {
      const tagVector = this.tagVectors.get(tag.path) || this.buildVector(tag);

      const sim = this.similarity(conceptWords, tagVector);

      if (sim >= minSimilarity) {
        results.push({
          path: tag.path,
          label: tag.label,
          labelEn: tag.labelEn,
          score: sim,
          source: 'semantic',
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }
}

// ─── Tag Service ───

export class TagService {
  private logger: Logger;
  private tags: Map<string, Tag> = new Map();
  private aliases: Map<string, string> = new Map(); // alias → tag path
  private demandQueue: Map<string, DemandEntry> = new Map();
  private semanticMatcher: SemanticMatcher;
  private vocabularyVersion: number = 1;

  constructor() {
    this.logger = new Logger({ context: { service: 'tag-service' } });
    this.semanticMatcher = new SemanticMatcher();
    this.loadVocabulary(INITIAL_VOCABULARY);
  }

  // ─── Load Vocabulary ───

  private loadVocabulary(entries: VocabularyEntry[], parentId: string | null = null): void {
    for (const entry of entries) {
      const tagId = this.generateId();

      const tag: Tag = {
        id: tagId,
        path: entry.path,
        label: entry.label,
        labelEn: entry.labelEn,
        parentId,
        demandCount: 0,
        isApproved: true, // Initial vocabulary is pre-approved
        aliases: [],
        createdAt: new Date(),
      };

      this.tags.set(entry.path, tag);

      // Build semantic vector
      this.semanticMatcher.buildVector(tag);

      // Load children
      if (entry.children) {
        this.loadVocabulary(entry.children, tagId);
      }
    }
  }

  // ─── Suggest Tags ───

  /**
   * Suggest tags from the closed vocabulary based on a concept
   * This is the core method used by the edge processor
   */
  async suggest(concept: string): Promise<TagSuggestion[]> {
    const normalizedConcept = concept.toLowerCase().trim();
    const results: TagSuggestion[] = new Array<TagSuggestion>();
    const seen = new Set<string>();

    // 1. Exact match on path
    const exactTag = this.tags.get(normalizedConcept);
    if (exactTag) {
      results.push({
        path: exactTag.path,
        label: exactTag.label,
        labelEn: exactTag.labelEn,
        score: 1.0,
        source: 'exact',
      });
      seen.add(exactTag.path);
    }

    // 2. Exact match on path segments
    for (const [path, tag] of this.tags) {
      const segments = path.split('/');
      if (segments.some((s) => s === normalizedConcept || s.replace(/_/g, ' ') === normalizedConcept)) {
        if (!seen.has(path)) {
          results.push({
            path: tag.path,
            label: tag.label,
            labelEn: tag.labelEn,
            score: 0.95,
            source: 'exact',
          });
          seen.add(path);
        }
      }
    }

    // 3. Alias match
    const aliasTarget = this.aliases.get(normalizedConcept);
    if (aliasTarget) {
      const tag = this.tags.get(aliasTarget);
      if (tag && !seen.has(tag.path)) {
        results.push({
          path: tag.path,
          label: tag.label,
          labelEn: tag.labelEn,
          score: 0.9,
          source: 'alias',
        });
        seen.add(tag.path);
      }
    }

    // 4. Partial match on label
    for (const [path, tag] of this.tags) {
      if (seen.has(path)) continue;

      if (
        tag.label.includes(normalizedConcept) ||
        tag.labelEn.toLowerCase().includes(normalizedConcept)
      ) {
        results.push({
          path: tag.path,
          label: tag.label,
          labelEn: tag.labelEn,
          score: 0.7,
          source: 'partial',
        });
        seen.add(path);
      }
    }

    // 5. Semantic match (using pgvector in production)
    const allTags = Array.from(this.tags.values());
    const semanticResults = this.semanticMatcher.findSimilar(
      normalizedConcept,
      allTags.filter((t) => !seen.has(t.path)),
      5,
      0.2
    );

    for (const result of semanticResults) {
      if (!seen.has(result.path)) {
        results.push(result);
        seen.add(result.path);
      }
    }

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    this.logger.debug('tag:suggest', {
      concept: normalizedConcept,
      results: results.length,
      topScore: results[0]?.score || 0,
    });

    return results;
  }

  // ─── Demand Queue ───

  /**
   * Register a demand for a new tag
   * If demand reaches ≥3, the tag becomes a candidate for addition
   */
  async demand(concept: string): Promise<{
    status: 'existing' | 'queued' | 'pending';
    tag?: string;
    count?: number;
  }> {
    const normalizedConcept = concept.toLowerCase().trim();

    // Check if it already exists
    const existing = await this.suggest(normalizedConcept);
    if (existing.length > 0 && existing[0].score >= 0.7) {
      return { status: 'existing', tag: existing[0].path };
    }

    // Check demand queue
    const entry = this.demandQueue.get(normalizedConcept);

    if (entry) {
      entry.count++;
      entry.lastRequestedAt = new Date();

      if (entry.count >= 3 && entry.status === 'queued') {
        entry.status = 'pending';
        this.logger.info('tag:demand:pending', {
          concept: normalizedConcept,
          count: entry.count,
        });
        return { status: 'pending', tag: normalizedConcept, count: entry.count };
      }

      return { status: 'queued', count: entry.count };
    }

    // New demand entry
    const newEntry: DemandEntry = {
      concept: normalizedConcept,
      count: 1,
      firstRequestedAt: new Date(),
      lastRequestedAt: new Date(),
      status: 'queued',
    };

    this.demandQueue.set(normalizedConcept, newEntry);

    this.logger.info('tag:demand:new', { concept: normalizedConcept });

    return { status: 'queued', count: 1 };
  }

  // ─── Alias Management ───

  /**
   * Add an alias for an existing tag
   * This helps prevent vocabulary drift
   */
  addAlias(alias: string, tagPath: string): boolean {
    const tag = this.tags.get(tagPath);
    if (!tag) return false;

    const normalizedAlias = alias.toLowerCase().trim();

    // Don't add duplicate aliases
    if (this.aliases.has(normalizedAlias)) return false;

    this.aliases.set(normalizedAlias, tagPath);
    tag.aliases.push(normalizedAlias);

    // Rebuild semantic vector with new alias
    this.semanticMatcher.buildVector(tag);

    this.logger.info('tag:alias:added', { alias: normalizedAlias, tagPath });

    return true;
  }

  // ─── Vocabulary Sync ───

  /**
   * Generate a sync payload for on-device vocabulary
   * This is sent to the mobile app to keep the edge processor updated
   */
  generateSyncPayload(lastVersion: number = 0): VocabularySyncPayload {
    const tags: VocabularySyncPayload['tags'] = [];

    for (const tag of this.tags.values()) {
      if (!tag.isApproved) continue;

      tags.push({
        path: tag.path,
        label: tag.label,
        labelEn: tag.labelEn,
        aliases: tag.aliases,
      });
    }

    const payload: VocabularySyncPayload = {
      version: this.vocabularyVersion,
      timestamp: Date.now(),
      tags,
      deletedPaths: [], // No deletions in initial version
    };

    this.logger.info('tag:sync:generated', {
      version: this.vocabularyVersion,
      tagCount: tags.length,
      aliasCount: this.aliases.size,
    });

    return payload;
  }

  /**
   * Get the current vocabulary version
   */
  getVersion(): number {
    return this.vocabularyVersion;
  }

  // ─── Query ───

  /**
   * Get the full vocabulary tree
   */
  getVocabulary(): VocabularyEntry[] {
    return INITIAL_VOCABULARY;
  }

  /**
   * Get flat list of all tag paths
   */
  getAllPaths(): string[] {
    return Array.from(this.tags.keys());
  }

  /**
   * Get all approved tags
   */
  getApprovedTags(): Tag[] {
    return Array.from(this.tags.values()).filter((t) => t.isApproved);
  }

  /**
   * Check if a tag path exists in the vocabulary
   */
  exists(path: string): boolean {
    return this.tags.has(path);
  }

  /**
   * Get a specific tag entry
   */
  get(path: string): Tag | undefined {
    return this.tags.get(path);
  }

  /**
   * Get all pending demands
   */
  getPendingDemands(): DemandEntry[] {
    return Array.from(this.demandQueue.values()).filter((d) => d.status === 'pending');
  }

  /**
   * Get all queued demands
   */
  getQueuedDemands(): DemandEntry[] {
    return Array.from(this.demandQueue.values()).filter((d) => d.status === 'queued');
  }

  /**
   * Approve a pending tag demand
   */
  approveDemand(concept: string, path: string, label: string, labelEn: string): boolean {
    const entry = this.demandQueue.get(concept);
    if (!entry || entry.status !== 'pending') return false;

    // Add the new tag
    const tagId = this.generateId();
    const newTag: Tag = {
      id: tagId,
      path,
      label,
      labelEn,
      parentId: null, // Will be set based on path hierarchy
      demandCount: entry.count,
      isApproved: true,
      aliases: [concept],
      createdAt: new Date(),
    };

    this.tags.set(path, newTag);
    this.aliases.set(concept, path);
    this.semanticMatcher.buildVector(newTag);

    entry.status = 'approved';
    this.vocabularyVersion++;

    this.logger.info('tag:approved', {
      concept,
      path,
      label,
      labelEn,
      demandCount: entry.count,
    });

    return true;
  }

  /**
   * Reject a pending tag demand
   */
  rejectDemand(concept: string): boolean {
    const entry = this.demandQueue.get(concept);
    if (!entry) return false;

    entry.status = 'rejected';

    this.logger.info('tag:rejected', { concept });

    return true;
  }

  /**
   * Get tags by branch (e.g. all tags under "services/")
   */
  getTagsByBranch(branch: string): Tag[] {
    return Array.from(this.tags.values()).filter(
      (t) => t.path.startsWith(branch)
    );
  }

  /**
   * Get tag statistics
   */
  getStats(): {
    totalTags: number;
    approvedTags: number;
    pendingDemands: number;
    queuedDemands: number;
    aliases: number;
    version: number;
  } {
    return {
      totalTags: this.tags.size,
      approvedTags: this.getApprovedTags().length,
      pendingDemands: this.getPendingDemands().length,
      queuedDemands: this.getQueuedDemands().length,
      aliases: this.aliases.size,
      version: this.vocabularyVersion,
    };
  }

  // ─── Helpers ───

  private generateId(): string {
    return `tag_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
