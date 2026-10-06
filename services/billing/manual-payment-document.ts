import { Buffer } from 'node:buffer';

export type ManualPaymentDocument = {
  id:string; manual_request_id:string; subscription_id:string|null; user_id:string; barbershop_id:string;
  document_type:'PAYMENT_RECEIPT'; document_number:string; issued_at:string; customer_name:string;
  customer_email:string; barbershop_name:string; plan:string; billing_interval:'month'|'year';
  payment_method:'MANUAL'; description:string; currency:string; subtotal:number; tax_amount:number; total:number;
  pdf_generated_at:string|null; email_sent_at:string|null; email_message_id:string|null; email_error:string|null;
  created_at:string; updated_at:string;
};
const ascii=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/€/g,'EUR').replace(/[^\x20-\x7E]/g,'');
const esc=(v:string)=>ascii(v).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
const money=(v:number,c:string)=>new Intl.NumberFormat('pt-PT',{style:'currency',currency:c,minimumFractionDigits:2}).format(v).replace('€','EUR');
const dt=(v:string)=>{const d=new Date(v);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('pt-PT',{dateStyle:'long',timeStyle:'short'}).format(d)};
const plan=(v:string)=>v==='enterprise'?'Barbers Enterprise':'Barbers Pro';
const interval=(v:'month'|'year')=>v==='year'?'Anual':'Mensal';
const wrap=(v:string,max=90)=>{const w=ascii(v).split(/\s+/).filter(Boolean),o:string[]=[];let l='';for(const x of w){const n=l?l+' '+x:x;if(n.length>max&&l){o.push(l);l=x}else l=n}if(l)o.push(l);return o};
export function generateManualPaymentReceiptPdf(d:ManualPaymentDocument):Buffer{
 const rows=[['SILENTRA',22,true],['Comprovativo de pagamento',13,true], [d.document_number,10,false],
 [d.barbershop_name,12,true],[d.customer_name,10,false],[d.customer_email,10,false],
 [`Plano: ${plan(d.plan)}`,10,false],[`Periodicidade: ${interval(d.billing_interval)}`,10,false],
 ['Metodo de pagamento: Pagamento manual',10,false],[`Data de pagamento: ${dt(d.issued_at)}`,10,false],
 [`Descricao: ${d.description}`,10,false],[`Subtotal: ${money(d.subtotal,d.currency)}`,10,false],
 [`Impostos: ${money(d.tax_amount,d.currency)}`,10,false],[`Total pago: ${money(d.total,d.currency)}`,14,true],
 ['Documento interno / comprovativo de pagamento.',9,true],['Nao substitui uma fatura ou recibo fiscal certificado.',9,false],
 ['Para efeitos fiscais, a faturacao deve ser emitida por sistema certificado quando aplicavel.',8,false]] as const;
 const content:string[]=[];let y=760;
 for(const [text,size,bold] of rows){for(const line of wrap(text,size>=14?72:92)){content.push(`BT /${bold?'F2':'F1'} ${size} Tf 58 ${y.toFixed(2)} Td (${esc(line)}) Tj ET`);y-=size+8}}
 content.push('BT /F1 8 Tf 58 42 Td (Silentra for Barbers - documento gerado automaticamente.) Tj ET');
 const stream=content.join('\n');
 const objs=[ '<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
 '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
 `<< /Length ${Buffer.byteLength(stream,'latin1')} >>\nstream\n${stream}\nendstream`,
 '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
 '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
 let out='%PDF-1.4\n';const off:number[]=[0];objs.forEach((o,i)=>{off[i+1]=Buffer.byteLength(out,'latin1');out+=`${i+1} 0 obj\n${o}\nendobj\n`});
 const x=Buffer.byteLength(out,'latin1');out+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=objs.length;i++)out+=`${String(off[i]).padStart(10,'0')} 00000 n \n`;out+=`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
 return Buffer.from(out,'latin1');
}
