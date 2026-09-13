const pptxgen = require('pptxgenjs');
const { warnIfSlideHasOverlaps, warnIfSlideElementsOutOfBounds } = require('/home/oai/skills/slides/pptxgenjs_helpers');

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'BoundKey';
pptx.subject = 'Solana Mobile hackathon pitch deck';
pptx.title = 'BoundKey Pitch Deck';
pptx.company = 'BoundKey';
pptx.lang = 'en-US';
pptx.theme = {
  headFontFace: 'Aptos Display',
  bodyFontFace: 'Aptos',
  lang: 'en-US'
};
pptx.defineLayout({ name: 'CUSTOM_WIDE', width: 13.333, height: 7.5 });
pptx.layout = 'CUSTOM_WIDE';
pptx.margin = 0;

const C = {
  bg: '09090B',
  panel: '111113',
  panel2: '151517',
  border: '29292E',
  text: 'F7F7F8',
  muted: 'A1A1AA',
  faint: '71717A',
  green: '8AF0A0',
  greenDark: '173820',
  red: 'FF8B95',
  redDark: '2A1214',
  blue: '8EA2FF',
  yellow: 'FFD166',
};
const SW = 13.333, SH = 7.5;
function bg(slide) { slide.background = { color: C.bg }; }
function foot(slide, n) { slide.addText('BOUNDKEY', {x:0.45,y:7.05,w:1.3,h:0.18,fontFace:'Aptos',fontSize:7,bold:true,color:C.faint,charSpace:1.2,margin:0}); slide.addText(String(n).padStart(2,'0'), {x:12.45,y:7.05,w:0.4,h:0.18,fontSize:7,bold:true,color:C.faint,margin:0,align:'right'}); }
function title(slide, kicker, t, sub) {
  slide.addText(kicker.toUpperCase(), {x:0.65,y:0.55,w:5,h:0.24,fontSize:8.5,bold:true,color:C.green,charSpace:1.5,margin:0});
  slide.addText(t, {x:0.65,y:0.9,w:7.4,h:0.78,fontSize:32,bold:true,color:C.text,breakLine:false,margin:0,fit:'shrink'});
  if (sub) slide.addText(sub, {x:0.67,y:1.9,w:6.7,h:0.38,fontSize:12,color:C.muted,margin:0,fit:'shrink'});
}
function pill(slide, text, x, y, w, color=C.green) { slide.addShape(pptx.ShapeType.roundRect,{x,y,w,h:0.34,rectRadius:0.07,fill:{color:C.panel},line:{color:C.border,pt:0.7}}); slide.addText(text,{x:x+0.08,y:y+0.095,w:w-0.16,h:0.1,fontSize:7.5,bold:true,color,margin:0,align:'center'}); }
function box(slide, x,y,w,h, opts={}) { slide.addShape(pptx.ShapeType.roundRect,{x,y,w,h,rectRadius:0.08,fill:{color:opts.fill||C.panel},line:{color:opts.line||C.border,pt:opts.pt||1}}); }
function label(slide, text, x,y,w,h, fontSize=14, color=C.text, bold=false, align='left') { slide.addText(text,{x,y,w,h,fontSize,bold,color,margin:0,fit:'shrink',breakLine:false,align,valign:'mid'}); }
function node(slide, x,y,w,h, head, body, accent=C.green) { box(slide,x,y,w,h,{fill:C.panel2}); slide.addText(head,{x:x+0.18,y:y+0.18,w:w-0.36,h:0.22,fontSize:12,bold:true,color:accent,margin:0}); slide.addText(body,{x:x+0.18,y:y+0.52,w:w-0.36,h:h-0.65,fontSize:9.5,color:C.muted,margin:0,fit:'shrink',breakLine:false}); }
function arrowText(slide, x,y, text='→') { slide.addText(text,{x,y,w:0.36,h:0.3,fontSize:19,bold:true,color:C.green,margin:0,align:'center',valign:'mid'}); }
function phone(slide, x, y, w, h, active=false) {
  box(slide,x,y,w,h,{fill:'0D0D0F',line:'303035',pt:1.1});
  label(slide,'BOUNDKEY',x+0.22,y+0.25,1.1,0.14,6.5,C.text,true);
  label(slide,'7Kp…3Lm',x+w-0.9,y+0.25,0.62,0.14,6.5,C.muted,false,'right');
  label(slide,active?'Capability active':'Review permission',x+0.22,y+0.78,w-0.44,0.32,18,C.text,true);
  box(slide,x+0.25,y+1.35,w-0.5,2.05,{fill:C.panel2});
  label(slide,active?'● ACTIVE':'MPP SESSION',x+0.46,y+1.6,w-0.92,0.18,8,active?C.green:C.green,true,'center');
  label(slide,'Codex → Metered Research API',x+0.46,y+2.05,w-0.92,0.22,9,C.text,true,'center');
  label(slide,'Hard cap  $0.50 USDC',x+0.46,y+2.47,w-0.92,0.22,10,C.green,true,'center');
  label(slide,'Session key  CR8ug…gQGq',x+0.46,y+2.88,w-0.92,0.18,7,C.muted,false,'center');
  if (active) {
    slide.addShape(pptx.ShapeType.rect,{x:x+0.36,y:y+3.8,w:w-0.72,h:0.07,fill:{color:'29312A'},line:{color:'29312A'}});
    slide.addShape(pptx.ShapeType.rect,{x:x+0.36,y:y+3.8,w:(w-0.72)*0.14,h:0.07,fill:{color:C.green},line:{color:C.green}});
    label(slide,'5 signed vouchers · $0.431 remaining',x+0.36,y+4.0,w-0.72,0.15,7,C.muted,false,'center');
  } else {
    slide.addShape(pptx.ShapeType.roundRect,{x:x+0.35,y:y+3.7,w:w-0.7,h:0.45,rectRadius:0.06,fill:{color:C.green},line:{color:C.green}});
    label(slide,'Authorize up to $0.50',x+0.48,y+3.86,w-0.96,0.1,9,'07150A',true,'center');
  }
}
function terminal(slide, x,y,w,h) { box(slide,x,y,w,h,{fill:'0E0E10',line:'303035'}); slide.addShape(pptx.ShapeType.rect,{x,y,w,h:0.4,fill:{color:'121214'},line:{color:'242428',pt:0.5}}); ['343439','343439','343439'].forEach((c,i)=>slide.addShape(pptx.ShapeType.ellipse,{x:x+0.18+i*0.17,y:y+0.15,w:0.06,h:0.06,fill:{color:c},line:{color:c}})); label(slide,'codex · research-agent',x+0.78,y+0.14,1.8,0.1,7,C.faint); const lines=['$ codex run research ACME','← 402 · intent=session · voucherSigner=client','QR shown: mobile authorization required','✓ phone signed channel open','voucher 1: +$0.012 → cumulative $0.012','voucher 5: +$0.013 → cumulative $0.069','✕ prompt injection: requested $5.00','✕ rejected: cumulative > deposit']; let yy=y+0.7; lines.forEach((ln,i)=>{label(slide,ln,x+0.32,yy,w-0.64,0.18,8.6,i<1?C.text:(i<6?C.muted:C.red),i===3); yy+=0.37;}); }

