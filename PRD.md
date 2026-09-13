# PRD – Regensburg Phoenix Flag Football Live Stats & Ticker

**Version:** 1.1  
**Status:** MVP  
**Plattform:** Installierbare Progressive Web App (PWA)  
**Betriebsmodell:** Local-First / Offline  
**Primäres Gerät:** Smartphone  
**Primärer Nutzer:** Elternteil oder Betreuer während eines Flag-Football-Spiels

---

# 1. Produktziel

Die Anwendung ist eine **installierbare, lokal arbeitende Progressive Web App (PWA)** zur Erfassung von Flag-Football-Spielereignissen und Spielerstatistiken.

Während eines Spiels kann ein nicht-regelkundiger Elternteil oder Betreuer schnell und einfach Ereignisse erfassen.

Die PWA:

1. erfasst die Events eines Spiels,
2. aktualisiert automatisch den Spielstand,
3. führt Spielerstatistiken für Regensburg Phoenix,
4. speichert die vollständige Event-Historie lokal,
5. generiert zu relevanten Events fertige WhatsApp-Nachrichten,
6. kopiert diese Nachrichten in die Zwischenablage,
7. ermöglicht dem Nutzer, die Nachricht manuell in WhatsApp-Gruppen einzufügen,
8. ermöglicht die nachträgliche Bearbeitung abgeschlossener Spiele.

Die Anwendung soll bewusst einfach bedienbar sein und während eines laufenden Spiels möglichst wenige Interaktionen benötigen.

---

# 2. Grundprinzipien

## 2.1 PWA

Die Anwendung wird als Progressive Web App umgesetzt.

Sie soll:

- auf modernen Smartphones funktionieren,
- auf iOS und Android nutzbar sein,
- zum Homescreen installiert werden können,
- ohne Browser-Adressleiste im installierten Modus laufen können, soweit die jeweilige Plattform dies unterstützt,
- offline funktionieren,
- lokale Daten dauerhaft speichern.

Es soll keine native iOS- oder Android-App für das MVP erforderlich sein.

---

# 3. Local-First / Offline

Die Anwendung benötigt für das eigentliche Spieltracking **keine Internetverbindung**.

Spieler, Spiele und Events werden lokal auf dem Gerät gespeichert.

Internet darf für folgende Dinge nicht erforderlich sein:

- App öffnen
- vorhandene Spiele ansehen
- Spieler ansehen
- neues Spiel erstellen
- Events erfassen
- Spielerstatistiken berechnen
- Score berechnen
- vergangene Spiele ansehen
- Spiele bearbeiten
- Nachrichten erzeugen

Wenn keine Internetverbindung besteht, muss das komplette Tracking weiterhin funktionieren.

---

# 4. Lokale Datenspeicherung

Die Anwendung soll eine geeignete browserbasierte lokale Datenbank verwenden.

Die konkrete Technologie darf von Claude Code gewählt werden.

Bevorzugt wird eine robuste Lösung auf Basis moderner Browser-Speichertechnologien wie IndexedDB bzw. einer geeigneten Abstraktion darüber.

Die Datenbank muss mindestens folgende Daten dauerhaft speichern:

- Spieler
- Spiele
- Events

Die Anwendung darf nicht davon ausgehen, dass React-/JavaScript-State allein zur dauerhaften Speicherung ausreicht.

Nach einem Neustart des Browsers bzw. der PWA müssen die gespeicherten Daten weiterhin vorhanden sein.

---

# 5. Backup und Wiederherstellung

Da die Daten ausschließlich lokal gespeichert werden, ist ein Backup-Mechanismus Bestandteil des MVP.

Die Einstellungen müssen enthalten:

**DATEN EXPORTIEREN**

und

**DATEN IMPORTIEREN**

Der Export soll alle für die Anwendung relevanten Daten enthalten:

- Spieler
- Spiele
- Events
- relevante Metadaten

Der Export wird als lokale Datei bereitgestellt, die der Nutzer selbst speichern kann.

Der Import ermöglicht die Wiederherstellung dieser Daten auf demselben oder einem anderen kompatiblen Gerät.

Das Datenformat soll versioniert werden, damit spätere App-Versionen alte Backups möglichst weiterhin importieren können.

---

# 6. Keine Benutzerkonten

Die Anwendung benötigt im MVP:

