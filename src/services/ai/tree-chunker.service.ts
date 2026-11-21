/**
 * TreeChunker Service
 * Implements 3-tier hierarchical parent-child chunking:
 * - Tier 1: Large chunks (~800 - 1200 tokens) for thematic context
 * - Tier 2: Medium chunks (~350 - 500 tokens) for paragraph sections
 * - Tier 3: Small chunks (~100 - 200 tokens) for atomic facts, fees, and exact matches
 */

export interface RawChunk {
  tempId: string;
  tier: 'LARGE' | 'MEDIUM' | 'SMALL';
  chunkIndex: number;
  parentTempId?: string;
  grandParentTempId?: string;
  title: string;
  text: string;
  tokenCount: number;
}

export interface TreeChunkResult {
  largeChunks: RawChunk[];
  mediumChunks: RawChunk[];
  smallChunks: RawChunk[];
  totalTokens: number;
}

export class TreeChunker {
  /**
   * Fast token estimation (average ~4 chars per token for English).
   */
  public static estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  /**
   * Chunks a document into a 3-tier hierarchical tree.
   */
  public static chunkDocument(text: string, baseTitle: string): TreeChunkResult {
    const largeChunks: RawChunk[] = [];
    const mediumChunks: RawChunk[] = [];
    const smallChunks: RawChunk[] = [];

    let totalTokens = 0;
    let globalLargeIndex = 0;
    let globalMediumIndex = 0;
    let globalSmallIndex = 0;

    // 1. Split into Tier 1 (Large Chunks ~800 - 1200 tokens)
    const largeSections = this.splitIntoLargeSections(text, baseTitle);

    for (const largeSec of largeSections) {
      const largeTempId = `large_${globalLargeIndex}`;
      const largeTokens = this.estimateTokens(largeSec.text);
      totalTokens += largeTokens;

      const largeChunk: RawChunk = {
        tempId: largeTempId,
        tier: 'LARGE',
        chunkIndex: globalLargeIndex++,
        title: largeSec.title,
        text: largeSec.text,
        tokenCount: largeTokens,
      };
      largeChunks.push(largeChunk);

      // 2. Split Large Section into Tier 2 (Medium Chunks ~350 - 500 tokens)
      const mediumSections = this.splitIntoMediumSections(largeSec.text, largeSec.title);

      for (const medSec of mediumSections) {
        const medTempId = `med_${globalMediumIndex}`;
        const medTokens = this.estimateTokens(medSec.text);

        const medChunk: RawChunk = {
          tempId: medTempId,
          tier: 'MEDIUM',
          chunkIndex: globalMediumIndex++,
          parentTempId: largeTempId,
          title: medSec.title,
          text: medSec.text,
          tokenCount: medTokens,
        };
        mediumChunks.push(medChunk);

        // 3. Split Medium Section into Tier 3 (Small Chunks ~100 - 200 tokens)
        const smallSections = this.splitIntoSmallSections(medSec.text, medSec.title);

        for (const smSec of smallSections) {
          const smTempId = `small_${globalSmallIndex}`;
          const smTokens = this.estimateTokens(smSec.text);

          const smChunk: RawChunk = {
            tempId: smTempId,
            tier: 'SMALL',
            chunkIndex: globalSmallIndex++,
            parentTempId: medTempId,
            grandParentTempId: largeTempId,
            title: smSec.title,
            text: smSec.text,
            tokenCount: smTokens,
          };
          smallChunks.push(smChunk);
        }
      }
    }

    return {
      largeChunks,
      mediumChunks,
      smallChunks,
      totalTokens,
    };
  }

  /**
   * Splits entire text into Large Sections (~600 - 1000 tokens)
   */
  private static splitIntoLargeSections(
    text: string,
    baseTitle: string
  ): { title: string; text: string }[] {
    const paragraphs = text.split(/\n\n+/);
    const sections: { title: string; text: string }[] = [];

    let currentParagraphs: string[] = [];
    let currentTokens = 0;
    let sectionTitle = baseTitle;

    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i].trim();
      if (!p) continue;

      const pTokens = this.estimateTokens(p);