// Slide 1
{ const s=pptx.addSlide(); bg(s); s.addText('BOUNDKEY',{x:0.65,y:0.62,w:2.1,h:0.25,fontSize:11,bold:true,color:C.green,charSpace:2,margin:0}); s.addText('Give the agent a key.\nNot your wallet.',{x:0.65,y:1.42,w:6.2,h:1.35,fontSize:43,bold:true,color:C.text,margin:0,breakLine:false,fit:'shrink'}); s.addText('A Solana Mobile authorization layer for AI agents that need metered payments without holding the payer wallet key.',{x:0.7,y:3.02,w:5.4,h:0.55,fontSize:14,color:C.muted,margin:0,fit:'shrink'}); pill(s,'Solana Mobile',0.7,3.92,1.2); pill(s,'MPP Session',2.02,3.92,1.1); pill(s,'Payment Channels',3.24,3.92,1.35); phone(s,8.2,0.75,3.1,5.3,false); node(s,6.35,2.9,1.45,1.05,'AGENT','Disposable\nsession key',C.blue); foot(s,1); }

// Slide 2
{ const s=pptx.addSlide(); bg(s); title(s,'Problem','Agent payments break trust','Autonomy is useful only if money can move safely.'); node(s,0.85,2.55,2.65,2.05,'Option A','Paste a wallet key into the agent runtime. Too much authority.',C.red); node(s,3.9,2.55,2.65,2.05,'Option B','Approve every tiny API payment. Autonomy disappears.',C.yellow); node(s,6.95,2.55,2.65,2.05,'Option C','Prefund throwaway wallets. Now wallet lifecycle is the product.',C.blue); box(s,10.15,2.45,2.2,2.3,{fill:C.redDark,line:'5C2228'}); label(s,'Prompt injection asks for $5.00',10.42,3.0,1.65,0.45,18,C.text,true,'center'); label(s,'Without scoping, a small tool call becomes a wallet risk.',10.44,3.76,1.6,0.45,10,'D9A4A9',false,'center'); foot(s,2); }