- keinen Login,
- keine Benutzerkonten,
- keine Passwörter,
- keine Cloud-Synchronisation,
- keinen eigenen Backend-Server.

Die Daten gehören zum lokalen Gerät bzw. zum lokalen Browser-Speicher.

---

# 7. WhatsApp

Es gibt **keine WhatsApp-API-Integration**.

Die Anwendung versendet keine WhatsApp-Nachrichten automatisch.

Stattdessen:

1. Event wird bestätigt.
2. Event wird lokal gespeichert.
3. Score und Statistiken werden aktualisiert.
4. Die entsprechende WhatsApp-Nachricht wird generiert.
5. Nachricht wird auf dem Bildschirm angezeigt.
6. Nutzer kann **KOPIEREN** auswählen.
7. Nachricht wird in die Zwischenablage kopiert.
8. Nutzer öffnet WhatsApp.
9. Nutzer fügt die Nachricht manuell in die entsprechende Gruppe ein.

Die App muss nicht wissen, ob die Nachricht tatsächlich verschickt wurde.

Es gibt zwei Zielgruppen:

- Eltern-Gruppe
- Spieler-Gruppe

Die Nachricht ist grundsätzlich identisch und kann für beide Gruppen manuell verwendet werden.

Die Datenspeicherung darf niemals davon abhängen, ob WhatsApp verfügbar ist.

---

# 8. Team

Das eigene Team ist fest:

**Regensburg Phoenix**

Der Gegner wird für jedes neue Spiel separat eingegeben.

Bei gegnerischen Events werden niemals gegnerische Spieler erfasst.

---

# 9. Spieler-Verwaltung

Es gibt einen zentralen Bereich **SPIELER**.

Jeder Spieler besitzt mindestens:

- interne ID
- Vorname
- Nachname
- Trikotnummer
- aktiv/inaktiv
- Erstellungsdatum
- Änderungsdatum

Beispiel:

```text
#7   Peter Beispiel
#12  Max Mustermann
#23  Max Muster
#44  Hans Beispiel
```

## 9.1 Aktive Spieler

Bei der Eventerfassung werden standardmäßig nur aktive Spieler zur Auswahl angezeigt.

## 9.2 Inaktive Spieler

Spieler können deaktiviert werden.

Ein Spieler, der bereits in einem Event verwendet wurde, darf nicht physisch gelöscht werden.

Er wird stattdessen deaktiviert, damit historische Events weiterhin auf ihn verweisen können.

---

# 10. Hauptnavigation

Die Anwendung besitzt drei Hauptbereiche:

```text
SPIELE
SPIELER
EINSTELLUNGEN
```

## Spiele

Startseite mit aktuellen und vergangenen Spielen.

## Spieler

Verwaltung des Regensburg-Phoenix-Kaders.

## Einstellungen

Unter anderem:

- Daten exportieren
- Daten importieren
- ggf. App-Informationen

---

# 11. Seite: Spiele

Die Startseite zeigt:

- laufende Spiele
- vergangene Spiele
- Button für neues Spiel

Beispiel:

```text
SPIELE

[ + NEUES SPIEL ]

LAUFEND

Regensburg Phoenix
vs. Munich Cowboys

12 : 6
LIVE


VERGANGENE SPIELE

Regensburg Phoenix
vs. Stuttgart Scorpions
20 : 14
12.09.2026
```

Ein laufendes Spiel wird prominent angezeigt.

Vergangene Spiele können geöffnet werden.

---

# 12. Seite: Neues Spiel

Der Nutzer gibt ein:

- Gegner
- Datum

Regensburg Phoenix ist automatisch das Heim-/eigene Team.

Beispiel:

```text
NEUES SPIEL

Gegner
[ Munich Cowboys ]

Datum
[ 12.09.2026 ]

[ SPIEL STARTEN ]
[ ABBRECHEN ]
```

Nach **SPIEL STARTEN** wird das Spiel lokal angelegt.

Startzustand:

```text
Score Phoenix: 0
Score Gegner: 0
Status: LIVE_FIRST_HALF
```

Danach wird direkt der Live-Screen angezeigt.

---

# 13. Spielstatus

Ein Spiel kann folgende Zustände besitzen:

```text
LIVE_FIRST_HALF
HALFTIME
LIVE_SECOND_HALF
FINAL
```

Der Status wird durch die entsprechenden Aktionen verändert.

---

