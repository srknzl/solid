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
acl:agentGroup  <https://serkanozel.me/pocUsers.ttl#poc>.
`;
};

/* export const workflowInstanceACL = (workflow, user, randomString) => {
  return `
@prefix services: <http://web.cmpe.boun.edu.tr/soslab/ontologies/poc/services#> .
@prefix poc: <http://soslab.cmpe.boun.edu.tr/ontologies/poc_core.ttl#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<> a poc:WorkflowInstance;
poc:datatype <${workflow}>;
poc:status "ongoing";
dcterms:created "${new Date().toISOString()}"^^xsd:dateTime;
dcterms:creator <${user}>;
services:stepInstances <${randomString}_step_instances>.`;
}; */


export default {
  rootACL: rootACL,
};