// Slide 3
{ const s=pptx.addSlide(); bg(s); title(s,'Insight','Split financial authority across devices','The phone is the root of authority. The agent only gets a scoped capability.'); node(s,0.95,2.55,2.45,2.05,'PHONE / SEEKER','Payer wallet\nMobile Wallet Adapter\nHuman review',C.green); arrowText(s,3.65,3.45,'→'); node(s,4.25,2.45,2.65,2.55,'SOLANA CHANNEL','payer = phone\npayee = one service\ndeposit = hard cap\nauthorized signer = agent key',C.text); arrowText(s,7.18,3.45,'←'); node(s,7.75,2.55,2.45,2.05,'AGENT MACHINE','Ephemeral Ed25519 key\nSigns cumulative vouchers\nNo payer private key',C.blue); box(s,10.7,2.6,1.6,1.85,{fill:C.greenDark,line:'316B3C'}); label(s,'Delegation\nwithout\ncustody',10.98,3.06,1.0,0.6,19,C.green,true,'center'); foot(s,3); }

// Slide 4
{ const s=pptx.addSlide(); bg(s); title(s,'Product flow','Scan. Review. Authorize. Let the agent work.','A mobile-first approval loop for desktop/cloud agents.'); const steps=[['1','Agent hits paid MPP endpoint','402 session challenge'],['2','QR goes to phone','request contains cap + payee + key'],['3','Wallet signs on mobile','MWA signs channel open'],['4','Agent streams work','session key signs vouchers'],['5','Attack is bounded','$5 / wrong payee fails']]; let x=0.8; steps.forEach((st,i)=>{box(s,x,2.6,2.2,2.05,{fill:i===4?C.redDark:C.panel2,line:i===4?'5C2228':C.border}); label(s,st[0],x+0.18,2.82,0.35,0.25,18,i===4?C.red:C.green,true); label(s,st[1],x+0.18,3.25,1.75,0.4,13,C.text,true); label(s,st[2],x+0.18,3.93,1.75,0.38,9.5,i===4?'D9A4A9':C.muted);  x+=2.45;}); foot(s,4); }

// Slide 5
{ const s=pptx.addSlide(); bg(s); title(s,'Live architecture','A cross-device MPP SessionOpener','The agent waits while mobile signs the official Payment Channel open.'); terminal(s,0.75,2.28,4.8,3.8); phone(s,5.95,2.45,2.65,4.2,true); node(s,9.15,2.15,2.55,1.2,'MPP SERVICE','Returns 402 session challenge and later verifies voucher commits.',C.yellow); node(s,9.15,4.0,2.55,1.2,'SOLANA','Payment Channel enforces payee/signature/deposit constraints.',C.green); foot(s,5); }

