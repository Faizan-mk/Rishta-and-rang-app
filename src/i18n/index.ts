import en from './en.json';
import ur from './ur.json';
import roman from './roman.json';
import type { AppLanguage } from '../types/user';

const dictionaries = { en, ur, roman } as const;

type Dictionary = typeof en;
export type TranslateParams = Record<string, string | number>;

/** The `t` every screen gets from `useLanguage` — shared so helpers can take it. */
export type Translate = (path: string, params?: TranslateParams) => string;

function getByPath(dict: Dictionary, path: string): string {
  const value = path.split('.').reduce<unknown>((node, key) => {
    if (node && typeof node === 'object' && key in node) {
      return (node as Record<string, unknown>)[key];
    }
    return undefined;
  }, dict);
  return typeof value === 'string' ? value : path;
}

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in params ? String(params[key]) : match));
}

export function translate(language: AppLanguage, path: string, params?: TranslateParams): string {
  return interpolate(getByPath(dictionaries[language], path), params);
}

export function isRTL(language: AppLanguage): boolean {
  return language === 'ur';
}