      // Check if this paragraph is a major header
      const isHeader = this.isHeaderLine(p);
      if (isHeader && currentParagraphs.length > 0 && currentTokens >= 300) {
        // Flush current large section
        sections.push({
          title: sectionTitle,
          text: currentParagraphs.join('\n\n'),
        });
        currentParagraphs = [];
        currentTokens = 0;
        sectionTitle = p.replace(/^#+\s*/, '').slice(0, 80);
      }

      currentParagraphs.push(p);
      currentTokens += pTokens;

      // If token count exceeds ~800 tokens, split
      if (currentTokens >= 800) {
        sections.push({
          title: sectionTitle,
          text: currentParagraphs.join('\n\n'),
        });
        currentParagraphs = [];
        currentTokens = 0;
      }
    }

    if (currentParagraphs.length > 0) {
      sections.push({
        title: sectionTitle,
        text: currentParagraphs.join('\n\n'),
      });
    }

    return sections.length > 0 ? sections : [{ title: baseTitle, text }];
  }

  /**
   * Splits a Large Section into Medium Sections (~250 - 450 tokens)
   */
  private static splitIntoMediumSections(
    largeText: string,
    parentTitle: string
  ): { title: string; text: string }[] {
    const paragraphs = largeText.split(/\n\n+/);
    const mediumSections: { title: string; text: string }[] = [];

    let currentParagraphs: string[] = [];
    let currentTokens = 0;
    let medTitle = parentTitle;

    for (const p of paragraphs) {
      const trimmed = p.trim();
      if (!trimmed) continue;

      const pTokens = this.estimateTokens(trimmed);

      // Any header line defines a new Medium topic section
      if (this.isHeaderLine(trimmed) && currentParagraphs.length > 0) {
        mediumSections.push({
          title: medTitle,
          text: currentParagraphs.join('\n\n'),
        });
        currentParagraphs = [];
        currentTokens = 0;
        medTitle = trimmed.replace(/^#+\s*/, '').slice(0, 80);
      }

      currentParagraphs.push(trimmed);
      currentTokens += pTokens;

      if (currentTokens >= 400) {
        mediumSections.push({
          title: medTitle,
          text: currentParagraphs.join('\n\n'),
        });
        currentParagraphs = [];
        currentTokens = 0;
      }
    }

    if (currentParagraphs.length > 0) {
      mediumSections.push({
        title: medTitle,
        text: currentParagraphs.join('\n\n'),
      });
    }

    return mediumSections.length > 0 ? mediumSections : [{ title: parentTitle, text: largeText }];
  }

  /**
   * Splits a Medium Section into Small Chunks (~100 - 180 tokens)
   * Preserves whole bullet points and numbered items intact so facts and fees are never bifurcated.
   */
  private static splitIntoSmallSections(
    mediumText: string,
    parentTitle: string
  ): { title: string; text: string }[] {
    // Split cleanly on newlines followed by bullets, numbers, or section headers
    const rawUnits = mediumText
      .split(/\n+(?=[-•*]|\d+\.|\b[A-Z][a-zA-Z\s]+:)/)
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    const smallSections: { title: string; text: string }[] = [];
    let currentUnits: string[] = [];
    let currentTokens = 0;

    for (const unit of rawUnits) {
      const unitTokens = this.estimateTokens(unit);

      // If adding this unit exceeds 160 tokens, flush current block
      if (currentTokens + unitTokens > 160 && currentUnits.length > 0) {
        smallSections.push({
          title: parentTitle,
          text: currentUnits.join('\n'),
        });
        currentUnits = [];
        currentTokens = 0;
      }

      currentUnits.push(unit);
      currentTokens += unitTokens;
    }

    if (currentUnits.length > 0) {
      smallSections.push({
        title: parentTitle,
        text: currentUnits.join('\n'),
      });
    }

    return smallSections.length > 0 ? smallSections : [{ title: parentTitle, text: mediumText }];
  }

  /**
   * Helper: Check if a line resembles a heading or section header
   */
  private static isHeaderLine(line: string): boolean {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) return true;
    if (/^[A-Z0-9\s.,:-]{3,60}$/.test(trimmed) && !trimmed.endsWith('.')) return true;
    if (/^(?:Section|Chapter|Article|Rule|Policy)\s+\d+/i.test(trimmed)) return true;
    return false;
  }
}
