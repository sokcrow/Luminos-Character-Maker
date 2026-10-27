"""Measured browser benchmark. Never substitutes mock data for missing results."""
import csv
import json
import math
import os
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'artifacts/combat-nine')
raw = [json.loads(p.read_text()) for p in sorted(root.glob('*/raw.json'))]
clash = {'clashStart', 'clashContact', 'powerCoin', 'clashOutcome', 'clashDefeat', 'clashEnd'}
names = {'clashStart': 'Entrada al Clash', 'clashContact': 'Contacto', 'powerCoin': 'Coins de poder', 'clashOutcome': 'Resultado del Clash', 'clashDefeat': 'Derrota en Clash', 'clashEnd': 'Salida del Clash', 'hitCoin': 'Coins de impacto', 'hitMotion': 'Movimiento de impacto', 'hitsStart': 'Preparación de impactos', 'powerStart': 'Preparación de poder', 'powerEnd': 'Cierre de poder', 'hitStart': 'Preparación de Coin', 'wait': 'Pausas entre impactos', 'actionStart': 'Inicio de acción', 'actionApproach':'Acercamiento al objetivo'}


def percentile(values, p):
    if not values:
        return None
    values = sorted(values)
    point = (len(values)-1)*p
    low, high = math.floor(point), math.ceil(point)
    return values[low] + (values[high]-values[low])*(point-low)


def summary(values):
    return {'n': len(values), 'median': percentile(values, .5), 'p95': percentile(values, .95), 'max': max(values) if values else None}


samples, cases, signatures = [], [], defaultdict(list)
for result in raw:
    clients = result.get('clients', [])
    case = {key: result.get(key) for key in ['label', 'iteration', 'sha', 'complete', 'failure', 'wallMs']}
    case.update(players=len(clients)-1, expected=0, painted=0, omittedCommands=0, missingPaintSamples=0, duplicateCommands=0, unexpectedCommands=0, identityValid=True)
    if len(clients) != 9 or any('telemetry' not in client for client in clients):
        case['complete'] = False
        cases.append(case)
        continue
    dm = {row['sequence']: row for row in clients[0]['telemetry']['cues']}
    event_batch = {}
    for batch in (result.get('batches') or {}).values():
        for event in json.loads(batch['payload']).get('events', []):
            event_batch[event['sequence']] = batch['seq']
    fingerprint = {'seed': (result.get('authority') or {}).get('seed'), 'cues': [(r['cue'], r['owner'], r.get('opponent'), r.get('index'),r.get('result')) for r in sorted(dm.values(), key=lambda r: r['sequence']) if r['cue']!='actionApproach'], 'outcome': clients[0]['units']}
    signatures[result['label']].append(fingerprint)
    for player, client in enumerate(clients[1:], 1):
        received = {r['seq']: r['at'] for r in client['telemetry']['received']}
        counts=Counter(r['sequence'] for r in client['telemetry']['cues'])
        case['duplicateCommands']+=sum(n-1 for n in counts.values())
        case['unexpectedCommands']+=sum(n for seq,n in counts.items() if seq not in dm)
        if case['duplicateCommands'] or case['unexpectedCommands']:case['identityValid']=False
        rendered = {r['sequence']: r for r in client['telemetry']['cues']}
        case['expected'] += len(dm)
        for sequence, expected in dm.items():
            actual = rendered.get(sequence)
            if not actual or actual.get('paintAt') is None or expected.get('paintAt') is None:
                if not actual: case['omittedCommands'] += 1
                else: case['missingPaintSamples'] += 1
                continue
            if (actual['cue'], actual['owner'], actual.get('index'),actual.get('opponent'),actual.get('result')) != (expected['cue'], expected['owner'], expected.get('index'),expected.get('opponent'),expected.get('result')):
                case['identityValid'] = False
                continue
            case['painted'] += 1
            wire = received.get(event_batch.get(sequence))
            deadline = actual.get('playAt')
            samples.append({'label': result['label'], 'iteration': result['iteration'], 'player': player, 'sequence': sequence, 'cue': actual['cue'], 'clash': actual['cue'] in clash, 'lagMs': max(0, actual['paintAt']-expected['paintAt']), 'signedSkewMs': actual['paintAt']-expected['paintAt'], 'absoluteSkewMs':abs(actual['paintAt']-expected['paintAt']), 'paintMs': max(0, actual['paintAt']-actual['startAt']), 'queueLateMs': max(0, actual['startAt']-max(wire, deadline or wire)) if wire is not None else None, 'wireAfterDeadlineMs': max(0, wire-deadline) if wire is not None and deadline is not None else None})
    case['renderCoverageComplete'] = case['painted'] == case['expected']
    observed=[r for client in clients for r in client['telemetry']['cues'] if r['cue']=='clashStart']
    case['scene']={'clashSamples':len(observed),'unmeasured':sum('scene' not in r for r in observed),'cameraMissing':sum('scene' in r and r['scene'].get('camera')!='combat' for r in observed),'focusMismatch':sum('scene' in r and r['scene'].get('participants')!=sorted([r['owner'],r['opponent']]) for r in observed),'movementMissing':sum('scene' in r and not any(m['id'] in [r['owner'],r['opponent']] for m in r['scene'].get('movement',[])) for r in observed)}
    cases.append(case)

