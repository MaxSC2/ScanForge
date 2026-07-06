import type { ProjectTargetLanguage } from '../types';
import { useGlossaryStore } from '../stores/useGlossaryStore';

const EN_TO_RU: Record<string, string> = {
  hello: 'привет',
  hi: 'привет',
  yes: 'да',
  no: 'нет',
  thanks: 'спасибо',
  thank: 'спасибо',
  sorry: 'прости',
  please: 'пожалуйста',
  wait: 'подожди',
  stop: 'стой',
  run: 'беги',
  go: 'иди',
  what: 'что',
  where: 'где',
  who: 'кто',
  why: 'почему',
  mission: 'миссия',
  danger: 'опасность',
  enemy: 'враг',
  friend: 'друг',
  captain: 'капитан',
  system: 'система',
  power: 'сила',
  test: 'тест',
  attack: 'атака',
  region: 'регион',
  page: 'страница',
  translation: 'перевод',
  start: 'старт',
  finish: 'финиш',
  open: 'открыть',
  close: 'закрыть',
  save: 'сохранить',
};

const RU_TO_EN: Record<string, string> = {
  привет: 'hello',
  да: 'yes',
  нет: 'no',
  спасибо: 'thanks',
  прости: 'sorry',
  пожалуйста: 'please',
  подожди: 'wait',
  стой: 'stop',
  беги: 'run',
  иди: 'go',
  что: 'what',
  где: 'where',
  кто: 'who',
  почему: 'why',
  миссия: 'mission',
  опасность: 'danger',
  враг: 'enemy',
  друг: 'friend',
  капитан: 'captain',
  система: 'system',
  сила: 'power',
  тест: 'test',
  атака: 'attack',
  регион: 'region',
  страница: 'page',
  перевод: 'translation',
  старт: 'start',
  финиш: 'finish',
  открыть: 'open',
  закрыть: 'close',
  сохранить: 'save',
};

function isWordToken(value: string) {
  return /^[\p{L}\p{N}']+$/u.test(value);
}

function preserveCase(source: string, translated: string) {
  if (!source) return translated;
  if (source === source.toUpperCase()) {
    return translated.toUpperCase();
  }
  if (source[0] && source[0] === source[0].toUpperCase()) {
    return translated[0]?.toUpperCase() + translated.slice(1);
  }
  return translated;
}

function translateKnownWord(token: string, targetLanguage: ProjectTargetLanguage) {
  const normalized = token.toLowerCase();
  const languagePair = targetLanguage === 'ru' ? 'en→ru' : 'ru→en';
  const glossaryMatch = useGlossaryStore.getState().lookup(normalized, languagePair);
  if (glossaryMatch) {
    return preserveCase(token, glossaryMatch);
  }
  const dictionary = targetLanguage === 'ru' ? EN_TO_RU : RU_TO_EN;
  const translated = dictionary[normalized];
  return translated ? preserveCase(token, translated) : null;
}

function tokenizeText(text: string) {
  return text.match(/[\p{L}\p{N}']+|[^\p{L}\p{N}']+/gu) ?? [text];
}

export function buildLocalDraftTranslation(
  text: string,
  targetLanguage: ProjectTargetLanguage,
) {
  const trimmed = text.trim();
  if (!trimmed) {
    return trimmed;
  }

  let translatedWords = 0;
  const output = tokenizeText(trimmed)
    .map((token) => {
      if (!isWordToken(token)) {
        return token;
      }

      const translated = translateKnownWord(token, targetLanguage);
      if (translated) {
        translatedWords += 1;
        return translated;
      }
      return token;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

  if (!output || translatedWords === 0 || output === trimmed) {
    return `${targetLanguage === 'ru' ? '[ru draft]' : '[en draft]'} ${trimmed}`;
  }

  return output;
}

export function buildPreviewTranslation(
  text: string,
  targetLanguage: ProjectTargetLanguage,
) {
  return `${targetLanguage === 'ru' ? '[preview ru]' : '[preview en]'} ${text.trim()}`;
}
