import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { createPlayer, getPlayer, listActivePlayers, listPlayers, updatePlayer } from './players';

beforeEach(async () => {
  await db.players.clear();
});

describe('players repository', () => {
  it('erstellt einen Spieler und liest ihn wieder', async () => {
    const created = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });

    expect(created.id).toBeTruthy();
    expect(created.active).toBe(true);
    expect(created.createdAt).toBe(created.updatedAt);

    const loaded = await getPlayer(created.id);
    expect(loaded).toEqual(created);
  });

  it('listet alle Spieler', async () => {
    await createPlayer({ firstName: 'Peter', lastName: 'Beispiel', jerseyNumber: 7 });
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });

    const all = await listPlayers();
    expect(all).toHaveLength(2);
  });

  it('listet nur aktive Spieler standardmäßig (PRD §9.1)', async () => {
    const active = await createPlayer({ firstName: 'Max', lastName: 'Muster', jerseyNumber: 23 });
    const inactive = await createPlayer({
      firstName: 'Alter',
      lastName: 'Spieler',
      jerseyNumber: 15,
      active: false,
    });

    const activePlayers = await listActivePlayers();
    expect(activePlayers.map((p) => p.id)).toEqual([active.id]);
    expect(activePlayers.map((p) => p.id)).not.toContain(inactive.id);
  });

  it('deaktiviert einen Spieler statt ihn zu löschen (PRD §9.2)', async () => {
    const player = await createPlayer({
      firstName: 'Hans',
      lastName: 'Beispiel',
      jerseyNumber: 44,
    });

    const updated = await updatePlayer(player.id, { active: false });
    expect(updated.active).toBe(false);

    // weiterhin über getPlayer auffindbar – kein physisches Löschen
    const stillThere = await getPlayer(player.id);
    expect(stillThere?.active).toBe(false);
  });

  it('reaktiviert einen zuvor deaktivierten Spieler', async () => {
    const player = await createPlayer({
      firstName: 'Alter',
      lastName: 'Spieler',
      jerseyNumber: 15,
      active: false,
    });

    const updated = await updatePlayer(player.id, { active: true });
    expect(updated.active).toBe(true);
  });

  it('lehnt eine ungültige Trikotnummer beim Anlegen ab', async () => {
    await expect(
      createPlayer({ firstName: 'Peter', lastName: 'Beispiel', jerseyNumber: 150 }),
    ).rejects.toThrow(/Trikotnummer/);
    expect(await listPlayers()).toHaveLength(0);
  });

  it('lehnt fehlende Pflichtfelder beim Anlegen ab', async () => {
    await expect(
      createPlayer({ firstName: '', lastName: 'Beispiel', jerseyNumber: 7 }),
    ).rejects.toThrow(/Vorname/);
  });

  it('lehnt eine unter aktiven Spielern doppelte Trikotnummer beim Anlegen ab', async () => {
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });

    await expect(
      createPlayer({ firstName: 'Anderer', lastName: 'Spieler', jerseyNumber: 12 }),
    ).rejects.toThrow(/bereits von einem aktiven Spieler/);
    expect(await listPlayers()).toHaveLength(1);
  });

  it('erlaubt eine doppelte Trikotnummer, wenn der bestehende Spieler inaktiv ist', async () => {
    await createPlayer({
      firstName: 'Alter',
      lastName: 'Spieler',
      jerseyNumber: 12,
      active: false,
    });

    const newPlayer = await createPlayer({
      firstName: 'Neuer',
      lastName: 'Spieler',
      jerseyNumber: 12,
    });
    expect(newPlayer.jerseyNumber).toBe(12);
  });

  it('lehnt eine doppelte Trikotnummer beim Bearbeiten ab', async () => {
    await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });
    const second = await createPlayer({
      firstName: 'Peter',
      lastName: 'Beispiel',
      jerseyNumber: 7,
    });

    await expect(updatePlayer(second.id, { jerseyNumber: 12 })).rejects.toThrow(
      /bereits von einem aktiven Spieler/,
    );
  });

  it('erlaubt das Speichern eines Spielers mit unveränderter eigener Trikotnummer', async () => {
    const player = await createPlayer({
      firstName: 'Max',
      lastName: 'Mustermann',
      jerseyNumber: 12,
    });

    const updated = await updatePlayer(player.id, { firstName: 'Maximilian' });
    expect(updated.firstName).toBe('Maximilian');
    expect(updated.jerseyNumber).toBe(12);
  });
});