# 14. Live-Screen

Der Live-Screen ist der zentrale Screen während eines Spiels.

Er zeigt:

- Regensburg Phoenix
- Gegner
- aktuellen Spielstand
- aktuelle Halbzeit
- Event-Buttons
- 2-Minuten-Warning
- Halbzeit oder Spielende
- letzte Events

Beispiel:

```text
REGNSBURG PHOENIX
        12
         :
         6
MUNICH COWBOYS

1. HALBZEIT

[ TOUCHDOWN ]     [ FIRST DOWN ]

[ 1 PT ]          [ 2 PT ]

[ INTERCEPTION ]  [ PICK 6 ]

[ PICK 2 ]        [ SACK ]

[ SAFETY ]        [ 1 PT SAFETY ]

[ 2 MIN WARNING ]

[ HALBZEIT ]
```

In der zweiten Halbzeit wird „2. HALBZEIT“ angezeigt und der Button **SPIELENDE** verwendet.

---

# 15. Bedienungsprinzip

Die UI muss für die Nutzung am Spielfeldrand optimiert sein.

Anforderungen:

- große Buttons
- klare Beschriftungen
- ausreichend Abstand zwischen Buttons
- schnelle Auswahl
- möglichst wenig Text während der Eventerfassung
- keine unnötigen Dialoge
- klare Bestätigungsseite vor Speicherung eines Events
- gute Bedienbarkeit auf Smartphone-Displays

Die Anwendung soll nicht voraussetzen, dass der Nutzer ein Flag-Football-Regelwerk kennt.

---

# 16. Allgemeiner Event-Ablauf

Normale Events folgen diesem Ablauf:

```text
Event auswählen
↓
Team auswählen
↓
falls erforderlich: Spieler auswählen
↓
Bestätigungsseite
↓
BESTÄTIGEN
↓
Event lokal speichern
↓
Score/Statistik aktualisieren
↓
WhatsApp-Nachricht generieren
↓
Nachricht anzeigen
↓
KOPIEREN
↓
zurück zum Live-Screen
```

**Wichtig:**

Vor der Bestätigung darf:

- kein Event dauerhaft gespeichert werden,
- kein Score verändert werden,
- keine Statistik verändert werden.

Bei **ABBRECHEN** wird der gesamte Vorgang verworfen.

---

# 17. Touchdown

## 17.1 Team auswählen

```text
Touchdown

[ REGNSBURG PHOENIX ]
[ GEGNER ]
```

## 17.2 Eigener Touchdown

Bei Regensburg Phoenix:

```text
[ RUSHING ]
[ PASSING ]
```

### Rushing TD

Ein aktiver Spieler wird ausgewählt.

Beispiel:

```text
#12 Max Mustermann
```

Der Spieler erhält:

`Rushing TD +1`

Der Score steigt um 6.

Nachricht:

```text
Touchdown Regensburg Phoenix #12 Max Mustermann
Neuer Spielstand: 6:0
```

### Passing TD

Zuerst wird der QB ausgewählt.

Danach der Receiver.

Beispiel:

```text
#7 Peter Beispiel
        ↓
#12 Max Mustermann
```

Statistiken:

QB:

`Passing TD +1`

Receiver:

`Receiving TD +1`

Score:

`+6`

Nachricht:

```text
Touchdown Regensburg Phoenix #7 Peter Beispiel -> #12 Max Mustermann
Neuer Spielstand: 6:0
```

## 17.3 Gegnerischer Touchdown

Keine Spielerauswahl.

Score des Gegners:

`+6`

Beispiel:

```text
Touchdown Munich Cowboys
Neuer Spielstand: 0:6
```

---

# 18. 1 Pt Conversion

Nach Auswahl des Teams:

```text
War die Conversion erfolgreich?

[ GUT ]
[ NICHT GUT ]
```

## Eigenes Team – erfolgreich

Spieler auswählen.

Score:

`+1`

Statistik:

`1 Pt Conversion +1`

Nachricht:

```text
1 Pt Conversion Regensburg Phoenix #12 Max Mustermann
Neuer Spielstand: 7:0
```

## Eigenes Team – nicht erfolgreich

Keine Spielerauswahl.

Score:

`+0`

Nachricht:

```text
1 Pt Conversion Regensburg Phoenix – nicht gut
```

## Gegner – erfolgreich

Keine Spielerauswahl.

