(function (global) {
  "use strict";

  if (global.LuminousRegionalWorldGraph) return;
  const Graph = global.LuminousRegionalWorldGraphCore;
  const Travel = global.LuminousRegionalTravelCore;
  const Scheduler = global.LuminousWorldTimeScheduler;
  if (!Graph || !Travel || !Scheduler) return;

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const makeId = (prefix = "graph_travel") => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

  function registerGraph(definition) {
    return Graph.registerGraph(definition);
  }

  function registerBootstrapGraphs() {
    const definitions = Array.isArray(global.LUMINOUS_REGIONAL_WORLD_GRAPHS)
      ? global.LUMINOUS_REGIONAL_WORLD_GRAPHS
      : [];
    const registered = [];
    for (const definition of definitions) {
      try { registered.push(Graph.registerGraph(definition)); }
      catch (error) { console.error("[Luminous] Regional world graph registration failed:", error); }
    }
    return registered;
  }

  function planTravelTo(input = {}) {
    return Graph.createTravelPlan(input);
  }

  function commandFromPlan(result, commandId) {
    if (!result?.valid || !result.plan || !result.routing) throw new Error("VALID_GRAPH_TRAVEL_PLAN_REQUIRED");
    const command = Travel.toSchedulerCommand(result.plan, commandId || makeId());
    command.payload.routing = clone(result.routing);
    return command;
  }

  function startTravelTo(input = {}) {
    const result = Graph.createTravelPlan(input);
    if (!result.valid) {
      return Promise.reject(Object.assign(new Error(result.reason || "INVALID_GRAPH_TRAVEL"), { graphTravelValidation: result }));
    }
    const command = commandFromPlan(result, input.commandId);
    return Scheduler.startActivity(command).then((resolvedCommandId) => ({
      commandId: resolvedCommandId,
      plan: result.plan,
      routeResult: result.routeResult,
      routing: result.routing,
    }));
  }

  const bootstrapGraphs = registerBootstrapGraphs();
  const api = Object.freeze({
    core: Graph,
    registerGraph,
    unregisterGraph: Graph.unregisterGraph,
    getGraph: Graph.getGraph,
    listGraphs: Graph.listGraphs,
    planTravelTo,
    commandFromPlan,
    startTravelTo,
    bootstrapGraphs: Object.freeze(bootstrapGraphs),
  });

  global.LuminousRegionalWorldGraph = api;
})(window);
