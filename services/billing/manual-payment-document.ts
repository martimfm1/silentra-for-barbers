import { Buffer } from 'node:buffer';

export type ManualPaymentDocument = {
  id:string; manual_request_id:string; subscription_id:string|null; user_id:string; barbershop_id:string;
  document_type:'PAYMENT_RECEIPT'; document_number:string; issued_at:string; customer_name:string;
  customer_email:string; barbershop_name:string; plan:string; billing_interval:'month'|'year';
  payment_method:'MANUAL'; description:string; currency:string; subtotal:number; tax_amount:number; total:number;
  customer_tax_id:string|null; customer_phone:string|null; customer_address_line1:string|null;
  customer_address_line2:string|null; customer_postal_code:string|null; customer_city:string|null;
  customer_country:string|null; customer_website:string|null; seller_name:string; seller_website:string;
  pdf_generated_at:string|null; email_sent_at:string|null; email_message_id:string|null; email_error:string|null;
  created_at:string; updated_at:string;
};

const ascii=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/€/g,'EUR').replace(/[\u2013\u2014]/g,'-').replace(/[^\x20-\x7E]/g,'');
const esc=(v:string)=>ascii(v).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
const money=(v:number,c:string)=>new Intl.NumberFormat('pt-PT',{style:'currency',currency:c,minimumFractionDigits:2}).format(v).replace('€','EUR');
const date=(v:string)=>{const d=new Date(v);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('pt-PT',{dateStyle:'long'}).format(d)};
const time=(v:string)=>{const d=new Date(v);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('pt-PT',{timeStyle:'short'}).format(d)};
const plan=(v:string)=>v==='enterprise'?'Barbers Enterprise':'Barbers Pro';
const interval=(v:'month'|'year')=>v==='year'?'Anual':'Mensal';
const wrap=(v:string,max=84)=>{const words=ascii(v).split(/\s+/).filter(Boolean),out:string[]=[];let line='';for(const word of words){const next=line?line+' '+word:word;if(next.length>max&&line){out.push(line);line=word}else line=next}if(line)out.push(line);return out};

export function generateManualPaymentReceiptPdf(d:ManualPaymentDocument):Buffer{
  const pageW=595,pageH=842,left=48,right=547;
  const content:string[]=[];
  const rect=(x:number,y:number,w:number,h:number,stroke=true,fill=false)=>{
    content.push(fill?'0.97 0.98 0.99 rg':'1 1 1 rg'); content.push(`${x} ${y} ${w} ${h} ${fill?'re':'S'}`);
    if(fill) content.push('0.88 0.89 0.91 RG 0.5 w');
  };
  const text=(x:number,y:number,value:string,size=9,bold=false)=>{
    content.push(`BT /${bold?'F2':'F1'} ${size} Tf 0.12 0.13 0.16 rg ${x} ${y} Td (${esc(value)}) Tj ET`);
  };
  const line=(x1:number,y:number,x2:number)=>content.push(`0.86 0.87 0.89 RG 0.6 w ${x1} ${y} m ${x2} ${y} l S`);

  // Header
  content.push('0.055 0.055 0.07 rg 0 0 595 842 re f');
  text(left,785,d.seller_name||'Silentra',25,true);
  text(left,765,'Silentra for Barbers',10,false);
  text(left,746,d.seller_website||'https://silentra.me',9,false);
  text(390,785,'COMPROVATIVO',9,true);
  text(390,765,'DE PAGAMENTO',9,true);
  text(390,744,d.document_number,9,false);

  // Main white sheet
  content.push('1 1 1 rg 40 80 515 625 re f');
  text(62,674,'Comprovativo de pagamento',18,true);
  text(62,655,'Documento de pagamento emitido pela Silentra.',9,false);
  line(62,638,533);

  // Parties
  text(62,615,'EMITIDO POR',7,true);
  text(62,598,'Silentra',10,true);
  text(62,582,'Silentra for Barbers',9,false);
  text(62,567,'https://silentra.me',8,false);
  text(300,615,'CLIENTE',7,true);
  text(300,598,d.customer_name||d.barbershop_name,10,true);
  text(300,582,d.customer_email,8,false);
  if(d.customer_tax_id) text(300,567,`NIF / VAT: ${d.customer_tax_id}`,8,false);

  let y=535;
  const address=[d.customer_address_line1,d.customer_address_line2,[d.customer_postal_code,d.customer_city].filter(Boolean).join(' '),d.customer_country].filter(Boolean) as string[];
  for(const value of address){for(const l of wrap(value,38)) {text(300,y,l,8,false);y-=11}}

  // Payment metadata card
  content.push('0.96 0.97 0.98 rg 62 414 471 88 re f');
  text(78,481,'DETALHES DO PAGAMENTO',7,true);
  text(78,460,'Serviço',7,false); text(78,444,'Silentra for Barbers - '+plan(d.plan),9,true);
  text(315,460,'Periodicidade',7,false); text(315,444,interval(d.billing_interval),9,true);
  text(78,426,'Método',7,false); text(78,410,'Pagamento manual',9,true);
  text(315,426,'Data',7,false); text(315,410,`${date(d.issued_at)} às ${time(d.issued_at)}`,8,true);

  // Totals
  text(62,374,'RESUMO',7,true);
  line(62,361,533);
  text(62,337,d.description,9,false);
  text(430,337,money(d.subtotal,d.currency),9,false);
  text(62,312,'Subtotal',8,false); text(430,312,money(d.subtotal,d.currency),8,false);
  text(62,291,'Impostos / IVA',8,false); text(430,291,money(d.tax_amount,d.currency),8,false);
  content.push('0.055 0.055 0.07 rg 62 238 471 39 re f');
  text(78,253,'TOTAL PAGO',8,true); content.push(`BT /F2 15 Tf 1 1 1 rg 430 250 Td (${esc(money(d.total,d.currency))}) Tj ET`);

  // Footer / legal distinction
  text(62,210,'INFORMAÇÃO',7,true);
  let fy=192;
  for(const l of wrap('Este documento é um comprovativo interno de pagamento relativo à subscrição Silentra for Barbers. Não constitui, por si só, uma fatura ou recibo fiscal certificado.',88)){text(62,fy,l,7,false);fy-=10}
  if(d.customer_website) text(62,150,`Website do cliente: ${d.customer_website}`,7,false);
  text(62,112,'Documento gerado automaticamente pela plataforma Silentra.',7,false);
  text(62,98,'Silentra  ·  silentra.me  ·  barbers.silentra.me',7,false);

  const stream=content.join('\n');
  const objs=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream,'latin1')} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
  ];
  let out='%PDF-1.4\n';const offsets:number[]=[0];
  objs.forEach((obj,i)=>{offsets[i+1]=Buffer.byteLength(out,'latin1');out+=`${i+1} 0 obj\n${obj}\nendobj\n`});
  const xref=Buffer.byteLength(out,'latin1');
  out+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<=objs.length;i++)out+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
  out+=`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out,'latin1');
}
