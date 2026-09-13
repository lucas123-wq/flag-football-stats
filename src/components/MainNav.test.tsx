import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MainNav } from './MainNav';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<MainNav />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MainNav (PRD §10)', () => {
  it('zeigt die drei Hauptbereiche in der vorgegebenen Reihenfolge', () => {
    renderAt('/spiele');
    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Spiele', 'Spieler', 'Einstellungen']);
  });

  it.each([
    ['/spiele', 'Spiele'],
    ['/spiele/neu', 'Spiele'],
    ['/spiele/abc-123', 'Spiele'],
    ['/spieler', 'Spieler'],
    ['/spieler/neu', 'Spieler'],
    ['/einstellungen', 'Einstellungen'],
  ])('markiert bei Pfad %s den Bereich "%s" eindeutig als aktiv', (path, expectedActive) => {
    renderAt(path);
    const links = screen.getAllByRole('link');
    // `NavLink` setzt `aria-current="page"` nur beim aktiven Link, bei
    // inaktiven Links fehlt das Attribut ganz (kein "false"-Wert).
    const activeLinks = links.filter((link) => link.getAttribute('aria-current') === 'page');
    expect(activeLinks).toHaveLength(1);
    expect(activeLinks[0]?.textContent).toBe(expectedActive);
  });

  it('verlinkt auf die bestehenden Routen', () => {
    renderAt('/spiele');
    expect(screen.getByRole('link', { name: 'Spiele' })).toHaveAttribute('href', '/spiele');
    expect(screen.getByRole('link', { name: 'Spieler' })).toHaveAttribute('href', '/spieler');
    expect(screen.getByRole('link', { name: 'Einstellungen' })).toHaveAttribute(
      'href',
      '/einstellungen',
    );
  });
});