Score:

`+1`

Nachricht:

```text
1 Pt Conversion Munich Cowboys
Neuer Spielstand: 6:7
```

## Gegner – nicht erfolgreich

Keine Spielerauswahl.

Nachricht:

```text
1 Pt Conversion Munich Cowboys – nicht gut
```

---

# 19. 2 Pt Conversion

Identisch zur 1-Punkt-Conversion.

Erfolgreich beim eigenen Team:

- Spieler auswählen
- Score +2
- `2 Pt Conversion +1`

Beispiel:

```text
2 Pt Conversion Regensburg Phoenix #12 Max Mustermann
Neuer Spielstand: 8:0
```

Nicht erfolgreich:

```text
2 Pt Conversion Regensburg Phoenix – nicht gut
```

Keine Spielerauswahl bei einer nicht erfolgreichen Conversion.

Gegnerische Conversion:

```text
2 Pt Conversion Munich Cowboys
Neuer Spielstand: 6:8
```

bzw.

```text
2 Pt Conversion Munich Cowboys – nicht gut
```

---

# 20. First Down

Team auswählen.

## Eigenes Team

Aktiven Spieler auswählen.

Es wird **nicht** zwischen Rushing und Passing unterschieden.

Statistik:

`First Down +1`

Score:

keine Änderung

Nachricht:

```text
First Down Regensburg Phoenix #12 Max Mustermann
```

## Gegner

Keine Spielerauswahl.

Nachricht:

```text
First Down Munich Cowboys
```

---

# 21. Interception

## Eigenes Team

Aktiven Spieler auswählen, der die Interception gefangen hat.

Statistik:

`Interception +1`

Score:

keine Änderung

Nachricht:

```text
Interception Regensburg Phoenix #23 Max Muster
```

## Gegner

Keine Spielerauswahl.

Nachricht:

```text
Interception Munich Cowboys
```

---

# 22. Pick 6

Pick 6 ist ein eigenes Event.

Es wird **nicht zusätzlich eine Interception gespeichert**.

## Eigenes Team

Spieler auswählen.

Statistik:

`Pick 6 +1`

Score:

`+6`

Nachricht:

```text
Pick 6 Regensburg Phoenix #23 Max Muster
Neuer Spielstand: 12:0
```

## Gegner

Keine Spielerauswahl.

Score:

`+6`

Nachricht:

```text
Pick 6 Munich Cowboys
Neuer Spielstand: 12:6
```

---

# 23. Pick 2

Pick 2 ist ein eigenes Event.

Es wird **nicht zusätzlich eine Interception gespeichert**.

## Eigenes Team

Spieler auswählen.

Statistik:

`Pick 2 +1`

Score:

`+2`

## Gegner

Keine Spielerauswahl.

Score:

`+2`

---

# 24. Sack

## Eigenes Team

Ein aktiver Spieler wird ausgewählt.

Statistik:

`Sack +1`

Score:

keine Änderung

Nachricht:

```text
Sack Regensburg Phoenix #44 Max Beispiel
```

## Gegner

Keine Spielerauswahl.

Nachricht:

```text
Sack Munich Cowboys
```

---

# 25. Safety

## Eigenes Team

Aktiven Spieler auswählen.

Statistik:

`Safety +1`

Score:

`+2`

Nachricht:

```text
Safety Regensburg Phoenix #44 Max Beispiel
Neuer Spielstand: 16:8
```

## Gegner

Keine Spielerauswahl.

Score:

`+2`

Nachricht:

```text
Safety Munich Cowboys
Neuer Spielstand: 16:10
```

---

# 26. 1 Pt Safety

## Eigenes Team

Aktiven Spieler auswählen.

Statistik:

`1 Pt Safety +1`

Score:

`+1`

Nachricht:

```text
1 Pt Safety Regensburg Phoenix #44 Max Beispiel
Neuer Spielstand: 17:10
```

## Gegner

Keine Spielerauswahl.

Score:

`+1`

Nachricht:

```text
1 Pt Safety Munich Cowboys
Neuer Spielstand: 17:11
```

---

# 27. 2-Minuten-Warning

Die 2-Minuten-Warning wird manuell über einen Button ausgelöst.

Es gibt keine Game Clock.

Nach Bestätigung:

- Event speichern
- kein Score-Change
- keine Spielerstatistik

Nachricht:

