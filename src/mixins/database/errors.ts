import { Errors } from 'moleculer';

const { MoleculerClientError } = Errors;

export class EntityNotFoundError extends MoleculerClientError {
  constructor(id: string | string[]) {
    super('Entity not found', 404, 'ENTITY_NOT_FOUND', { id });
  }
}
