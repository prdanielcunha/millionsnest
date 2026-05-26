import i18n from 'i18next';
import pt from './locales/pt.js';
import en from './locales/en.js';
import es from './locales/es.js';

export interface LocaleCompleteness {
  score: number; // percentage (0-100)
  totalKeys: number;
  definedKeys: number;
  missingKeys: string[];
}

export interface I18nDiagnosticsReport {
  overallScore: number;
  languages: {
    pt: LocaleCompleteness;
    en: LocaleCompleteness;
    es: LocaleCompleteness;
  };
  hasMismatchedNamespaces: boolean;
  mismatchedNamespaces: string[];
}

/**
 * Recursively flattens a nested object into dot-notation keys
 */
export function flattenKeys(obj: any, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return [];
  
  return Object.keys(obj).reduce((res: string[], key) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      res.push(...flattenKeys(obj[key], fullKey));
    } else {
      res.push(fullKey);
    }
    return res;
  }, []);
}

/**
 * Runs a static i18n analysis of predefined resources
 */
export function runStaticI18nAudit(): I18nDiagnosticsReport {
  const ptKeys = flattenKeys(pt);
  const enKeys = flattenKeys(en);
  const esKeys = flattenKeys(es);

  const ptSet = new Set(ptKeys);
  const enSet = new Set(enKeys);
  const esSet = new Set(esKeys);

  // Union of all known keys across all locales to find completeness
  const allKeys = Array.from(new Set([...ptKeys, ...enKeys, ...esKeys]));

  const getCompleteness = (langKeys: Set<string>): LocaleCompleteness => {
    const missing = allKeys.filter(k => !langKeys.has(k));
    const definedKeys = allKeys.length - missing.length;
    const score = allKeys.length > 0 ? parseFloat(((definedKeys / allKeys.length) * 100).toFixed(1)) : 100;
    
    return {
      score,
      totalKeys: allKeys.length,
      definedKeys,
      missingKeys: missing
    };
  };

  const ptAnalysis = getCompleteness(ptSet);
  const enAnalysis = getCompleteness(enSet);
  const esAnalysis = getCompleteness(esSet);

  const overallScore = parseFloat(((ptAnalysis.score + enAnalysis.score + esAnalysis.score) / 3).toFixed(1));

  // Namespaces analysis
  const ptNamespaces = Object.keys(pt);
  const enNamespaces = Object.keys(en);
  const esNamespaces = Object.keys(es);

  const allNamespaces = Array.from(new Set([...ptNamespaces, ...enNamespaces, ...esNamespaces]));
  const mismatched = allNamespaces.filter(
    ns => !ptNamespaces.includes(ns) || !enNamespaces.includes(ns) || !esNamespaces.includes(ns)
  );

  return {
    overallScore,
    languages: {
      pt: ptAnalysis,
      en: enAnalysis,
      es: esAnalysis
    },
    hasMismatchedNamespaces: mismatched.length > 0,
    mismatchedNamespaces: mismatched
  };
}

// Runtime tracker for dynamic leaks / missing translations
class DynamicI18nTracker {
  private missingKeys: Set<string> = new Set();
  private renderedKeys: Set<string> = new Set();
  private listeners: (() => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      // Connect with i18next missing key event handler
      i18n.on('missingKey', (lngs, namespace, key) => {
        const fullKey = `${namespace}:${key}`;
        this.missingKeys.add(fullKey);
        this.notify();
      });
    }
  }

  public registerRendered(key: string) {
    this.renderedKeys.add(key);
    this.notify();
  }

  public getMissingKeys(): string[] {
    return Array.from(this.missingKeys);
  }

  public getRenderedKeys(): string[] {
    return Array.from(this.renderedKeys);
  }

  public clear() {
    this.missingKeys.clear();
    this.renderedKeys.clear();
    this.notify();
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }
}

export const dynamicI18nTracker = new DynamicI18nTracker();