```text
2-Minuten-Warnung
Spielstand: 12:6
```

---

# 28. Halbzeit

Der Button **HALBZEIT** ist während der ersten Halbzeit verfügbar.

Nach Bestätigung:

- Event `HALFTIME` speichern
- Status → `HALFTIME`
- Eventerfassung pausieren
- Halbzeit-Screen anzeigen

Nachricht:

```text
Halbzeit
Regensburg Phoenix 12:6 Munich Cowboys
```

---

# 29. Halbzeit-Screen

```text
HALBZEIT

Regensburg Phoenix 12
Munich Cowboys 6

[ WEITER GEHT'S ]
```

---

# 30. Weiter geht's

Beim Klick auf **WEITER GEHT'S**:

- Status → `LIVE_SECOND_HALF`
- Event `SECOND_HALF_START` speichern
- Eventerfassung aktivieren
- keine weitere Bestätigung notwendig

Nachricht:

```text
Weiter geht's
Regensburg Phoenix 12:6 Munich Cowboys
```

Danach zurück zum Live-Screen.

---

# 31. Spielende

Der Button **SPIELENDE** ist während der zweiten Halbzeit verfügbar.

Nach Bestätigung:

- Event `GAME_END` speichern
- Status → `FINAL`
- Live-Eventbuttons deaktivieren
- Spiel abschließen

Nachricht:

```text
Spielende
Regensburg Phoenix 20:14 Munich Cowboys
```

Das Spiel kann anschließend weiterhin geöffnet und bearbeitet werden.

---

# 32. Event-Datenmodell

Ein Event soll mindestens folgende Informationen speichern:

```text
id
gameId
type
team
playerId
qbId
receiverId
successful
points
half
createdAt
updatedAt
```

Nicht benötigte Felder bleiben leer/null.

Beispiel Passing TD:

```text
type = TOUCHDOWN_PASSING
team = PHOENIX
qbId = player_7
receiverId = player_12
points = 6
half = 1
```

Beispiel gegnerischer Touchdown:

```text
type = TOUCHDOWN_RUSHING / TOUCHDOWN
team = OPPONENT
points = 6
half = 1
```

Da kein gegnerischer Spieler erfasst wird, existiert keine gegnerische Spieler-ID.

Die konkrete technische Modellierung darf Claude Code optimieren, solange die Produktlogik erhalten bleibt.

---

# 33. Punkte-Matrix

```text
Touchdown Rushing       +6
Touchdown Passing       +6

1 Pt Conversion gut     +1
1 Pt Conversion nicht   +0

2 Pt Conversion gut     +2
2 Pt Conversion nicht   +0

First Down               0
Interception             0

Pick 6                  +6
Pick 2                  +2

Sack                     0

Safety                  +2
1 Pt Safety             +1

2 Min Warning            0
Halbzeit                 0
Weiter geht's            0
Spielende                0
```

---

# 34. Statistiken

Spielerstatistiken werden aus den Events berechnet.

Mögliche Statistiken:

- Rushing TD
- Passing TD
- Receiving TD
- 1 Pt Conversion
- 2 Pt Conversion
- First Down
- Interception
- Pick 6
- Pick 2
- Sack
- Safety
- 1 Pt Safety

Es werden ausschließlich Spieler von Regensburg Phoenix statistisch erfasst.

Gegnerische Spieler existieren im Datenmodell nicht.

---

# 35. Single Source of Truth

Die gespeicherten Events sind die zentrale Quelle für:

- Score
- Spielerstatistiken
- Liveticker
- Spielhistorie

Score und Statistiken sollen nicht unabhängig von der Event-Historie dauerhaft gepflegt werden, sofern dies technisch vermeidbar ist.

Wenn ein Event geändert oder gelöscht wird, müssen Score und Statistiken entsprechend neu berechnet werden.

---

# 36. Letzte Events

Der Live-Screen zeigt die zuletzt erfassten Events.

Beispiel:

```text
LETZTE EVENTS

Touchdown
Regensburg Phoenix #12 Max Mustermann

1 Pt Conversion
Regensburg Phoenix #7 Peter Beispiel

Sack
Regensburg Phoenix #44 Hans Beispiel
```

---

# 37. Abgeschlossenes Spiel

Ein abgeschlossenes Spiel kann geöffnet werden.

Die Spielansicht bietet:

```text
ÜBERSICHT
LIVETICKER
STATISTIKEN
BEARBEITEN
```

---

# 38. Spielübersicht

Beispiel:

```text
Regensburg Phoenix
20 : 14
Munich Cowboys

12.09.2026

Spiel beendet
```

---

# 39. Liveticker

Alle Events werden chronologisch angezeigt.

Beispiel:

```text
Touchdown Regensburg Phoenix
#12 Max Mustermann

1 Pt Conversion Regensburg Phoenix
#7 Peter Beispiel

First Down Regensburg Phoenix
#12 Max Mustermann

Sack Regensburg Phoenix
#44 Hans Beispiel

Touchdown Munich Cowboys

Halbzeit
Regensburg Phoenix 12:6 Munich Cowboys

Weiter geht's
Regensburg Phoenix 12:6 Munich Cowboys

Spielende
Regensburg Phoenix 20:14 Munich Cowboys
```

---

# 40. Statistiken eines Spiels

Beispiel:

```text
#12 Max Mustermann

Rushing TD           1
Receiving TD         2
First Downs          3
1 Pt Conversions     1
2 Pt Conversions     0
Interceptions        0
Pick 6               0
Pick 2               0
Sacks                0
Safeties             0
1 Pt Safeties        0
```

Nullwerte dürfen zur besseren Übersicht ausgeblendet werden.

---

# 41. Spiele bearbeiten

Abgeschlossene Spiele können nachträglich bearbeitet werden.

Mögliche Aktionen:

- Event öffnen
- Spieler ändern
- QB ändern
- Receiver ändern
- Conversion-Erfolg ändern
- Event löschen
- Eventdaten ändern, soweit fachlich sinnvoll

Nach einer Änderung:

1. Event-Daten werden aktualisiert.
2. Score wird neu berechnet.
3. Spielerstatistiken werden neu berechnet.
4. Liveticker wird aktualisiert.

---

# 42. WhatsApp bei Korrekturen

Eine nachträgliche Änderung eines Events erzeugt **keine neue WhatsApp-Nachricht**.

Grund:

Die ursprüngliche Nachricht wurde möglicherweise bereits manuell in WhatsApp gepostet und kann von der App nicht zurückgenommen werden.

Die Korrektur betrifft nur die lokalen Daten der Anwendung.

---

# 43. Spieler-Seite

Die Spieler-Seite zeigt:

```text
SPIELER

[ + SPIELER HINZUFÜGEN ]

AKTIVE SPIELER

#7   Peter Beispiel
#12  Max Mustermann
#23  Max Muster
#44  Hans Beispiel

INAKTIVE SPIELER

#15  Alter Spieler
```

---

# 44. Spieler hinzufügen/bearbeiten

Felder:

```text
Vorname
Nachname
Trikotnummer
Aktiv
```

Beispiel:

```text
SPIELER BEARBEITEN

Vorname
[ Max ]

Nachname
[ Mustermann ]

Nummer
[ 12 ]

Aktiv
[ ✓ ]

[ SPEICHERN ]
```

---

# 45. Einstellungen

MVP:

```text
EINSTELLUNGEN

Daten

[ DATEN EXPORTIEREN ]
[ DATEN IMPORTIEREN ]

App-Version
```

Eine Funktion **ALLE DATEN LÖSCHEN** darf vorhanden sein, muss aber eine deutliche Sicherheitsabfrage besitzen.

Beispiel:

```text
ALLE DATEN LÖSCHEN?

Dabei werden alle Spieler,
Spiele und Events dauerhaft
vom Gerät gelöscht.

[ ALLE DATEN LÖSCHEN ]
[ ABBRECHEN ]
```

---

# 46. PWA-Anforderungen

Die Anwendung soll als PWA installierbar sein.

Mindestens:

- Web App Manifest
- geeignete App-Icons
- Service Worker
- Offline-Caching der Anwendung
- lokaler Datenspeicher
- installierbarer Standalone-Modus, soweit vom Browser unterstützt

Die App-Shell muss nach erfolgter Installation auch ohne Internetverbindung geladen werden können.

Die konkrete PWA-Technologie darf Claude Code auswählen.

---

# 47. Offline-Verhalten

Die Anwendung muss klar zwischen:

**App-Funktionalität**

und

**Internetabhängigkeit**

trennen.

Offline funktionieren müssen:

