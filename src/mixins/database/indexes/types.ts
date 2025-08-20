import type { CollationOptions, Document } from 'mongodb';

export type MongoIndex = {
  key: Record<string, 1 | -1>;
  name?: string;
  expireAfterSeconds?: number;
  partialFilterExpression?: Record<string, unknown>;
  sparse?: boolean;
  unique?: boolean;
  collation?: CollationOptions;
};

export type IndexTuple = [MongoIndex['key'], Omit<MongoIndex, 'key'>?];

type SearchIndexCharFilter =
  | { type: 'htmlStrip'; ignoredTags?: string[] }
  | { type: 'icuNormalize' }
  | { type: 'mapping'; mappings: Record<string, string> }
  | { type: 'persian' };

type SearchIndexTokenizer =
  | { type: 'edgeGram'; minGram: number; maxGram: number }
  | { type: 'keyword' }
  | { type: 'nGram'; minGram: number; maxGram: number }
  | { type: 'regexCaptureGroup'; pattern: string; group: number }
  | { type: 'regexSplit'; pattern: string }
  | { type: 'standard'; maxTokenLength?: number }
  | { type: 'uaxUrlEmail'; maxTokenLength?: number }
  | { type: 'whitespace'; maxTokenLength?: number };

type SearchIndexTokenFilter =
  | { type: 'asciiFolding'; originalTokens?: 'include' | 'omit' }
  | { type: 'daitchMokotoffSoundex'; originalTokens?: 'include' | 'omit' }
  | {
      type: 'edgeGram';
      minGram: number;
      maxGram: number;
      termNotInBounds?: 'include' | 'omit';
    }
  | { type: 'englishPossessive' }
  | { type: 'flattenGraph' }
  | { type: 'icuFolding' }
  | {
      type: 'icuNormalizer';
      normalizationForm?: 'nfd' | 'nfc' | 'nfkd' | 'nfkc';
    }
  | { type: 'kStemming' }
  | { type: 'length'; min?: number; max?: number }
  | { type: 'lowercase' }
  | {
      type: 'nGram';
      minGram: number;
      maxGram: number;
      termNotInBounds?: 'include' | 'omit';
    }
  | { type: 'porterStemming' }
  | {
      type: 'regex';
      pattern: string;
      replacement: string;
      matches: 'all' | 'first';
    }
  | { type: 'reverse' }
  | { type: 'shingle'; minShingleSize: number; maxShingleSize: number }
  | { type: 'snowballStemming'; stemmerName: string }
  | { type: 'spanishPluralStemming' }
  | { type: 'stempel' }
  | { type: 'stopword'; tokens: string[]; ignoreCase?: boolean }
  | { type: 'trim' }
  | {
      type: 'wordDelimiterGraph';
      delimiterOptions?: {
        generateWordParts?: boolean;
        generateNumberParts?: boolean;
        concatenateWords?: boolean;
        concatenateNumbers?: boolean;
        concatenateAll?: boolean;
        preserveOriginal?: boolean;
        splitOnCaseChange?: boolean;
        splitOnNumerics?: boolean;
        stemEnglishPossessive?: boolean;
        ignoreKeywords?: boolean;
      };
      protectedWords?: { words: string[]; ignoreCase?: boolean };
    };

/**
 * Definition of a custom atlas search analyzer.
 * See https://www.mongodb.com/docs/atlas/atlas-search/analyzers/custom/#std-label-custom-analyzers
 */
export type SearchIndexCustomAnalyzers = {
  name: string;
  charFilters?: Array<SearchIndexCharFilter>;
  tokenizer: SearchIndexTokenizer;
  tokenFilters?: Array<SearchIndexTokenFilter>;
};

export type SearchIndexFieldString = {
  type: 'string';
  analyzer?: string;
  searchAnalyzer?: string;
  indexOptions?: 'docs' | 'freqs' | 'positions' | 'offsets';
  store?: boolean;
  ignoreAbove?: number;
  multi?: Record<string, SearchIndexFieldString>;
  norms?: 'include' | 'omit';
};

