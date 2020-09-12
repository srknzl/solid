const N3 = require("n3");

const literal = `
@prefix poc: <http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<> a poc:ValueBinding;
poc:literalValue "10"^^xsd:integer.

`
const uri = `
@prefix poc: <http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#> .
@prefix a: <http://a.com.tr#> .
<> a poc:ValueBinding;
poc:uriValue a:selam.

`

const parser = new N3.Parser();

const literalQuads = parser.parse(literal);
const uriQuads = parser.parse(uri);

console.log(literalQuads[1].object.datatype);
console.log(literalQuads[1].object.value);
console.log(uriQuads[1].object.value);


