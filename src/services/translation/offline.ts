import { lookupJapaneseWord } from '../../data/jpDictionary';

interface KuromojiToken {
  word_id: number;
  word_type: string;
  word_position: number;
  surface_form: string;
  pos: string;
  pos_detail_1: string;
  pos_detail_2: string;
  pos_detail_3: string;
  conjugated_type: string;
  conjugated_form: string;
  basic_form: string;
  reading: string;
  pronunciation: string;
}

interface KuromojiTokenizer {
  tokenize: (text: string) => KuromojiToken[];
}

let tokenizerPromise: Promise<KuromojiTokenizer> | null = null;

function initTokenizer(): Promise<KuromojiTokenizer> {
  if (tokenizerPromise) return tokenizerPromise;
  tokenizerPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/lib/kuromoji/kuromoji.js';
    script.onload = () => {
      const kuromoji = (window as unknown as Record<string, unknown>).kuromoji as {
        builder: (opts: { dicPath: string }) => { build: (cb: (err: Error | null, tokenizer: KuromojiTokenizer) => void) => void };
      };
      kuromoji.builder({ dicPath: '/lib/kuromoji/dict/' }).build((err, tokenizer) => {
        if (err) reject(err);
        else resolve(tokenizer);
      });
    };
    script.onerror = () => reject(new Error('Failed to load kuromoji.js'));
    document.head.appendChild(script);
  });
  return tokenizerPromise;
}

const PARTICLE_POS = new Set([
  '助詞',        // particle
  '助詞-格助詞',  // case particle
  '助詞-係助詞',  // binding particle
  '助詞-副助詞',  // adverbial particle
  '助詞-終助詞',  // sentence-final particle
  '助詞-接続助詞', // conjunctive particle
]);

const VERB_POS = new Set([
  '動詞',        // verb
  '動詞-自立',    // independent verb
  '動詞-非自立',  // auxiliary-like verb
  '動詞-接尾',    // verb suffix
]);

const ADJ_POS = new Set([
  '形容詞',      // adjective
  '形容詞-自立',  // independent adjective
]);

const NOUN_POS = new Set([
  '名詞',        // noun
  '名詞-一般',    // general noun
  '名詞-固有名詞', // proper noun
  '名詞-代名詞',  // pronoun
]);

const AUX_POS = new Set([
  '助動詞',      // auxiliary verb
  '助詞-接続助詞', // te-form connector
]);

interface AnalyzedToken {
  surface: string;
  basicForm: string;
  pos: string;
  isParticle: boolean;
  isVerb: boolean;
  isAdj: boolean;
  isNoun: boolean;
  isAux: boolean;
  reading?: string;
}

function analyzeTokens(tokens: KuromojiToken[]): AnalyzedToken[] {
  return tokens.map((t) => ({
    surface: t.surface_form,
    basicForm: t.basic_form,
    pos: t.pos,
    isParticle: PARTICLE_POS.has(t.pos) || PARTICLE_POS.has(`${t.pos}-${t.pos_detail_1}`),
    isVerb: VERB_POS.has(t.pos) || VERB_POS.has(`${t.pos}-${t.pos_detail_1}`),
    isAdj: ADJ_POS.has(t.pos),
    isNoun: NOUN_POS.has(t.pos),
    isAux: AUX_POS.has(t.pos),
    reading: t.reading || undefined,
  }));
}

function translateToken(token: AnalyzedToken, targetLang: 'ru' | 'en'): string {
  const entry = lookupJapaneseWord(token.basicForm);
  if (entry) {
    return targetLang === 'ru' ? entry.ru : entry.en;
  }

  if (token.isParticle) {
    return token.surface;
  }

  return `[${token.surface}]`;
}

function cleanParticles(tokens: AnalyzedToken[], translated: string[]): string[] {
  return tokens.map((t, i) => {
    if (t.isParticle) {
      const label = lookupJapaneseWord(t.surface);
      if (label) {
        if (t.surface === 'は' || t.surface === 'が') return '';
        if (t.surface === 'を') return '';
        if (t.surface === 'に') return '';
        if (t.surface === 'の') return '';
        if (t.surface === 'か') return '?';
        if (t.surface === 'よ') return '!';
      }
      return '';
    }
    return translated[i];
  });
}

function reconstructSVO(tokens: AnalyzedToken[], translated: string[]): string {
  if (tokens.length < 3) return translated.filter(s => s).join(' ');

  const verbIdx = tokens.findIndex((t) => t.isVerb && !t.isAux);
  if (verbIdx <= 0) return translated.filter(s => s).join(' ');

  const subjectPart = translated.slice(0, verbIdx).filter(s => s).join(' ');
  const verbPart = translated.slice(verbIdx).filter(s => s).join(' ');

  return `${subjectPart} ${verbPart}`.replace(/\s+/g, ' ').trim();
}

/**
 * Translates a single Japanese text fragment using offline tokenization,
 * our bundled dictionary, and basic SOV→SVO grammar reordering.
 *
 * @param text - Japanese source text.
 * @param targetLang - 'ru' or 'en'.
 * @returns Object with translated text and metadata.
 */
export async function translateOffline(
  text: string,
  targetLang: 'ru' | 'en',
): Promise<{ text: string; method: string }> {
  if (!text.trim()) return { text: '', method: 'offline-skip' };

  const tokenizer = await initTokenizer();
  const tokens = tokenizer.tokenize(text);
  const analyzed = analyzeTokens(tokens);

  const translated = analyzed.map((t) => translateToken(t, targetLang));
  const cleaned = cleanParticles(analyzed, translated);
  const reordered = reconstructSVO(analyzed, cleaned);

  return {
    text: reordered,
    method: tokens.length > 0 ? 'offline-kuromoji' : 'offline-char',
  };
}
