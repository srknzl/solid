export const rootACL = (rootURI) => {
  return `
# Default ACL resource 

@prefix acl: <http://www.w3.org/ns/auth/acl#>.
@prefix foaf: <http://xmlns.com/foaf/0.1/>.

<#owner>
a acl:Authorization;

acl:agent
<${rootURI}/profile/card#me>;

acl:accessTo <./>;
acl:default <./>;

acl:mode
acl:Read, acl:Write, acl:Control.

<#authorization>
a               acl:Authorization;
acl:accessTo <./>;
acl:default <./>;
acl:mode        acl:Read,
                acl:Write;
acl:agentGroup  <http://serkanozel.me/pocUsers.ttl#poc>.
`;
};

export const workflowInstanceTTL = (workflow, user, randomString) => {
  return `
@prefix services: <http://web.cmpe.boun.edu.tr/soslab/ontologies/poc/services#> .
@prefix poc: <http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<> a poc:WorkflowInstance;
poc:datatype <${workflow}>;
poc:status "ongoing";
dcterms:created "${new Date().toISOString()}"^^xsd:dateTime;
dcterms:creator <${user}>;
services:stepInstances <${randomString}_step_instances>.`;
};

const stepInstanceTTL = (stepURI, userURI) => {
  return `
@prefix services: <http://web.cmpe.boun.edu.tr/soslab/ontologies/poc/services#> .
@prefix poc: <http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

<> a poc:StepInstance;
poc:datatype <${stepURI}>;
dcterms:created "${new Date().toISOString()}"^^xsd:dateTime;
dcterms:creator <${userURI}>;
poc:status "pending";
`;
// add services:performer and services:performedAt, update status after performal of the step instance

}
const URIValueBinding = (URI) => {
  return `  
@prefix poc: <http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#> .

<> a poc:ValueBinding;
poc:uriValue <${URI}>.
  `;

}

const literalValueBinding = (value, xsdDatatype) => {
  return `  
@prefix poc: <http://web.cmpe.boun.edu.tr/soslab/ontologies/poc#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<> a poc:ValueBinding;
poc:literalValue "${value}"^^${'xsd:' + xsdDatatype}.
  `;

}






export default {
  rootACL: rootACL,
  workflowInstanceTTL: workflowInstanceTTL,
  stepInstanceTTL: stepInstanceTTL,
  URIValueBinding: URIValueBinding,
  literalValueBinding: literalValueBinding
};
