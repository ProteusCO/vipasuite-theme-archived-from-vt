var blocks = "div, span, applet, object, iframe, h1, h2, h3, h4, h5, h6, p, blockquote, pre, a, abbr, acronym, address, big, cite, code, del, dfn, em, img, ins, kbd, q, s, samp, small, strike, strong, sub, sup, tt, var, b, u, i, center, dl, dt, dd, ol, ul, li, fieldset, form, label, legend, table, caption, tbody, tfoot, thead, tr, th, td, article, aside, canvas, details, embed,  figure, figcaption, footer, header, hgroup,  menu, nav, output, ruby, section, summary, time, mark, audio, video";
var html5 = "article, aside, details, figcaption, figure, footer, header, hgroup, menu, nav, section";
var lists = "ol, ul";
var quotes = "blockquote, q";

var content = [];
var prefix = ".cms_le_ ";

content.push( blocks.split(",").map(function(el){return prefix + el;}).join(", ") + 
  "{\n margin:0 !important;\n padding:0 !important;\n border:0 !important;\n font-size:100% !important;\n font:inherit !important;\n vertical-align:baseline !important; -moz-box-sizing: border-box !important; box-sizing: border-box !important;\n}" );

content.push( html5.split(",").map(function(el){return prefix + el;}).join(", ") + 
  "{\n display:block !important; -moz-box-sizing: border-box !important; box-sizing: border-box !important;\n}" );

content.push( lists.split(",").map(function(el){return prefix + el;}).join(", ") + 
  "{\n padding: 0 0 0 40px !important; margin:1em 0 !important; list-style:none !important; -moz-box-sizing: border-box !important; box-sizing: border-box !important;\n}" );

content.push( quotes.split(",").map(function(el){return prefix + el;}).join(", ") + 
  "{\n quotes:none !important; -moz-box-sizing: border-box !important; box-sizing: border-box !important;\n}" );
content.push( quotes.split(",").map(function(el){return prefix + el;}).join(":before, ") + ":before, " + quotes.split(", ").map(function(el){return prefix + el;}).join(":after, ") + "{\n content:'' !important;\n content: none !important;\n}" );

content.push(prefix + " table{border-collapse:collapse !important; border-spacing:0 !important;}");
console.log(content.join("\n"));