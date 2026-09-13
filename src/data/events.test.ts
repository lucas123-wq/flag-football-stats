import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { createGame } from './games';
import { createPlayer } from './players';
import {
  createEvent,
  deleteEvent,
  deleteEventsByGame,
  getEvent,
  listEventsByGame,
  updateEvent,
} from './events';
import { EVENT_TYPE, HALF, TEAM } from '../domain/types';
import type { Game, Player } from '../domain/types';

let game: Game;
let qb: Player;
let receiver: Player;

beforeEach(async () => {
  await db.events.clear();
  await db.games.clear();
  await db.players.clear();

  game = await createGame({ opponent: 'Munich Cowboys', date: '2026-09-12' });
  qb = await createPlayer({ firstName: 'Peter', lastName: 'Beispiel', jerseyNumber: 7 });
  receiver = await createPlayer({ firstName: 'Max', lastName: 'Mustermann', jerseyNumber: 12 });
});

describe('events repository', () => {
  it('erstellt ein Event und liest es wieder', async () => {
    const event = await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.FIRST_DOWN,
      team: TEAM.PHOENIX,
      playerId: receiver.id,
      points: 0,
      half: HALF.FIRST,
    });

    expect(event.id).toBeTruthy();
    expect(event.sequence).toBe(1);

    const loaded = await getEvent(event.id);
    expect(loaded).toEqual(event);
  });

  it('verknüpft das Event eindeutig mit seinem Spiel', async () => {
    const otherGame = await createGame({ opponent: 'Stuttgart Scorpions', date: '2026-09-20' });

    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.FIRST_DOWN,
      team: TEAM.PHOENIX,
      playerId: receiver.id,
      points: 0,
      half: HALF.FIRST,
    });
    await createEvent({
      gameId: otherGame.id,
      type: EVENT_TYPE.SACK,
      team: TEAM.PHOENIX,
      playerId: receiver.id,
      points: 0,
      half: HALF.FIRST,
    });

    const gameEvents = await listEventsByGame(game.id);
    const otherGameEvents = await listEventsByGame(otherGame.id);

    expect(gameEvents).toHaveLength(1);
    expect(gameEvents[0]?.gameId).toBe(game.id);
    expect(otherGameEvents).toHaveLength(1);
    expect(otherGameEvents[0]?.gameId).toBe(otherGame.id);
  });

  it('vergibt fortlaufende sequence-Nummern je Spiel in Erstellreihenfolge', async () => {
    const first = await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.FIRST_DOWN,
      team: TEAM.PHOENIX,
      playerId: receiver.id,
      points: 0,
      half: HALF.FIRST,
    });
    const second = await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.SACK,
      team: TEAM.PHOENIX,
      playerId: qb.id,
      points: 0,
      half: HALF.FIRST,
    });

    expect(first.sequence).toBe(1);
    expect(second.sequence).toBe(2);

    const events = await listEventsByGame(game.id);
    expect(events.map((e) => e.id)).toEqual([first.id, second.id]);
  });

  it('verknüpft ein Event mit dem beteiligten eigenen Spieler', async () => {
    const event = await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: receiver.id,
      points: 6,
      half: HALF.FIRST,
    });

    expect(event.playerId).toBe(receiver.id);
  });

  it('speichert Passing-TD-Events mit getrenntem QB und Receiver', async () => {
    const event = await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_PASSING,
      team: TEAM.PHOENIX,
      qbId: qb.id,
      receiverId: receiver.id,
      points: 6,
      half: HALF.FIRST,
    });

    expect(event.qbId).toBe(qb.id);
    expect(event.receiverId).toBe(receiver.id);
    expect(event.playerId).toBeNull();
  });

  it('lehnt Passing TD ohne Receiver ab (Datenintegrität vor dem Speichern)', async () => {
    await expect(
      createEvent({
        gameId: game.id,
        type: EVENT_TYPE.TOUCHDOWN_PASSING,
        team: TEAM.PHOENIX,
        qbId: qb.id,
        points: 6,
        half: HALF.FIRST,
      }),
    ).rejects.toThrow(/qbId und receiverId/);

    // Bei Ablehnung darf kein Event gespeichert worden sein.
    expect(await listEventsByGame(game.id)).toHaveLength(0);
  });

  it('speichert gegnerische Events ohne jede Spieler-ID', async () => {
    const event = await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_OPPONENT,
      team: TEAM.OPPONENT,
      points: 6,
      half: HALF.FIRST,
    });

    expect(event.playerId).toBeNull();
    expect(event.qbId).toBeNull();
    expect(event.receiverId).toBeNull();
  });

  it('speichert eine nicht erfolgreiche Conversion ohne Spieler', async () => {
    const event = await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.CONVERSION_1PT,
      team: TEAM.PHOENIX,
      successful: false,
      points: 0,
      half: HALF.FIRST,
    });

    expect(event.successful).toBe(false);
    expect(event.playerId).toBeNull();
  });

  it('unterscheidet PICK_6, PICK_2 und INTERCEPTION eindeutig voneinander', async () => {
    const interception = await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.INTERCEPTION,
      team: TEAM.PHOENIX,
      playerId: receiver.id,
      points: 0,
      half: HALF.FIRST,
    });
    const pick6 = await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.PICK_6,
      team: TEAM.PHOENIX,
      playerId: receiver.id,
      points: 6,
      half: HALF.FIRST,
    });
    const pick2 = await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.PICK_2,
      team: TEAM.PHOENIX,
      playerId: receiver.id,
      points: 2,
      half: HALF.FIRST,
    });

    const events = await listEventsByGame(game.id);
    expect(events).toHaveLength(3);

    // Jedes Event bleibt sein eigener, unabhängiger Datensatz mit eigenem Typ –
    // ein Pick 6/Pick 2 erzeugt insbesondere kein zusätzliches INTERCEPTION-Event.
    const types = events.map((e) => e.type).sort();
    expect(types).toEqual([EVENT_TYPE.INTERCEPTION, EVENT_TYPE.PICK_6, EVENT_TYPE.PICK_2].sort());
    expect(interception.type).toBe(EVENT_TYPE.INTERCEPTION);
    expect(pick6.type).toBe(EVENT_TYPE.PICK_6);
    expect(pick2.type).toBe(EVENT_TYPE.PICK_2);
  });

  it('aktualisiert ein Event und validiert das Ergebnis erneut', async () => {
    const event = await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.TOUCHDOWN_RUSHING,
      team: TEAM.PHOENIX,
      playerId: receiver.id,
      points: 6,
      half: HALF.FIRST,
    });

    const updated = await updateEvent(event.id, { playerId: qb.id });
    expect(updated.playerId).toBe(qb.id);

    await expect(updateEvent(event.id, { playerId: null })).rejects.toThrow(/playerId/);
  });

  it('löscht ein Event', async () => {
    const event = await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.SACK,
      team: TEAM.PHOENIX,
      playerId: qb.id,
      points: 0,
      half: HALF.FIRST,
    });

    await deleteEvent(event.id);

    expect(await getEvent(event.id)).toBeUndefined();
    expect(await listEventsByGame(game.id)).toHaveLength(0);
  });

  it('löscht alle Events eines Spiels über deleteEventsByGame, andere Spiele bleiben unberührt', async () => {
    const otherGame = await createGame({ opponent: 'Stuttgart Scorpions', date: '2026-09-20' });

    await createEvent({
      gameId: game.id,
      type: EVENT_TYPE.SACK,
      team: TEAM.PHOENIX,
      playerId: qb.id,
      points: 0,
      half: HALF.FIRST,
    });
    await createEvent({
      gameId: otherGame.id,
      type: EVENT_TYPE.SACK,
      team: TEAM.PHOENIX,
      playerId: qb.id,
      points: 0,
      half: HALF.FIRST,
    });

    await deleteEventsByGame(game.id);

    expect(await listEventsByGame(game.id)).toHaveLength(0);
    expect(await listEventsByGame(otherGame.id)).toHaveLength(1);
  });
});
