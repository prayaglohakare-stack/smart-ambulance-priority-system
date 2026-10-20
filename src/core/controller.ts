export type Direction = 'North' | 'South' | 'East' | 'West'
export type Phase = 'north-south' | 'east-west' | 'yellow' | 'all-red' | 'emergency-green' | 'recovery' | 'paused'
export type Signal = 'red' | 'yellow' | 'green'
export type EventKind = 'detection' | 'scan' | 'auth' | 'queue' | 'signal' | 'clearance' | 'priority' | 'passage' | 'resume' | 'fault' | 'system'
export interface SimEvent { id: number; at: number; kind: EventKind; severity: 'info' | 'warning' | 'success' | 'critical'; message: string; simulated: true }
export interface Request { id: number; direction: Direction; tag: string; vehicle: string; createdAt: number; status: 'queued' | 'transitioning' | 'active' | 'recovery' | 'confirmed' | 'rejected'; passage: boolean }
export interface Durations { green: number; yellow: number; allRed: number; passageTimeout: number }
export interface RfidEvent { source:'simulation'|'hardware'; direction:Direction; tagId:string; occurredAt:number }
export interface SensorEvent { source:'simulation'|'hardware'; direction:Direction; detected:boolean; occurredAt:number }
export interface TrafficSignalState { direction:Direction; indication:Signal; changedAt:number }
export interface EmergencyRequest { id:string; direction:Direction; tagId:string; authenticated:boolean; receivedAt:number }
export interface ControllerTelemetry { phase:Phase; signals:Record<Direction,Signal>; queuedRequests:number; fault:boolean; sampledAt:number }
export interface CommunicationStatus { transport:'none'|'api'|'websocket'|'mqtt'; connected:boolean; lastMessageAt?:number }
export interface Snapshot { phase: Phase; signals: Record<Direction, Signal>; queue: Request[]; active: Request | null; events: SimEvent[]; paused: boolean; fault: boolean; counts: { authorized: number; rejected: number; total: number }; now: number }
export const AUTHORIZED: Record<string, {vehicle:string; type:string}> = { 'AMB-7F2A': { vehicle: 'Medic 07', type: 'Advanced life support' }, 'AMB-91C4': { vehicle: 'Rescue 12', type: 'Patient transport' } }
const opposing = (d:Direction) => d === 'North' || d === 'South'
export class TrafficController {
  private state: Snapshot
  private seq=0
  private clock:()=>number
  private durations:Durations
  private phaseSince:number
  private normalNext=true
  private pauseAt=0
  constructor(clock:()=>number=Date.now, durations:Durations={green:12000,yellow:3000,allRed:1500,passageTimeout:20000}) {
    this.clock=clock;this.durations=durations
    this.state={phase:'north-south',signals:{North:'green',South:'green',East:'red',West:'red'},queue:[],active:null,events:[],paused:false,fault:false,counts:{authorized:0,rejected:0,total:0},now:clock()};this.phaseSince=clock()
    this.emit('system','info','Simulation initialized; North–South traffic is green.')
  }
  snapshot():Snapshot { return structuredClone(this.state) }
  private emit(kind:EventKind,severity:SimEvent['severity'],message:string){this.state.events.unshift({id:++this.seq,at:this.clock(),kind,severity,message,simulated:true});this.state.now=this.clock()}
  private setSignals(signal:Signal, group?:boolean){const ns=group??(this.state.active?opposing(this.state.active.direction):this.state.phase==='north-south');this.state.signals={North:ns?signal:'red',South:ns?signal:'red',East:ns?'red':signal,West:ns?'red':signal}}
  tick(){this.state.now=this.clock();if(this.state.paused||this.state.fault)return; const s=this.state
    if(s.active?.status==='active' && this.clock()-s.active.createdAt>this.durations.passageTimeout){s.active.status='recovery';s.phase='recovery';s.fault=true;this.setSignals('red',true);this.emit('fault','warning',`Passage timeout for ${s.active.vehicle}; all approaches held red pending explicit recovery.`);return}
    const pending=s.queue[0];if(s.phase==='north-south'||s.phase==='east-west'){const currentNS=s.phase==='north-south';const shouldTransition=!!pending&&currentNS!==opposing(pending.direction);if(shouldTransition||this.clock()-this.phaseSince>=this.durations.green){this.normalNext=!currentNS;s.phase='yellow';this.setSignals('yellow',currentNS);if(pending)pending.status='transitioning';this.phaseSince=this.clock();this.emit('signal','warning',`Yellow transition started for ${currentNS?'North–South':'East–West'} traffic.`);return}}
    if(s.phase==='yellow'){if(this.clock()-this.phaseSince>=this.durations.yellow){this.setSignals('red');s.phase='all-red';this.phaseSince=this.clock();this.emit('clearance','warning','All-red clearance started.');}return}
    if(s.phase==='all-red'){if(this.clock()-this.phaseSince>=this.durations.allRed){if(s.queue.length){const req=s.queue.shift()!;s.active=req;req.status='active';req.createdAt=this.clock();s.phase='emergency-green';this.setSignals('green',opposing(req.direction));this.phaseSince=this.clock();this.emit('priority','success',`Emergency green granted to ${req.direction}; opposing pair only.`)}else{s.phase=this.normalNext?'north-south':'east-west';this.setSignals('green',this.normalNext);this.phaseSince=this.clock();this.emit('resume','info',`Normal ${this.normalNext?'North–South':'East–West'} traffic resumed.`)}}return}
  }
  scan(direction:Direction,tag:string){if(this.state.paused||this.state.fault)return; const id=tag.trim().toUpperCase();const existing=[...this.state.queue,...(this.state.active?[this.state.active]:[])].find(r=>r.tag===id&&r.status!=='confirmed');if(existing){this.emit('scan','warning',`Duplicate scan ${id} ignored; request already ${existing.status}.`);return}
    this.emit('detection','info',`Simulated vehicle detected on ${direction}.`);this.emit('scan','info',`Simulated RFID scan ${id} on ${direction}.`);this.state.counts.total++
    const authorized=AUTHORIZED[id];if(!authorized){this.state.counts.rejected++;this.emit('auth','critical',`Authentication failed for ${id}; no priority granted.`);return}
    this.state.counts.authorized++;this.emit('auth','success',`${id} authenticated as ${authorized.vehicle} (${authorized.type}).`);const request:Request={id:++this.seq,direction,tag:id,vehicle:authorized.vehicle,createdAt:this.clock(),status:'queued',passage:false};this.state.queue.push(request);this.emit('queue','warning',`Emergency request queued for ${direction} (position ${this.state.queue.length}).`)
  }
  normalVehicle(direction:Direction){this.emit('detection','info',`Simulated normal vehicle detected on ${direction}.`)}
  confirmPassage(){const a=this.state.active;if(!a||a.status!=='active')return false;a.passage=true;a.status='confirmed';this.emit('passage','success',`${a.vehicle} passage confirmed on ${a.direction}.`);this.state.active=null;const group=opposing(a.direction);this.state.phase='yellow';this.phaseSince=this.clock();this.setSignals('yellow',group);this.emit('signal','warning','Yellow transition started after emergency passage.');return true}
  simulateMissingPassage(){if(!this.state.active||this.state.active.status!=='active')return false;this.state.active.createdAt=this.clock()-this.durations.passageTimeout-1;this.tick();return this.state.phase==='recovery'}
  recover(){if(this.state.phase!=='recovery')return;this.state.active=null;this.state.fault=false;this.state.phase='all-red';this.phaseSince=this.clock();this.setSignals('red');this.emit('system','info','Operator acknowledged missing passage; conservative all-red recovery started.')}
  togglePause(){this.state.paused=!this.state.paused;if(this.state.paused){this.pauseAt=this.clock();this.emit('system','warning','Simulation paused; outputs held at current safe state.')}else{const pausedFor=this.clock()-this.pauseAt;this.phaseSince+=pausedFor;if(this.state.active)this.state.active.createdAt+=pausedFor;this.emit('system','info','Simulation resumed.')}}
  reset(){this.state.active=null;this.state.queue=[];this.state.paused=false;this.state.fault=false;this.normalNext=true;this.state.phase='all-red';this.phaseSince=this.clock();this.setSignals('red');this.emit('system','warning','Safe reset: all-red held before normal operation.');}
  clearEvents(){this.state.events=[];this.emit('system','info','Event log cleared.')}
}