comparable = bool(signatures['before'] and signatures['after'] and all(s == signatures['before'][0] for s in signatures['before']+signatures['after']))
valid = comparable and len(cases) == 4 and all(c['complete'] and c['identityValid'] for c in cases)
metrics = {}
for label in ['before', 'after']:
    metrics[label] = {'clashSkewAbsMs':summary([r['absoluteSkewMs'] for r in samples if r['label']==label and r['clash']]),'clashLagMs': summary([r['lagMs'] for r in samples if r['label'] == label and r['clash']]), 'allLagMs': summary([r['lagMs'] for r in samples if r['label'] == label]), 'frameMs': summary([f['ms'] for result in raw if result['label'] == label for c in result.get('clients', [])[1:] if 'telemetry' in c for f in c['telemetry']['frames']]), 'longTaskMs':summary([t['duration'] for result in raw if result['label']==label for c in result.get('clients',[])[1:] if 'telemetry' in c for t in c['telemetry']['longTasks']]), 'byPlayer':{str(player):summary([r['lagMs'] for r in samples if r['label']==label and r['player']==player and r['clash']]) for player in range(1,9)}, 'byPhase': {cue: {field: summary([r[field] for r in samples if r['label'] == label and r['cue'] == cue and r[field] is not None]) for field in ['absoluteSkewMs','lagMs', 'queueLateMs', 'paintMs', 'wireAfterDeadlineMs']} for cue in sorted(set(r['cue'] for r in samples))}}
coverage={label:{key:sum(c.get(key,0) for c in cases if c['label']==label) for key in ['expected','painted','omittedCommands','missingPaintSamples','duplicateCommands','unexpectedCommands']} for label in ['before','after']}
accepted=valid and all(c['renderCoverageComplete'] and c.get('scene',{}).get('clashSamples',0)>0 and not any(c.get('scene',{}).get(key,1) for key in ['unmeasured','cameraMissing','focusMismatch','movementMissing']) for c in cases if c['label']=='after')
report = {'valid': valid, 'acceptedAfterWithVisualChecks':accepted,'coverage':coverage, 'sameWorkloadAndOutcome': comparable, 'cases': cases, 'metrics': metrics, 'definition': 'Desfase absoluto = magnitud de la diferencia del primer requestAnimationFrame tras iniciar la presentación respecto al mismo evento del DM. Incluye adelantos y retrasos; lagMs conserva solo retrasos y signedSkewMs su signo. Es una oportunidad de pintar, no una lectura de píxeles. El tiempo entre frames se mide aparte. Los percentiles usan muestras observadas; omisiones y muestras sin RAF se cuentan por separado, nunca como latencia cero. Cuatro rondas con ritmo normal, mismo escenario, semilla y viewports, orden ABBA, Auth/RTDB Emulator y una pareja de capturas en vivo por ronda. Nueve contextos comparten un runner CI: no son nueve dispositivos físicos ni una medición de Internet.'}
budget=float(os.environ['COMBAT_BENCH_CLASH_BUDGET_MS']) if os.environ.get('COMBAT_BENCH_CLASH_BUDGET_MS') else None
observed=metrics['after']['clashSkewAbsMs']['p95']
critical=clash|{'powerEnd','hitCoin','hitMotion','actionApproach'}
phase_budget={cue:metrics['after']['byPhase'].get(cue,{}).get('absoluteSkewMs',{}).get('p95') for cue in sorted(critical)}
report['performanceBudget']={'maxClashP95Ms':budget,'observedClashP95Ms':observed,'criticalPhaseP95Ms':phase_budget,'passed':(observed is not None and observed<budget and all(value is not None and value<budget for value in phase_budget.values())) if budget is not None else None}
report['profiles']={}
for label in ['before','after']:
    grouped={'dm':defaultdict(list),'players':defaultdict(list)}
    for result in raw:
        if result['label']!=label:continue
        for index,client in enumerate(result.get('clients',[])):
            role='dm' if index==0 else 'players'
            for mark in client.get('telemetry',{}).get('profile',[]):grouped[role][mark['name']].append(mark['ms'])
    report['profiles'][label]={role:{name:{'calls':len(values),'totalMs':sum(values),'durationMs':summary(values)} for name,values in by_name.items()} for role,by_name in grouped.items()}
