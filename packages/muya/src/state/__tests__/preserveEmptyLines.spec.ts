import { describe, expect, it } from 'vitest';
import { MarkdownToState } from '../markdownToState';
import ExportMarkdown from '../stateToMarkdown';

interface IStateLike {
    name: string;
    text?: string;
}

function toState(markdown: string, preserveEmptyLines: boolean): IStateLike[] {
    return new MarkdownToState({
        footnote: false,
        texMathDollars: false,
        texMathGfm: false,
        texMathSingleBackslash: false,
        texMathDoubleBackslash: false,
        trimUnnecessaryCodeBlockEmptyLines: false,
        frontMatter: false,
        preserveEmptyLines,
    }).generate(markdown) as unknown as IStateLike[];
}

function toMarkdown(states: IStateLike[]): string {
    return new ExportMarkdown({ listIndentation: 2 }).generate(states as never);
}

const names = (states: IStateLike[]) => states.map(s => `${s.name}:${JSON.stringify(s.text ?? '')}`);

describe('preserveEmptyLines off (spec-conformant default)', () => {
    it('drops every blank line between two paragraphs', () => {
        const states = toState('one\n\n\n\n\ntwo\n', false);
        expect(names(states)).toEqual(['paragraph:"one"', 'paragraph:"two"']);
    });
});

describe('preserveEmptyLines on', () => {
    it('keeps a plain paragraph break as two paragraphs and no empty line', () => {
        expect(names(toState('one\n\ntwo\n', true)))
            .toEqual(['paragraph:"one"', 'paragraph:"two"']);
    });

    it('restores one empty paragraph for one extra blank line', () => {
        expect(names(toState('one\n\n\ntwo\n', true)))
            .toEqual(['paragraph:"one"', 'paragraph:""', 'paragraph:"two"']);
    });

    it('restores three empty paragraphs for three extra blank lines', () => {
        expect(names(toState('one\n\n\n\n\ntwo\n', true)))
            .toEqual([
                'paragraph:"one"',
                'paragraph:""',
                'paragraph:""',
                'paragraph:""',
                'paragraph:"two"',
            ]);
    });

    it('round-trips: state -> markdown -> state is the identity', () => {
        for (const empties of [0, 1, 2, 3, 5, 10]) {
            const markdown = `one\n${'\n'.repeat(empties + 1)}two\n`;
            const states = toState(markdown, true);
            expect(states.length).toBe(empties + 2);
            expect(names(toState(toMarkdown(states), true))).toEqual(names(states));
        }
    });

    it('does not grow the file when it is saved twice', () => {
        const markdown = `one\n\n\n\n\ntwo\n`;
        const once = toMarkdown(toState(markdown, true));
        const twice = toMarkdown(toState(once, true));
        expect(twice).toBe(once);
        expect(names(toState(twice, true))).toEqual(names(toState(once, true)));
    });

    it('writes one blank line per empty paragraph, not two', () => {
        const once = toMarkdown(toState('one\n\n\n\n\ntwo\n', true));
        // three empty paragraphs -> four blank lines between the texts
        expect(once).toBe('one\n\n\n\n\ntwo\n');
    });

    it('counts blank lines the same way after a container', () => {
        // `- a` / `- b` are separated from "one" by three blank lines, so two
        // of them become empty paragraphs and one stays the separator.
        const states = toState('one\n\n\n\n- a\n- b\n', true);
        expect(states.map(s => s.name)).toEqual([
            'paragraph',
            'paragraph',
            'paragraph',
            'bullet-list',
        ]);
        expect(names(toState(toMarkdown(states), true))).toEqual(names(states));
    });

    it('keeps a soft line break inside a paragraph untouched', () => {
        expect(names(toState('soft one\nsoft two\n', true)))
            .toEqual(['paragraph:"soft one\\nsoft two"']);
    });
});