- Navigation
- Datenbank
- Spieler
- Spiele
- Eventerfassung
- Score
- Statistiken
- Liveticker
- Bearbeitung
- Nachrichtengenerierung
- Kopieren in die Zwischenablage, soweit die Browserplattform dies erlaubt

Wenn eine Browserfunktion technisch nur mit Einschränkungen offline funktioniert, soll die Anwendung einen sinnvollen Fallback anbieten.

---

# 48. Fehlerbehandlung

Die Anwendung darf bei einem einzelnen fehlgeschlagenen Vorgang keine bereits gespeicherten Events verlieren.

Insbesondere:

Wenn nach der Event-Bestätigung die Zwischenablage oder eine andere Browserfunktion nicht verfügbar ist, muss das Event trotzdem gespeichert bleiben.

Die App soll dem Nutzer dann beispielsweise anzeigen:

```text
Event gespeichert.

Die Nachricht konnte nicht automatisch
in die Zwischenablage kopiert werden.

[ TEXT ANZEIGEN ]
```

Der Nutzer kann den Text anschließend manuell kopieren.

---

# 49. Performance

Während eines Spiels soll die Eventerfassung ohne merkliche Verzögerung funktionieren.

Ein Event soll nach Bestätigung unmittelbar:

- gespeichert,
- im Score berücksichtigt,
- in den Statistiken berücksichtigt,
- im Liveticker angezeigt

werden.

Die Anwendung soll auch nach vielen gespeicherten Spielen weiterhin schnell reagieren.

---

# 50. Sicherheit und Datenschutz

Die Anwendung soll nach dem Prinzip der Datensparsamkeit arbeiten.

Es werden keine unnötigen personenbezogenen Daten erhoben.

Keine Daten werden standardmäßig an einen Server übertragen.

Keine Analytics oder Tracking-Dienste sind Bestandteil des MVP, sofern sie nicht ausdrücklich später beschlossen werden.

Es gibt:

- keinen Login
- kein Benutzerprofil
- keine Cloud-Datenbank
- keine automatische Datenübertragung

---

# 51. Technische Entscheidungsfreiheit

Claude Code soll die konkrete technische Architektur selbst bestimmen.

Dazu gehören insbesondere:

- Framework
- Sprache
- Komponentenstruktur
- lokale Datenbank
- State Management
- Routing
- PWA-Implementierung
- Service Worker
- Testframework
- Build-System

Die technische Lösung muss die Anforderungen dieser PRD erfüllen.

Wenn eine technische Entscheidung nicht spezifiziert ist, soll Claude Code eine sinnvolle Lösung wählen und diese kurz dokumentieren.

**Technische Entscheidungen dürfen die definierte Produktlogik nicht verändern.**

---

# 52. MVP-Abgrenzung

Nicht Bestandteil des MVP:

- automatische WhatsApp-Nachrichten
- WhatsApp-API
- Benutzerkonten
- Cloud-Synchronisierung
- Mehrbenutzerbetrieb
- Echtzeit-Synchronisierung zwischen mehreren Geräten
- automatische Game Clock
- automatische Regelerkennung
- gegnerische Spielerstatistiken
- Push Notifications
- öffentliche Webansicht eines Spiels

Diese Funktionen können später betrachtet werden.

---

# 53. Akzeptanzkriterien

Die MVP-Version gilt funktional als erfolgreich, wenn folgende Abläufe funktionieren:

### Neues Spiel

- [ ] Neues Spiel kann erstellt werden.
- [ ] Gegner kann eingegeben werden.
- [ ] Spiel startet mit 0:0.
- [ ] Spiel startet in der ersten Halbzeit.

### Touchdown

- [ ] Rushing TD kann erfasst werden.
- [ ] Passing TD fragt zuerst QB und anschließend Receiver ab.
- [ ] Passing TD gibt dem QB Passing TD +1.
- [ ] Passing TD gibt dem Receiver Receiving TD +1.
- [ ] Gegnerischer TD fragt keinen Spieler ab.
- [ ] TD erhöht den Score korrekt um 6.
- [ ] passende WhatsApp-Nachricht wird generiert.

### Conversions

- [ ] 1 Pt Conversion kann erfolgreich/nicht erfolgreich erfasst werden.
- [ ] 2 Pt Conversion kann erfolgreich/nicht erfolgreich erfasst werden.
- [ ] Bei nicht erfolgreicher Conversion wird kein Spieler ausgewählt.
- [ ] Erfolgreiche eigene Conversion kann einem Spieler zugeordnet werden.
- [ ] Score wird korrekt aktualisiert.
- [ ] passende Nachricht wird generiert.