/**
 * Definition of a field in a search index.
 * See https://www.mongodb.com/docs/atlas/atlas-search/define-field-mappings/
 */
export type SearchIndexField =
  | {
      type: 'autocomplete';
      analyzer?: string;
      maxGrams?: number;
      minGrams?: number;
      tokenization?: 'edgeGram' | 'rightEdgeGram' | 'nGram';
      foldDiacritics?: boolean;
    }
  | { type: 'boolean' }
  | { type: 'date' }
  | { type: 'dateFacet' }
  | {
      type: 'document';
      dynamic?: boolean;
      fields?: Record<string, SearchIndexField | SearchIndexField[]>;
    }
  | {
      type: 'embeddedDocuments';
      dynamic?: boolean;
      fields?: Record<string, SearchIndexField | SearchIndexField[]>;
    }
  | { type: 'geo'; indexShapes?: boolean }
  | {
      type: 'number';
      representation?: 'double' | 'int64';
      indexIntegers?: boolean;
      indexDoubles?: boolean;
    }
  | {
      type: 'numberFacet';
      representation?: 'double' | 'int64';
      indexIntegers?: boolean;
      indexDoubles?: boolean;
    }
  | { type: 'objectId' }
  | SearchIndexFieldString
  | { type: 'stringFacet' }
  | { type: 'token'; normalizer?: 'lowercase' | 'none' };

export type SearchIndexDefinition = {
  analyzer?: string;
  searchAnalyzer?: string;
  mappings?: {
    dynamic?: boolean;
    fields?: Record<string, SearchIndexField | SearchIndexField[]>;
  };
  analyzers?: Array<SearchIndexCustomAnalyzers>;
  storedSource?: boolean | { include: string[] } | { exclude: string[] };
  synonyms?: Array<{
    analyzer: string;
    name: string;
    source: { collection: string };
  }>;
};

/**
 * Type of what is returned by listSearchIndexes.
 * See https://www.mongodb.com/docs/manual/reference/operator/aggregation/listSearchIndexes/#output
 */
export type ListSearchIndex = {
  id: string;
  name: string;
  status: 'BUILDING' | 'FAILED' | 'PENDING' | 'READY' | 'STALE';
  queryable: boolean;
  latestDefinitionVersion: { version: number; createdAt: Date };
  latestDefinition: SearchIndexDefinition;
  statusDetail: Array<{
    hostname: string;
    status: string;
    queryable: boolean;
    mainIndex: Document;
    stagedIndex: Document;
  }>;
  synonymMappingStatus: 'BUILDING' | 'FAILED' | 'READY';
  synonymMappingStatusDetail: Array<{ status: string; queryable: boolean }>;
  message: string;
};

export enum IndexStatus {
  OK = 'OK',
  MISSING = 'MISSING',
  OUTDATED = 'OUTDATED',
  NOT_DECLARED = 'NOT_DECLARED',
}

export type IndexState =
  | {
      type: 'index';
      status: IndexStatus.OK | IndexStatus.OUTDATED;
      index: MongoIndex;
      declaredIndex: IndexTuple;
    }
  | {
      type: 'index';
      status: IndexStatus.MISSING;
      declaredIndex: IndexTuple;
    }
  | {
      type: 'index';
      status: IndexStatus.NOT_DECLARED;
      index: MongoIndex;
    }
  | {
      type: 'searchIndex';
      status: IndexStatus.OK | IndexStatus.OUTDATED;
      name: string;
      searchIndex: SearchIndexDefinition;
      declaredSearchIndex: SearchIndexDefinition;
    }
  | {
      type: 'searchIndex';
      status: IndexStatus.MISSING;
      name: string;
      declaredSearchIndex: SearchIndexDefinition;
    }
  | {
      type: 'searchIndex';
      status: IndexStatus.NOT_DECLARED;
      name: string;
      searchIndex: SearchIndexDefinition;
    };
