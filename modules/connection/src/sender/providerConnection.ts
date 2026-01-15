import { ProviderRun, Session, SessionProviderInstance } from '@metorial-subspace/db';

export class ProviderConnection {
  private constructor(
    private readonly session: Session,
    private readonly run: ProviderRun,
    private readonly instance: SessionProviderInstance
  ) {}

  static async create(instance: SessionProviderInstance): Promise<ProviderConnection> {}
}
