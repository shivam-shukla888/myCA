import { RetrievalCategory } from './rag.schema.js';
import { injectionDetector } from '../ingestion/injectionDetector.js';
import { AppError } from '../../../middleware/errorHandler.js';

const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
  'any', 'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below',
  'between', 'both', 'but', 'by', 'can', 'could', 'did', 'do', 'does', 'doing',
  'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have',
  'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how',
  'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more',
  'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once',
  'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same',
  'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them',
  'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to',
  'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when',
  'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your',
  // Common Hinglish non-financial stop words
  'mera', 'meri', 'mere', 'kya', 'hai', 'hain', 'me', 'mein', 'ko', 'se', 'par',
  'kahan', 'kaun', 'kaise', 'bhi', 'aur', 'toh', 'tha', 'thi', 'the',
]);

// Map colloquial/Hinglish terms to foundational financial keywords
const HINGLISH_SYNONYM_MAP: Record<string, string[]> = {
  paisa: ['money', 'cash', 'income', 'wealth'],
  paise: ['money', 'cash', 'spending'],
  kharcha: ['expense', 'spending', 'outflow'],
  kharch: ['expense', 'spending'],
  bachat: ['savings', 'surplus', 'retention'],
  kamai: ['income', 'salary', 'earnings'],
  mahina: ['monthly', 'month'],
  mahine: ['monthly', 'month'],
  karza: ['debt', 'loan', 'liability'],
  karz: ['debt', 'loan'],
  udhar: ['debt', 'loan', 'credit'],
  nivesh: ['investing', 'investment', 'portfolio'],
  byaaj: ['interest', 'apr', 'yield'],
  byaj: ['interest', 'yield'],
  pehle: ['priority', 'first'],
};

export interface NormalizedQuery {
  raw: string;
  normalized: string;
  tokens: string[];
  category: RetrievalCategory;
  isRegulatoryOrTax: boolean;
}

export class QueryNormalizer {
  /**
   * Normalizes the user query, verifies security, extracts tokens, maps Hinglish/synonyms, and infers category
   */
  normalize(rawQuery: string, explicitCategory?: RetrievalCategory): NormalizedQuery {
    const trimmed = rawQuery.trim();

    // 1. Prompt injection detection
    const injectionCheck = injectionDetector.detectInjection(trimmed);
    if (injectionCheck.hasInjection) {
      throw new AppError(
        `Prompt injection attempt detected in search query: ${injectionCheck.patterns.join(', ')}`,
        400,
        'SECURITY_INJECTION_DETECTED'
      );
    }

    // 2. Text normalization
    const lower = trimmed.toLowerCase();
    const cleanPunctuation = lower.replace(/[^a-z0-9\s-_]/g, ' ');
    const rawTokens = cleanPunctuation.split(/\s+/).filter(Boolean);

    // 3. Token extraction with Hinglish synonym expansion
    const expandedTokens: string[] = [];
    for (const t of rawTokens) {
      if (t.length > 1 && !STOPWORDS.has(t)) {
        expandedTokens.push(t);
      }
      if (HINGLISH_SYNONYM_MAP[t]) {
        expandedTokens.push(...HINGLISH_SYNONYM_MAP[t]);
      }
    }

    // Deduplicate tokens
    const tokens = Array.from(new Set(expandedTokens));

    // 4. Infer category if not explicitly provided
    const category = explicitCategory || this.inferCategory(lower);
    const isRegulatoryOrTax = category === 'CURRENT_REGULATION' || category === 'TAX';

    return {
      raw: trimmed,
      normalized: lower,
      tokens,
      category,
      isRegulatoryOrTax,
    };
  }

  private inferCategory(text: string): RetrievalCategory {
    if (/\b(sebi|rbi|dicgc|circular|regulation|regulations|master\s*direction|compliance|statutory|notification|rule\b|deposit\s*insurance)\b/i.test(text)) {
      return 'CURRENT_REGULATION';
    }
    if (/\b(tax|income\s*tax|80c|80d|80g|87a|115bac|standard\s*deduction|rebate|capital\s*gains|stcg|ltcg|itr|deduction|deductions|exemption|tax\s*regime|slab|tds|tcs)\b/i.test(text)) {
      return 'TAX';
    }
    if (/\b(loss\s*aversion|present\s*bias|psychology\s*of\s*money|morgan\s*housel|psychology|emotion|emotional|impulsive|spending\s*habit|lifestyle\s*inflation|status\s*spending|scarcity|procrastination|mental\s*accounting|fear\s*of\s*investing|decision\s*fatigue)\b/i.test(text)) {
      return 'BEHAVIORAL_FINANCE';
    }
    if (/\b(fire|financial\s*freedom|corpus|safe\s*withdrawal|4%\s*rule|retirement\s*age|passive\s*income|swr)\b/i.test(text)) {
      return 'FINANCIAL_INDEPENDENCE';
    }
    if (/\b(index\s*fund|mutual\s*fund|sip|equity|debt\s*fund|etf|asset\s*allocation|diversification|compound\s*interest|stock\s*market|nivesh|share\s*market)\b/i.test(text)) {
      return 'INVESTING_EDUCATION';
    }
    if (/\b(inflation|gdp|interest\s*rate|repo\s*rate|monetary\s*policy|recession|macroeconomics|economics|purchasing\s*power)\b/i.test(text)) {
      return 'ECONOMIC';
    }
    if (/\b(paisa|kharcha|bachat|mahina|kamai|budget|emergency\s*fund|savings\s*rate|surplus|deficit|debt|karza|udhar|loan|expense\s*tracking|spending|cashflow)\b/i.test(text)) {
      return 'PERSONAL_FINANCE';
    }
    return 'EDUCATIONAL';
  }
}

export const queryNormalizer = new QueryNormalizer();
