import extension from '../../../../schemas/nugaom-market-data-runtime-extension.v1.schema.json' with {type:'json'};
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from '../../../../schemas/nugaom-market-data-envelope.v1.schema.json' with {type:'json'};
import {validateEnvelopeInvariants,validateApiErrorEnvelope} from './validate-envelope.mjs';
const ajv=new Ajv2020({allErrors:true,strict:false});
addFormats(ajv);
const shape=ajv.compile(schema);
const payload=ajv.compile(extension);
export function validateOutput(value) {
 const shaped=shape(value)&&payload(value);
 const semantic=value?.schemaVersion==='nugaom.api-error.v1'?validateApiErrorEnvelope(value):validateEnvelopeInvariants(value);
 // Never return Ajv params, additional property names, or provider input values.
 return {valid:shaped&&semantic.valid,errors:[...(!shaped?[{path:'$',code:'INVALID_SHAPE'}]:[]),...semantic.errors]};
}
