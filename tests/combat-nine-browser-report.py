"""Measured browser benchmark. Never substitutes mock data for missing results."""
import csv
import json
import math
import statistics
import sys
from collections import defaultdict
from pathlib import Path

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'artifacts/combat-nine')
raw = [json.loads(p.read_text()) for p in sorted(root.glob('*/raw.json'))]
clash = {'clashStart', 'clashContact', 'powerCoin', 'clashOutcome', 'clashDefeat', 'clashEnd'}
names = {'clashStart': 'Entrada al Clash', 'clashContact': 'Contacto', 'powerCoin': 'Coins de poder', 'clashOutcome': 'Resultado del Clash', 'clashDefeat': 'Derrota en Clash', 'clashEnd': 'Salida del Clash', 'hitCoin': 'Coins de impacto', 'hitMotion': 'Movimiento de impacto', 'hitsStart': 'Preparación de impactos', 'powerStart': 'Preparación de poder', 'powerEnd': 'Cierre de poder', 'hitStart': 'Preparación de Coin', 'wait': 'Pausas entre impactos', 'actionStart': 'Inicio de acción'}


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
    case.update(players=len(clients)-1, expected=0, painted=0, omittedCommands=0, missingPaintSamples=0, identityValid=True)
    if len(clients) != 9 or any('telemetry' not in client for client in clients):
        case['complete'] = False
        cases.append(case)
        continue
    dm = {row['sequence']: row for row in clients[0]['telemetry']['cues']}
    event_batch = {}
    for batch in (result.get('batches') or {}).values():
        for event in json.loads(batch['payload']).get('events', []):
            event_batch[event['sequence']] = batch['seq']
    fingerprint = {'seed': (result.get('authority') or {}).get('seed'), 'cues': [(r['cue'], r['owner'], r.get('opponent'), r.get('index'),r.get('result')) for r in sorted(dm.values(), key=lambda r: r['sequence'])], 'outcome': clients[0]['units']}
    signatures[result['label']].append(fingerprint)
    for player, client in enumerate(clients[1:], 1):
        received = {r['seq']: r['at'] for r in client['telemetry']['received']}
        rendered = {r['sequence']: r for r in client['telemetry']['cues']}
        case['expected'] += len(dm)
        for sequence, expected in dm.items():
            actual = rendered.get(sequence)
            if not actual or actual.get('paintAt') is None or expected.get('paintAt') is None:
                if not actual: case['omittedCommands'] += 1
                else: case['missingPaintSamples'] += 1
                continue
            if (actual['cue'], actual['owner'], actual.get('index'),actual.get('result')) != (expected['cue'], expected['owner'], expected.get('index'),expected.get('result')):
                case['identityValid'] = False
                continue
            case['painted'] += 1
            wire = received.get(event_batch.get(sequence))
            deadline = actual.get('playAt')
            samples.append({'label': result['label'], 'iteration': result['iteration'], 'player': player, 'sequence': sequence, 'cue': actual['cue'], 'clash': actual['cue'] in clash, 'lagMs': max(0, actual['paintAt']-expected['paintAt']), 'signedSkewMs': actual['paintAt']-expected['paintAt'], 'paintMs': max(0, actual['paintAt']-actual['startAt']), 'queueLateMs': max(0, actual['startAt']-max(wire, deadline or wire)) if wire is not None else None, 'wireAfterDeadlineMs': max(0, wire-deadline) if wire is not None and deadline is not None else None})
    case['renderCoverageComplete'] = case['painted'] == case['expected']
    cases.append(case)

comparable = bool(signatures['before'] and signatures['after'] and all(s == signatures['before'][0] for s in signatures['before']+signatures['after']))
valid = comparable and len(cases) == 4 and all(c['complete'] and c['identityValid'] for c in cases)
metrics = {}
for label in ['before', 'after']:
    metrics[label] = {'clashLagMs': summary([r['lagMs'] for r in samples if r['label'] == label and r['clash']]), 'allLagMs': summary([r['lagMs'] for r in samples if r['label'] == label]), 'frameMs': summary([f['ms'] for result in raw if result['label'] == label for c in result.get('clients', [])[1:] if 'telemetry' in c for f in c['telemetry']['frames']]), 'longTaskMs':summary([t['duration'] for result in raw if result['label']==label for c in result.get('clients',[])[1:] if 'telemetry' in c for t in c['telemetry']['longTasks']]), 'byPlayer':{str(player):summary([r['lagMs'] for r in samples if r['label']==label and r['player']==player and r['clash']]) for player in range(1,9)}, 'byPhase': {cue: {field: summary([r[field] for r in samples if r['label'] == label and r['cue'] == cue and r[field] is not None]) for field in ['lagMs', 'queueLateMs', 'paintMs', 'wireAfterDeadlineMs']} for cue in sorted(set(r['cue'] for r in samples))}}
