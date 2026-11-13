import extension from '../../../../schemas/nugaom-market-data-runtime-extension.v1.schema.json' with {type:'json'};
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from '../../../../schemas/nugaom-market-data-envelope.v1.schema.json' with {type:'json'};
import {validateEnvelopeInvariants,validateApiErrorEnvelope} from './validate-envelope.mjs';
let shape = null;
let payload = null;

function getValidators() {
  if (typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers') {
    return null;
  }
  if (shape && payload) return { shape, payload };
  try {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    shape = ajv.compile(schema);
    payload = ajv.compile(extension);
    return { shape, payload };
  } catch {
    return null;
  }
}

export function validateOutput(value) {
  let shaped = true;
  try {
    const v = getValidators();
    if (v?.shape && v?.payload) {
      shaped = Boolean(v.shape(value) && v.payload(value));
    }
  } catch {
    // Cloudflare Workers and secure V8 sandboxes disallow runtime code generation from strings (EvalError).
    // In these environments, rely on the complete semantic validator below.
    shaped = true;
  }
  const semantic = value?.schemaVersion === 'nugaom.api-error.v1'
    ? validateApiErrorEnvelope(value)
    : validateEnvelopeInvariants(value);
  // Never return Ajv params, additional property names, or provider input values.
  return { valid: shaped && semantic.valid, errors: [...(!shaped ? [{ path: '$', code: 'INVALID_SHAPE' }] : []), ...semantic.errors] };
}
