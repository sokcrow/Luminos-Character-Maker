const { test, expect } = require('@playwright/test');
const Travel = require('../js/regional-travel-core.js');
const Scheduler = require('../js/world-time-scheduler-core.js');
const Streaming = require('../js/vtt/world-streaming-core.js');

const hex = (q, r = 0, district = 'K') => ({ district, q, r });
const roadSegment = (terrain = 'plains') => ({ surface: 'road', terrain });
const basic = (transportId = 'walking', extra = {}) => Travel.createTravelPlan({
  groupId: extra.groupId || 'party', memberIds: extra.memberIds || ['p1'], worldId: 'luminous',
  route: extra.route || [hex(0), hex(1)], segments: extra.segments || [roadSegment()], transportId,
  waitSeconds: extra.waitSeconds || 0, stopSeconds: extra.stopSeconds || 0,
});
const calendar = () => ({ timestamp: '2026-08-30T12:00:00.000Z', año: 2026, mes: 8, dia: 30, hora: 12, minuto: 0, segundo: 0 });

test.describe('Regional Travel Engine', () => {
  test('one 20 km road hex is 4h10 walking and 20m by private bus', () => {
    expect(basic('walking').plan.durationSeconds).toBe(15000);
    expect(basic('private_bus').plan.durationSeconds).toBe(1200);
  });

  test('axial hex distance and adjacency are deterministic', () => {
    expect(Travel.axialDistance(hex(0, 0), hex(3, -2))).toBe(3);
    expect(Travel.areAdjacent(hex(0, 0), hex(1, 0))).toBe(true);
    expect(Travel.areAdjacent(hex(0, 0), hex(2, 0))).toBe(false);
    expect(Travel.axialDistance(hex(0, 0, 'K'), hex(0, 0, 'W'))).toBe(Infinity);
  });

  test('v1 rejects skipped regional hexes so clients cannot forge short network edges', () => {
    const result = basic('walking', { route: [hex(0), hex(5)], segments: [{ surface: 'road', terrain: 'plains', distanceKm: 0.01, networkEdge: true }] });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('invalid_route_hop');
  });

  test('adjacent segment distance is authoritative and ignores client distance injection', () => {
    const result = basic('walking', { segments: [{ surface: 'road', terrain: 'plains', distanceKm: 0.001 }] });
    expect(result.valid).toBe(true);
    expect(result.plan.distanceKm).toBe(20);
    expect(result.plan.durationSeconds).toBe(15000);
  });

  test('client modifiers can slow travel but cannot claim faster-than-baseline weather or route quality', () => {
    const result = basic('private_bus', { segments: [{ surface: 'road', terrain: 'plains', routeQualityMultiplier: 0.01, weatherMultiplier: 0.01 }] });
    expect(result.plan.durationSeconds).toBe(1200);
  });

  test('transport capability contract blocks bus offroad and train off rail', () => {
    expect(basic('public_bus', { segments: [{ surface: 'offroad', terrain: 'plains' }] }).reason).toBe('surface_not_supported');
    expect(basic('train', { segments: [{ surface: 'road', terrain: 'plains' }] }).reason).toBe('surface_not_supported');
    expect(basic('train', { segments: [{ surface: 'rail', terrain: 'mountain' }] }).valid).toBe(true);
  });

  test('rail infrastructure shields train speed from terrain penalties', () => {
    const rail = basic('train', { segments: [{ surface: 'rail', terrain: 'mountain' }] });
    expect(rail.plan.durationSeconds).toBe(900);
  });

  test('terrain meaningfully slows walking outside good infrastructure', () => {
    const plains = basic('walking', { segments: [{ surface: 'offroad', terrain: 'plains' }] });
    const swamp = basic('walking', { segments: [{ surface: 'offroad', terrain: 'swamp' }] });
    expect(swamp.plan.durationSeconds).toBeGreaterThan(plains.plan.durationSeconds);
  });

  test('travel becomes exactly one scheduler activity and one completion event', () => {
    const result = basic('private_bus');
    const command = Travel.toSchedulerCommand(result.plan, 'travel_once');
    const applied = Scheduler.applyCommandToCalendar(calendar(), command);
    const state = Scheduler.schedulerStateFrom(applied.calendar);
    expect(state.groups.party.activity.type).toBe('regional_travel');
    expect(Object.keys(state.events)).toHaveLength(1);
    expect(state.groups.party.durationSeconds).toBe(1200);
  });

  test('eight split players create eight travel events, never per-second events', () => {
    let state = calendar();
    for (let i = 0; i < 8; i += 1) {
      const plan = basic('private_bus', { groupId: `g${i}`, memberIds: [`p${i}`], route: [hex(i * 3), hex(i * 3 + 1)] }).plan;
      state = Scheduler.applyCommandToCalendar(state, Travel.toSchedulerCommand(plan, `travel_${i}`)).calendar;
    }
    const scheduler = Scheduler.schedulerStateFrom(state);
    expect(Object.keys(scheduler.events)).toHaveLength(8);
    expect(Object.keys(scheduler.groups)).toHaveLength(8);
  });

  test('long route duration still produces one event and bounded payload', () => {
    const route = Array.from({ length: 128 }, (_, i) => hex(i));
    const segments = Array.from({ length: 127 }, () => roadSegment());
    const result = basic('private_bus', { route, segments });
    expect(result.valid).toBe(true);
    const command = Travel.toSchedulerCommand(result.plan, 'long_trip');
    let state = Scheduler.applyCommandToCalendar(calendar(), command).calendar;
    const scheduler = Scheduler.schedulerStateFrom(state);
    expect(Object.keys(scheduler.events)).toHaveLength(1);
    expect(JSON.stringify(scheduler).length).toBeLessThan(100000);
  });

  test('route length is bounded before it can bloat Realtime', () => {
    const route = Array.from({ length: Travel.CONFIG.maxRouteHexes + 1 }, (_, i) => hex(i));
    const result = basic('private_bus', { route, segments: route.slice(1).map(() => roadSegment()) });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('invalid_route');
  });

  test('DM-side validation rejects a forged duration', () => {
    const command = Travel.toSchedulerCommand(basic('private_bus').plan, 'forged');
    command.durationSeconds = 1;
    const checked = Travel.validateScheduledCommand(command);
    expect(checked.valid).toBe(false);
    expect(checked.reason).toBe('duration_mismatch');
    expect(checked.expectedDurationSeconds).toBe(1200);
  });

  test('scheduled command round-trips through authoritative validation', () => {
    const command = Travel.toSchedulerCommand(basic('walking').plan, 'valid');
    const checked = Travel.validateScheduledCommand(command);
    expect(checked.valid).toBe(true);
    expect(checked.plan.durationSeconds).toBe(15000);
  });

  test('regional travel does not stream every crossed local chunk', () => {
    const manager = Streaming.createLifecycleManager({ warmTtlMs: 0, maxWarmChunks: 0, maxActiveChunks: 8 });
    const actors = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, position: { worldId: 'luminous', regionId: 'K', zoneId: `origin${i}`, chunkCol: 0, chunkRow: 0, x: 1, y: 1 } }));
    manager.reconcile(actors, 0);
    let state = calendar();
    for (let i = 0; i < 8; i += 1) {
      const route = Array.from({ length: 64 }, (_, q) => hex(q, i));
      const segments = Array.from({ length: 63 }, () => roadSegment());
      const plan = basic('private_bus', { groupId: `g${i}`, memberIds: [`p${i}`], route, segments }).plan;
      state = Scheduler.applyCommandToCalendar(state, Travel.toSchedulerCommand(plan, `r${i}`)).calendar;
    }
    expect(Scheduler.schedulerStateFrom(state).events && Object.keys(Scheduler.schedulerStateFrom(state).events)).toHaveLength(8);
    expect(manager.snapshot().activeChunks).toBe(8);
    expect(manager.snapshot().residentChunks).toBe(8);
  });

  test('arrival world position is deterministic and carries idempotency marker', () => {
    const plan = basic('walking', { route: [hex(0), hex(1, -1)], segments: [roadSegment()] }).plan;
    const position = Travel.destinationWorldPosition(plan, 'arrival_1', 1234);
    expect(position.regionId).toBe('K');
    expect(position.regionalHex).toEqual({ district: 'K', q: 1, r: -1 });
    expect(position.travelArrivalId).toBe('arrival_1');
    expect(position.arrivedAtWorldTs).toBe(1234);
  });
});