report = {'valid': valid, 'sameWorkloadAndOutcome': comparable, 'cases': cases, 'metrics': metrics, 'definition': 'Desfase = diferencia positiva del primer requestAnimationFrame tras iniciar la presentación respecto al mismo evento del DM. Es una oportunidad de pintar, no una lectura de píxeles. El tiempo entre frames se mide aparte. Los percentiles usan muestras observadas; omisiones y muestras sin RAF se cuentan por separado, nunca como latencia cero. Cuatro rondas con ritmo normal, mismo escenario, semilla y viewports, orden ABBA, Auth/RTDB Emulator y una pareja de capturas en vivo por ronda. Nueve contextos comparten un runner CI: no son nueve dispositivos físicos ni una medición de Internet.'}
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
for axis, key, title in [(axes[0], 'clashLagMs', 'Desfase frente al DM durante Clashes'), (axes[1], 'frameMs', 'Tiempo entre frames de los jugadores')]:
    keys=['median','p95','max'];x=range(3)
    for shift,label,title_label in [(-.19,'before','Antes'),(.19,'after','Ahora')]:
        values=[metrics[label][key][k] for k in keys]
        bars=axis.bar([i+shift for i in x],values,width=.36,color=colors[label],label=title_label)
        axis.bar_label(bars,labels=[f'{v:,.1f}' for v in values],padding=4,fontsize=9)
    axis.set_xticks(list(x),['Mediana','P95','Máximo']);axis.set_title(title,loc='left',fontsize=12);axis.set_ylabel('Milisegundos · menor es mejor');axis.grid(axis='y',alpha=.18);axis.set_axisbelow(True);axis.margins(y=.18)
axes[0].legend(frameon=False)
fig.suptitle('Un DM y ocho jugadores · nueve navegadores',x=.06,ha='left',fontsize=17,fontweight='bold')
fig.text(.06,.025,('MEDICIÓN INCOMPLETA · ' if not valid else '')+'Battle Viewer completo · mismo ritmo, escenario y semilla · Auth/RTDB Emulator en un runner CI',fontsize=9,color='#566171')
fig.tight_layout(rect=(.03,.07,1,.9));fig.savefig(root/'antes-ahora.png',dpi=160);plt.close(fig)

cues=sorted(metrics['after']['byPhase'],key=lambda cue:metrics['after']['byPhase'][cue]['lagMs']['p95'] or -1,reverse=True)
fig,axis=plt.subplots(figsize=(11,max(5.5,len(cues)*.48)))
for offset,label,title_label in [(-.18,'before','Antes'),(.18,'after','Ahora')]:
    values=[metrics[label]['byPhase'][cue]['lagMs']['p95'] or 0 for cue in cues]
    bars=axis.barh([i+offset for i in range(len(cues))],values,height=.34,color=colors[label],label=title_label)
    axis.bar_label(bars,labels=[f'{v:,.1f} ms' for v in values],padding=5,fontsize=9)
axis.set_yticks(range(len(cues)),[names.get(c,c) for c in cues]);axis.invert_yaxis();axis.set_xlabel('P95 del desfase visual frente al DM (ms)');axis.set_title('Dónde se acumula más retraso',loc='left',fontweight='bold',fontsize=17,pad=22);axis.grid(axis='x',alpha=.18);axis.set_axisbelow(True);axis.margins(x=.22);axis.legend(frameon=False)
fig.text(.02,.012,('MEDICIÓN INCOMPLETA · ' if not valid else '')+'Ordenado por P95 actual. Una pausa prevista de animación no se cuenta como bloqueo.',fontsize=9,color='#566171');fig.tight_layout(rect=(0,.04,1,1));fig.savefig(root/'picos-por-fase.png',dpi=160);plt.close(fig)
before=metrics['before']['clashLagMs']['p95'];after=metrics['after']['clashLagMs']['p95']
lines=['# Nueve navegadores: antes y ahora','',f'Comparación válida y completa: {valid}. Escenario y resultados equivalentes: {comparable}.',f'P95 de desfase en Clashes: {before:.1f} ms antes; {after:.1f} ms ahora; diferencia {after-before:+.1f} ms.','',report['definition'],'','## Fases con más retraso actual','','| Fase | P95 visual | P95 cola tardía | P95 render→rAF | P95 recepción tras deadline |','| --- | ---: | ---: | ---: | ---: |']
for cue in cues:
    data=metrics['after']['byPhase'][cue]
    values=[data[k]['p95'] for k in ['lagMs','queueLateMs','paintMs','wireAfterDeadlineMs']]
    lines.append('| '+names.get(cue,cue)+' | '+' | '.join('Sin dato' if v is None else f'{v:.1f} ms' for v in values)+' |')
(root/'RESULTADO.md').write_text('\n'.join(lines)+'\n')
print(json.dumps({'valid':valid,'sameWorkloadAndOutcome':comparable,'beforeClashP95':before,'afterClashP95':after,'cases':cases},ensure_ascii=False))
if not valid: sys.exit(1)