report['gpu']={}
for label in ['before','after']:
    report['gpu'][label]={}
    for role in ['dm','players']:
        values=[client.get('telemetry',{}).get('gpu',{}) for case in raw if case['label']==label for index,client in enumerate(case.get('clients',[])) if (index==0)==(role=='dm')]
        frames=sum(g.get('frames',0) for g in values)
        drawing=sum(g.get('drawingFrames',0)+int(bool(g.get('lastFrameDraws',0))) for g in values)
        draws=sum(g.get('draws',0) for g in values)
        area=sum(g.get('pixelAreaSum',0) for g in values)
        report['gpu'][label][role]={'clientRounds':len(values),'frames':frames,'drawingFrames':drawing,'draws':draws,'drawsPerDrawingFrame':draws/drawing if drawing else None,'meanPixelsPerFrame':area/frames if frames else None,'maxPixels':max((g.get('maxPixelArea',0) for g in values),default=0)}
root.mkdir(parents=True, exist_ok=True)
(root/'summary.json').write_text(json.dumps(report, indent=2, ensure_ascii=False))
if samples:
    with (root/'latency-samples.csv').open('w', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=samples[0].keys());writer.writeheader();writer.writerows(samples)
if not all(metrics[label]['clashLagMs']['n'] for label in ['before', 'after']):
    (root/'RESULTADO.md').write_text('# Prueba incompleta\n\nNo hay datos válidos de Clashes en ambas versiones. No se generó una comparación inventada. Consultar summary.json y los raw.json.\n')
    print(json.dumps({'valid':False,'reason':'Missing real Clash samples on both versions','cases':cases},ensure_ascii=False))
    sys.exit(1)

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.ticker import MaxNLocator

plt.rcParams.update({'font.family':'DejaVu Sans','font.size':11,'axes.spines.top':False,'axes.spines.right':False,'axes.labelcolor':'#303742','text.color':'#18212e'})
colors = {'before':'#798493', 'after':'#167e89'}
fig, axes = plt.subplots(1, 2, figsize=(12, 5.5))
for axis, key, title in [(axes[0], 'clashSkewAbsMs', 'Desfase absoluto frente al DM en Clashes'), (axes[1], 'frameMs', 'Tiempo entre frames de los jugadores')]:
    keys=['median','p95','max'];x=range(3)
    for shift,label,title_label in [(-.19,'before','Antes'),(.19,'after','Ahora')]:
        values=[metrics[label][key][k] for k in keys]
        bars=axis.bar([i+shift for i in x],values,width=.36,color=colors[label],label=title_label)
        axis.bar_label(bars,labels=[f'{v:,.1f}' for v in values],padding=4,fontsize=9)
    axis.set_xticks(list(x),['Mediana','P95','Máximo']);axis.set_title(title,loc='left',fontsize=12);axis.set_ylabel('Milisegundos · menor es mejor');axis.grid(axis='y',alpha=.18);axis.set_axisbelow(True);axis.margins(y=.18)
if budget is not None:axes[0].axhline(budget,color='#a54836',linestyle='--',linewidth=1,label=f'Límite {budget:g} ms')
axes[0].legend(frameon=False)
fig.suptitle('Un DM y ocho jugadores · nueve navegadores',x=.06,ha='left',fontsize=17,fontweight='bold')
fig.text(.06,.025,('MEDICIÓN INCOMPLETA · ' if not valid else '')+'Battle Viewer completo · mismo ritmo, escenario y semilla · Auth/RTDB Emulator en un runner CI',fontsize=9,color='#566171')
fig.tight_layout(rect=(.03,.07,1,.9));fig.savefig(root/'antes-ahora.png',dpi=160);plt.close(fig)

