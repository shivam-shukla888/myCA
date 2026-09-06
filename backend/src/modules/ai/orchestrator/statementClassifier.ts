import {
  StatementType,
  StructuredStatement,
  ReasoningBreakdown,
} from './answerOrchestrator.schema.js';

export class StatementClassifier {
  /**
   * Deconstructs and classifies the generated answer into verified categories:
   * FACT, CALCULATION, ASSUMPTION, INTERPRETATION, and GENERAL GUIDANCE.
   */
  classifyResponse(
    answer: string,
    context?: {
      knownCalculations?: Record<string, any>;
      verifiedSources?: string[];
      hasAssumptions?: boolean;
    }
  ): { statements: StructuredStatement[]; breakdown: ReasoningBreakdown } {
    const rawSentences = answer
      .split(/(?<=[.!?])\s+(?=[A-Z0-9₹"'\n])|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);

    const statements: StructuredStatement[] = [];
    const breakdown: ReasoningBreakdown = {
      facts: [],
      calculations: [],
      assumptions: [],
      interpretations: [],
      general_guidance: [],
    };

    for (const sentence of rawSentences) {
      const type = this.detectStatementType(sentence);
      const sourceRef = this.resolveSourceReference(type, sentence, context);

      const item: StructuredStatement = {
        type,
        statement: sentence,
        source_reference: sourceRef,
      };

      statements.push(item);

      switch (type) {
        case 'FACT':
          breakdown.facts.push(sentence);
          break;
        case 'CALCULATION':
          breakdown.calculations.push(sentence);
          break;
        case 'ASSUMPTION':
          breakdown.assumptions.push(sentence);
          break;
        case 'INTERPRETATION':
          breakdown.interpretations.push(sentence);
          break;
        case 'GENERAL_GUIDANCE':
          breakdown.general_guidance.push(sentence);
          break;
      }
    }

    // Guard: Ensure at least one entry in breakdown if sentences were extracted
    if (statements.length > 0 && breakdown.facts.length === 0 && breakdown.calculations.length === 0 && breakdown.interpretations.length === 0) {
      breakdown.interpretations.push(statements[0].statement);
    }

    return { statements, breakdown };
  }

  private detectStatementType(sentence: string): StatementType {
    const lower = sentence.toLowerCase();

    // 1. ASSUMPTIONS: Words like 'assuming', 'assumption', 'hypothetically', 'if we project', 'estimated at'
    if (
      /\b(assuming|assumption|assumes|projected\s*at|estimated\s*at|hypothetically|expected\s*return\s*of|if\s*we\s*assume|conservatively\s*estimating)\b/i.test(
        lower
      )
    ) {
      return 'ASSUMPTION';
    }

    // 1.5. UNVERIFIED CLAIMS & FAKE QUOTES: Quotes, speculative assertions, or guaranteed claims default to INTERPRETATION
    if (/\b(guaranteed|personally\s*said|said\s*to\s*buy|claims\s*that|day\s*traders|double\s*money)\b/i.test(lower)) {
      return 'INTERPRETATION';
    }

    // 2. INTERPRETATIONS: Diagnostic reasoning, financial evaluation, spending pressure
    if (
      /\b(spending\s*pressure|comfortable|unaffordable|tight|concerning|healthy\s*cushion|financial\s*strain|on\s*track|off\s*track|means\s*that|indicates\s*that|suggests\s*that)\b/i.test(
        lower
      )
    ) {
      return 'INTERPRETATION';
    }

    // 3. GENERAL GUIDANCE / ADVICE: Prescriptive or educational guidance
    if (
      /\b(recommend|consider|should\s*(focus|prioritize|allocate|avoid|build)|next\s*step|action\s*item|rule\s*of\s*thumb|advisable\s*to|suggested\s*to)\b/i.test(
        lower
      )
    ) {
      return 'GENERAL_GUIDANCE';
    }

    // 4. FACTS: Verified statutory notices, official sections, SEBI circulars, Income Tax (must not be hearsay/quote)
    if (
      (/\b(section\s*80[c-z]|income\s*tax\s*act|sebi|rbi|circular|master\s*direction|guideline|statutory|official\s*limit|gazette)\b/i.test(
        lower
      ) ||
      /\b(under\s*the\s*(old|new)\s*tax\s*regime|deduction\s*limit\s*is\s*₹|maximum\s*permissible)\b/i.test(lower)) &&
      !/\b(said|personally|claims|tweeted)\b/i.test(lower)
    ) {
      return 'FACT';
    }

    // 5. CALCULATIONS: Contains mathematical results, percentages, surplus, totals, formulas, ₹ amounts
    if (
      /\b(surplus|savings\s*rate|saving\s*₹|total\s*(income|expenses|allocated|gap)|minus|difference|equals|equates)\b/i.test(lower) ||
      (/\b(income|expenses|allocated|allocation|surplus|saving)\b/i.test(lower) && (lower.includes('₹') || /\b(rs\.?|inr)\b/i.test(lower))) ||
      /\d+(\.\d+)?%/.test(lower) ||
      (/\b(calculate|calculated|computation|math|formula)\b/i.test(lower) && (lower.includes('₹') || /\b(rs\.?|inr)\b/i.test(lower)))
    ) {
      return 'CALCULATION';
    }

    // 6. Default to INTERPRETATION
    return 'INTERPRETATION';
  }

  private resolveSourceReference(
    type: StatementType,
    sentence: string,
    context?: {
      knownCalculations?: Record<string, any>;
      verifiedSources?: string[];
    }
  ): string | undefined {
    switch (type) {
      case 'CALCULATION':
        return 'deterministic_calculation_engine';
      case 'FACT':
        if (context?.verifiedSources && context.verifiedSources.length > 0) {
          return `verified_source:${context.verifiedSources[0]}`;
        }
        return 'verified_financial_records';
      case 'ASSUMPTION':
        return 'planning_parameters';
      case 'GENERAL_GUIDANCE':
        return 'educational_framework';
      case 'INTERPRETATION':
        return 'ai_reasoning_layer';
      default:
        return undefined;
    }
  }
}

export const statementClassifier = new StatementClassifier();
