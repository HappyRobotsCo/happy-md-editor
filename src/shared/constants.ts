export const APP_NAME = 'Happy MD Editor';
export const SUPPORTED_EXTENSIONS = ['.md', '.markdown'];
export const AUTOSAVE_DEBOUNCE_MS = 2000;
export const PREVIEW_DEBOUNCE_MS = 150;
export const SCROLL_SYNC_DEBOUNCE_MS = 50;

export type EditorMode = 'wysiwyg' | 'split' | 'source';
export const EDITOR_MODES: EditorMode[] = ['wysiwyg', 'split', 'source'];
export const MODE_STORAGE_KEY = 'editorMode';

export type Theme = 'light' | 'dark';
export const THEMES: Theme[] = ['light', 'dark'];
export const THEME_STORAGE_KEY = 'themePreference';
export const ONBOARDING_STORAGE_KEY = 'onboardingComplete';