cues=sorted(metrics['after']['byPhase'],key=lambda cue:metrics['after']['byPhase'][cue]['absoluteSkewMs']['p95'] or -1,reverse=True)
fig,(axis,parts)=plt.subplots(1,2,figsize=(16,max(6.5,len(cues)*.5)),sharey=True,gridspec_kw={'width_ratios':[1,1.2]})
for offset,label,title_label in [(-.18,'before','Antes'),(.18,'after','Ahora')]:
    values=[metrics[label]['byPhase'][cue]['absoluteSkewMs']['p95'] for cue in cues]
    present=[i for i,v in enumerate(values) if v is not None]
    bars=axis.barh([i+offset for i in present],[values[i] for i in present],height=.34,color=colors[label],label=title_label)
    axis.bar_label(bars,labels=[f'{values[i]:,.0f}' for i in present],padding=4,fontsize=8)
if budget is not None:axis.axvline(budget,color='#a54836',linestyle='--',linewidth=1,label=f'Límite {budget:g} ms')
axis.set_yticks(range(len(cues)),[names.get(c,c) for c in cues]);axis.invert_yaxis()
axis.set_xlabel('P95 del desfase absoluto frente al DM (ms)');axis.set_title('Desfase por fase',loc='left',fontsize=12,pad=12);axis.margins(x=.23);axis.legend(frameon=False,fontsize=9)
for offset,key,title_label,color in [(-.24,'wireAfterDeadlineMs','Recepción tras deadline','#b56544'),(0,'queueLateMs','Cola tardía','#5e6eab'),(.24,'paintMs','Inicio a RAF','#429378')]:
    values=[metrics['after']['byPhase'][cue][key]['p95'] for cue in cues]
    present=[i for i,v in enumerate(values) if v is not None]
    parts.barh([i+offset for i in present],[values[i] for i in present],height=.21,color=color,label=title_label)
parts.set_xlabel('P95 actual por componente (ms)');parts.set_title('Dónde se espera ahora',loc='left',fontsize=12,pad=12);parts.legend(frameon=False,fontsize=9,loc='lower right')
for a in [axis,parts]:a.grid(axis='x',alpha=.18);a.set_axisbelow(True)
fig.suptitle('Dónde se acumula más retraso',x=.02,ha='left',fontweight='bold',fontsize=17)
fig.text(.02,.025,('MEDICIÓN INCOMPLETA · ' if not valid else '')+'Ordenado por desfase P95 actual. Los P95 de componentes no se suman. Nueve sesiones comparten un runner CI.',fontsize=9,color='#566171')
fig.text(.02,.006,'Sin barra = sin muestra. El acercamiento antes ocurría solo en el DM y no tenía un evento de presentación medible.',fontsize=9,color='#566171')
fig.tight_layout(rect=(0,.07,1,.95));fig.savefig(root/'picos-por-fase.png',dpi=160);plt.close(fig)
before=metrics['before']['clashSkewAbsMs']['p95'];after=metrics['after']['clashSkewAbsMs']['p95']
lines=['# Nueve navegadores: antes y ahora','',f'Comparación válida y completa: {valid}. Escenario y resultados equivalentes: {comparable}.',f'P95 de desfase absoluto en Clashes: {before:.1f} ms antes; {after:.1f} ms ahora; diferencia {after-before:+.1f} ms.',f'Cobertura: {json.dumps(coverage,ensure_ascii=False)}. Aceptación actual con comprobaciones visuales: {accepted}.','',report['definition'],'','## Fases con más retraso actual','','| Fase | P95 visual | P95 cola tardía | P95 render→rAF | P95 recepción tras deadline |','| --- | ---: | ---: | ---: | ---: |']
for cue in cues:
    data=metrics['after']['byPhase'][cue]
    values=[data[k]['p95'] for k in ['absoluteSkewMs','queueLateMs','paintMs','wireAfterDeadlineMs']]
    lines.append('| '+names.get(cue,cue)+' | '+' | '.join('Sin dato' if v is None else f'{v:.1f} ms' for v in values)+' |')
lines+=['',f"Presupuesto de rendimiento: {json.dumps(report['performanceBudget'],ensure_ascii=False)}",'', 'Las duraciones de perfiles API son inclusivas y pueden anidarse: no se suman para atribuir CPU. Consultar summary.json para conteos y percentiles por DM/Players.']
(root/'RESULTADO.md').write_text('\n'.join(lines)+'\n')
print(json.dumps({'valid':valid,'sameWorkloadAndOutcome':comparable,'beforeAbsoluteClashP95':before,'afterAbsoluteClashP95':after,'performanceBudget':report['performanceBudget'],'cases':cases},ensure_ascii=False))
if not valid or not accepted or (budget is not None and not report['performanceBudget']['passed']): sys.exit(1)
