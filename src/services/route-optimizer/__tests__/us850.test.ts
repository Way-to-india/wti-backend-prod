/**
 * US-850 — THE NAMED PATH GETS THE SAME SEASON AND BODY TRUTH AS THE SHORTLIST.
 *
 * T12 asked for Amarnath in October and got a route to a shrine outside its yatra window,
 * because he NAMED it and the named path bypassed the proposal gates (his word is the
 * brief — exactly the class we may not gate away). The ruling: consult the facts for every
 * stop of every finished plan at the exit; a closure is a consent-style sentence + the
 * month question, an advisory is a note, and NOTHING is ever silently deleted.
 */
import { describe, it, expect } from 'bun:test';
import { seasonBodyExitCheck, type SeasonFact, type AccessFact } from '../proposalGates';

const AMARNATH_WINDOW: SeasonFact = {
  place: 'Amarnath', kind: 'yatra_window', months: [7, 8],
  note: 'The Amarnath yatra runs only in July and August; the cave shrine is unreachable outside it.',
};
const KEDAR_TREK: AccessFact = {
  place: 'Kedarnath', access: 'trek', magnitude: '16 km trek from Gaurikund',
  note: 'The last stretch has no road at all.',
};

describe('US-850 — season/body at the controller exit, for the traveller who NAMED his stop', () => {
  it('Amarnath in October is a CLOSURE: spoken, with the consent question — never deleted', () => {
    const w = seasonBodyExitCheck(['Srinagar', 'Amarnath'], 10, 'standard', [AMARNATH_WINDOW], []);
    const closure = w.find((x) => x.kind === 'closure');
    expect(closure).toBeTruthy();
    expect(closure!.place).toBe('Amarnath');
    expect(closure!.sentence).toContain('yatra window');
    expect(closure!.sentence).toContain('kept it in your plan');
    expect(String(closure!.ask)).toContain('flexible');
  });
  it('Amarnath in August passes in silence — a gate that talks when nothing is wrong is noise', () => {
    const w = seasonBodyExitCheck(['Amarnath'], 8, 'standard', [AMARNATH_WINDOW], []);
    expect(w.length).toBe(0);
  });
  it('no month given + a seasonal stop = ask for the month, do not guess one', () => {
    const w = seasonBodyExitCheck(['Amarnath'], null, 'standard', [AMARNATH_WINDOW], []);
    expect(w.length).toBe(1);
    expect(w[0].kind).toBe('advisory');
    expect(w[0].sentence).toContain('Tell us your month');
  });
  it('a trek shrine for a SENIOR party is a named advisory with the offer to re-plan', () => {
    const w = seasonBodyExitCheck(['Kedarnath'], 5, 'senior', [], [KEDAR_TREK]);
    expect(w.length).toBe(1);
    expect(w[0].sentence).toContain('16 km trek');
    expect(w[0].sentence).toContain('re-plan');
  });
  it('the same trek shrine for a standard party gates nothing', () => {
    const w = seasonBodyExitCheck(['Kedarnath'], 5, 'standard', [], [KEDAR_TREK]);
    expect(w.length).toBe(0);
  });
});