### Weitere Events

- [ ] First Down funktioniert.
- [ ] Interception funktioniert.
- [ ] Pick 6 funktioniert.
- [ ] Pick 6 erzeugt keine zusätzliche Interception-Statistik.
- [ ] Pick 2 funktioniert.
- [ ] Pick 2 erzeugt keine zusätzliche Interception-Statistik.
- [ ] Sack funktioniert.
- [ ] Safety funktioniert.
- [ ] 1 Pt Safety funktioniert.
- [ ] Gegnerische Events fragen niemals einen gegnerischen Spieler ab.

### Spielsteuerung

- [ ] 2-Minuten-Warning funktioniert.
- [ ] Halbzeit kann gestartet werden.
- [ ] Nach Halbzeit sind Live-Events pausiert.
- [ ] „Weiter geht's“ startet die zweite Halbzeit.
- [ ] „Weiter geht's“ erzeugt eine Nachricht.
- [ ] Spielende kann ausgelöst werden.
- [ ] Spielende erzeugt eine Nachricht.
- [ ] Nach Spielende sind keine normalen Live-Events mehr möglich.

### Speicherung

- [ ] Events werden lokal gespeichert.
- [ ] Daten bleiben nach Neustart der PWA erhalten.
- [ ] Spiele bleiben nach Neustart erhalten.
- [ ] Spieler bleiben nach Neustart erhalten.
- [ ] App funktioniert beim Tracking offline.

### Bearbeitung

- [ ] Abgeschlossene Spiele können geöffnet werden.
- [ ] Events können bearbeitet werden.
- [ ] Events können gelöscht werden.
- [ ] Score wird nach Änderungen korrekt neu berechnet.
- [ ] Statistiken werden nach Änderungen korrekt neu berechnet.
- [ ] Liveticker wird nach Änderungen aktualisiert.
- [ ] Korrekturen erzeugen keine neue WhatsApp-Nachricht.

### Backup

- [ ] Daten können exportiert werden.
- [ ] Export enthält Spieler, Spiele und Events.
- [ ] Export kann wieder importiert werden.
- [ ] Import stellt die Daten korrekt wieder her.

### WhatsApp

- [ ] Nachricht wird nach bestätigtem Event generiert.
- [ ] Nachricht kann angezeigt werden.
- [ ] Nachricht kann kopiert werden.
- [ ] Event bleibt gespeichert, auch wenn Kopieren nicht funktioniert.
- [ ] Es gibt keine automatische WhatsApp-Übertragung.

---

# 54. Entwicklungsprinzip

Die Anwendung soll zunächst als funktionierender MVP umgesetzt werden.

Priorität:

1. Datenintegrität
2. korrekte Eventlogik
3. korrekter Score
4. korrekte Statistiken
5. Offline-Funktionalität
6. einfache Bedienung während des Spiels
7. WhatsApp-Nachrichtengenerierung
8. Bearbeitung vergangener Spiele
9. Backup/Restore
10. visuelle Verfeinerung

Die Anwendung soll lieber funktional einfach und zuverlässig sein als unnötig komplex.

---

# 55. Auftrag an Claude Code

Implementiere auf Basis dieser PRD eine installierbare Offline-PWA für Regensburg Phoenix.

Bevor du mit umfangreicher Implementierung beginnst:

1. analysiere die Anforderungen,
2. schlage einen geeigneten Tech-Stack vor,
3. definiere die technische Architektur,
4. definiere das lokale Datenmodell,
5. identifiziere mögliche technische Risiken der PWA-/Offline-Anforderungen,
6. dokumentiere deine Entscheidungen,
7. implementiere anschließend den MVP.

Wenn Anforderungen technisch nicht eindeutig sind, triff eine sinnvolle Entscheidung und dokumentiere sie.

**Die in dieser PRD definierte Produktlogik darf dabei nicht eigenständig verändert werden.**

Nach der Implementierung sollen automatisierte Tests für die kritische Event-, Score- und Statistiklogik vorhanden sein.

Insbesondere müssen die Punkteberechnung, Eventzuordnung und Statistikberechnung zuverlässig testbar sein.