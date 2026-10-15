// A cloud build must use env.DB. Never create an ephemeral customer database.
export class DatabaseSync {constructor(){throw new Error('D1_BINDING_REQUIRED');}}
