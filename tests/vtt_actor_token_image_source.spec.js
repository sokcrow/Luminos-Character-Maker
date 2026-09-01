import { test, expect } from '@playwright/test';
import '../js/vtt/actor-library.js';
import '../js/vtt/token-appearance.js';

const ActorLibrary = globalThis.LuminousVttActorLibrary;
const TokenAppearance = globalThis.LuminousVttTokenAppearance;

test('player token image comes from assigned Actor icono, not player image aliases or Theatre sprites', () => {
    const players = {
        player1: {
            id: 'player1',
            uid: 'uid-1',
            actorId: 'agatha',
            icono: 'player-wrong.png',
            icono_jugador: 'legacy-player-wrong.png',
            iconUrl: 'generic-player-wrong.png',
            sprites: { base: 'theatre-wrong.png', happy: 'theatre-happy-wrong.png' },
        },
    };
    const actors = {
        agatha: {
            id: 'agatha',
            nombre: 'Agatha',
            icono: 'actor-agatha-correct.png',
            sprites: { base: 'actor-theatre-wrong.png' },
        },
    };

    const list = ActorLibrary.mergeCollections({ players, actors });
    const playerActor = list.find((entry) => entry.category === 'player');

    expect(playerActor).toBeTruthy();
    expect(playerActor.actorId).toBe('agatha');
    expect(playerActor.icono).toBe('actor-agatha-correct.png');
    expect(playerActor.tokenImage).toBe('actor-agatha-correct.png');
    expect(list.filter((entry) => entry.actorId === 'agatha')).toHaveLength(1);

    const token = ActorLibrary.tokenFromActor(playerActor, { x: 35, y: 35 }, { grid: { size: 70, cols: 4, rows: 4 } }, 0);
    expect(token.icono).toBe('actor-agatha-correct.png');
    expect(TokenAppearance.imageSource(token)).toBe('actor-agatha-correct.png');
});

test('player without a resolved Actor does not promote player-level images into tactical token image', () => {
    const list = ActorLibrary.mergeCollections({
        players: {
            player1: {
                id: 'player1',
                actorId: 'missing-actor',
                icono: 'player-wrong.png',
                icono_jugador: 'legacy-wrong.png',
                iconUrl: 'generic-wrong.png',
                sprites: { base: 'theatre-wrong.png' },
            },
        },
        actors: {},
    });

    const playerActor = list[0];
    expect(playerActor.icono).toBe('');
    expect(TokenAppearance.imageSource({
        icono_jugador: 'legacy-wrong.png',
        iconUrl: 'generic-wrong.png',
        sprites: { base: 'theatre-wrong.png' },
    })).toBe('');
});

test('actor image resolver accepts only Actor icono', () => {
    expect(ActorLibrary.imageFor({ icono: 'actor.png' })).toBe('actor.png');
    expect(ActorLibrary.imageFor({ icono_jugador: 'player.png' })).toBe('');
    expect(ActorLibrary.imageFor({ iconUrl: 'generic.png' })).toBe('');
    expect(ActorLibrary.imageFor({ sprites: { base: 'theatre.png' }, portrait: 'portrait.png' })).toBe('');
});
