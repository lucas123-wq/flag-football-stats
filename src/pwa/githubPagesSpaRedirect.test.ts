import { describe, expect, it } from 'vitest';
import {
  buildGithubPagesRedirectUrl,
  decodeGithubPagesRedirect,
  GITHUB_PAGES_PATH_SEGMENTS_TO_KEEP,
} from './githubPagesSpaRedirect';

describe('GITHUB_PAGES_PATH_SEGMENTS_TO_KEEP', () => {
  it('ist 1 (genau ein Pfadsegment "flag-football-stats" als App-Wurzel)', () => {
    expect(GITHUB_PAGES_PATH_SEGMENTS_TO_KEEP).toBe(1);
  });
});

describe('buildGithubPagesRedirectUrl', () => {
  it('kodiert einen einfachen Unterroute-Pfad in die 404.html-Umleitungs-URL', () => {
    const url = buildGithubPagesRedirectUrl({
      pathname: '/flag-football-stats/spiele/abc123',
      search: '',
      hash: '',
    });
    expect(url).toBe('/flag-football-stats/?/spiele/abc123');
  });

  it('kodiert den Query-String mit "~and~" statt "&", um ihn im Pfad-Teil zu transportieren', () => {
    const url = buildGithubPagesRedirectUrl({
      pathname: '/flag-football-stats/spiele',
      search: '?foo=bar&baz=qux',
      hash: '',
    });
    expect(url).toBe('/flag-football-stats/?/spiele&foo=bar~and~baz=qux');
  });

  it('erhält einen Hash-Fragment-Anteil', () => {
    const url = buildGithubPagesRedirectUrl({
      pathname: '/flag-football-stats/einstellungen',
      search: '',
      hash: '#abschnitt',
    });
    expect(url).toBe('/flag-football-stats/?/einstellungen#abschnitt');
  });

  it('kodiert die App-Wurzel selbst (kein Unterpfad) zu einem leeren kodierten Anteil', () => {
    const url = buildGithubPagesRedirectUrl({
      pathname: '/flag-football-stats/',
      search: '',
      hash: '',
    });
    expect(url).toBe('/flag-football-stats/?/');
  });
});

describe('decodeGithubPagesRedirect', () => {
  it('gibt null zurück, wenn kein Query-String vorhanden ist (normaler Aufruf)', () => {
    expect(
      decodeGithubPagesRedirect({ pathname: '/flag-football-stats/spiele', search: '', hash: '' }),
    ).toBeNull();
  });

  it('gibt null zurück, wenn ein Query-String vorhanden ist, der NICHT von der 404.html-Umleitung stammt', () => {
    expect(
      decodeGithubPagesRedirect({
        pathname: '/flag-football-stats/',
        search: '?foo=bar',
        hash: '',
      }),
    ).toBeNull();
  });

  it('stellt einen einfachen Unterroute-Pfad korrekt wieder her', () => {
    const restored = decodeGithubPagesRedirect({
      pathname: '/flag-football-stats/',
      search: '?/spiele/abc123',
      hash: '',
    });
    expect(restored).toBe('/flag-football-stats/spiele/abc123');
  });

  it('dekodiert "~and~" zurück zu "&" innerhalb eines wiederhergestellten Query-Strings', () => {
    const restored = decodeGithubPagesRedirect({
      pathname: '/flag-football-stats/',
      search: '?/spiele&foo=bar~and~baz=qux',
      hash: '',
    });
    expect(restored).toBe('/flag-football-stats/spiele?foo=bar&baz=qux');
  });

  it('erhält ein Hash-Fragment beim Wiederherstellen', () => {
    const restored = decodeGithubPagesRedirect({
      pathname: '/flag-football-stats/',
      search: '?/einstellungen',
      hash: '#abschnitt',
    });
    expect(restored).toBe('/flag-football-stats/einstellungen#abschnitt');
  });
});

describe('Round-Trip build -> decode', () => {
  it.each([
    '/flag-football-stats/spiele',
    '/flag-football-stats/spiele/neu',
    '/flag-football-stats/spiele/abc123',
    '/flag-football-stats/spieler',
    '/flag-football-stats/spieler/xyz789/bearbeiten',
    '/flag-football-stats/einstellungen',
  ])('stellt %s nach einer simulierten 404.html-Umleitung exakt wieder her', (path) => {
    const original = { pathname: path, search: '', hash: '' };
    const redirectedUrl = buildGithubPagesRedirectUrl(original);

    // Simuliert, wie der Browser die von 404.html per `location.replace(...)`
    // gesetzte URL als neue `window.location` sieht (Pfad + Query getrennt).
    const [redirectedPathname, redirectedSearch = ''] = redirectedUrl.split('?');
    const redirectedLocation = {
      pathname: redirectedPathname!,
      search: redirectedSearch ? `?${redirectedSearch}` : '',
      hash: '',
    };

    expect(decodeGithubPagesRedirect(redirectedLocation)).toBe(path);
  });

  it('stellt einen Pfad mit mehreren Query-Parametern und Hash exakt wieder her', () => {
    const original = {
      pathname: '/flag-football-stats/spiele/abc123',
      search: '?tab=statistiken&sort=asc',
      hash: '#oben',
    };
    const redirectedUrl = buildGithubPagesRedirectUrl(original);
    const [redirectedPathname, redirectedSearchAndHash = ''] = redirectedUrl.split('?');
    const [redirectedSearch, redirectedHash = ''] = redirectedSearchAndHash.split('#');
    const redirectedLocation = {
      pathname: redirectedPathname!,
      search: `?${redirectedSearch}`,
      hash: redirectedHash ? `#${redirectedHash}` : '',
    };

    const restored = decodeGithubPagesRedirect(redirectedLocation);
    expect(restored).toBe('/flag-football-stats/spiele/abc123?tab=statistiken&sort=asc#oben');
  });
});
