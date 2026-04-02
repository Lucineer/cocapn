/**
 * Theme engine — loads presets, parses theme.css, generates CSS variables.
 * Zero dependencies.
 */
export interface Theme {
    accent: string;
    accent2: string;
    mode: 'dark' | 'light';
    font: 'monospace' | 'sans-serif' | 'serif';
    customCSS?: string;
}
export declare function loadTheme(dir: string, preset?: string): Theme;
export declare function themeToCSS(t: Theme): string;
//# sourceMappingURL=theme.d.ts.map