// Slide 6
{ const s=pptx.addSlide(); bg(s); title(s,'Technical proof','Not just a UI wrapper','The repo contains protocol-level work judges can inspect.'); node(s,0.9,2.45,2.75,2.4,'REQUEST PROOF','Ephemeral Ed25519 key signs the BoundKey authorization request. Tampering breaks verification.',C.green); node(s,4.0,2.45,2.75,2.4,'VOUCHER BYTES','Canonical 50-byte payload: magic + channel id + u64 cumulative + i64 expiry.',C.blue); node(s,7.1,2.45,2.75,2.4,'BRIDGE OPENER','Custom MPP SessionOpener: QR to phone, wait for mobile open, resume SessionFetch.',C.yellow); box(s,10.3,2.55,1.95,2.15,{fill:'102014',line:'316B3C'}); label(s,'7/7',10.77,2.98,0.9,0.45,34,C.green,true,'center'); label(s,'protocol tests\npassing',10.72,3.68,0.95,0.45,12,C.text,true,'center'); foot(s,6); }

// Slide 7
{ const s=pptx.addSlide(); bg(s); title(s,'Why Solana Mobile','The phone is the trusted approval surface','Mobile is not decorative; it is the security boundary.'); node(s,1.05,2.55,2.7,2.35,'MOBILE WALLET ADAPTER','Uses the user’s existing wallet. No seed phrase export. No custom wallet to audit.',C.green); node(s,4.15,2.55,2.7,2.35,'QR HANDOFF','Desktop/cloud agents can request authority without sharing the payer key.',C.blue); node(s,7.25,2.55,2.7,2.35,'ACTIVITY LOOP','The app becomes the financial remote for agent approvals, live caps and blocked attempts.',C.yellow); box(s,10.6,2.82,1.55,1.55,{fill:C.panel2}); label(s,'Seeker\nready',10.93,2.95,0.85,0.55,22,C.text,true,'center'); foot(s,7); }

// Slide 8
{ const s=pptx.addSlide(); bg(s); title(s,'Demo plan','One real flow + one deterministic attack','Do not let RPC/wallet issues ruin the pitch.'); node(s,0.9,2.28,3.2,2.8,'LIVE PROOF','Run demo merchant → MPP challenge → phone MWA signs channel open → agent streams metered chunks → save transaction/receipt.',C.green); node(s,4.65,2.28,3.2,2.8,'FALLBACK','Offline web/mobile demo shows the same invariants: hard cap, payee binding, session signer only.',C.blue); node(s,8.4,2.28,3.2,2.8,'EVIDENCE BUNDLE','APK, GitHub, video, deck, channel id, explorer link, test output, README security model.',C.yellow); foot(s,8); }

// Slide 9
{ const s=pptx.addSlide(); bg(s); title(s,'Roadmap','From hackathon demo to agent money permissions','Start narrow. Expand only after the live primitive works.'); const items=[['V0','one agent · one service · one cap'],['V1','multiple providers under a task budget'],['V2','recurring allowances + team policy'],['V3','agent identity + merchant reputation'],['V4','real-world commerce permissions']]; let y=2.48; items.forEach((it,i)=>{label(s,it[0],1.0,y,0.5,0.22,16,i===0?C.green:C.faint,true); box(s,1.72,y-0.07,6.2,0.5,{fill:i===0?C.greenDark:C.panel2,line:i===0?'316B3C':C.border}); label(s,it[1],1.95,y+0.08,5.5,0.15,12,i===0?C.text:C.muted,true); y+=0.72;}); box(s,9.0,2.65,2.7,2.2,{fill:C.greenDark,line:'316B3C'}); label(s,'Winning claim',9.35,3.05,2.0,0.24,14,C.green,true,'center'); label(s,'Autonomous software should receive exactly the financial authority required for a task — not a wallet full of money.',9.35,3.55,2.0,0.7,12,C.text,false,'center'); foot(s,9); }

for (const slide of pptx._slides) {
  warnIfSlideHasOverlaps(slide, pptx, { ignoreLines: true, ignoreDecorativeShapes: true });
  warnIfSlideElementsOutOfBounds(slide, pptx);
}

pptx.writeFile({ fileName: '/mnt/data/agentpass-work/submission/BoundKey_pitch_deck.pptx' });
