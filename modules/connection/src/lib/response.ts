export abstract class Response<Suc, Err> {
  constructor(
    public readonly status: 'success' | 'error',
    public readonly data: Suc | null,
    public readonly error: Err | null
  ) {}

  static just<T>(data: T): Just<T> {
    return new Just(data);
  }

  static fail<E>(error: E): Fail<E> {
    return new Fail(error);
  }

  toJSON(): object {
    if (this.status === 'success') {
      return {
        status: this.status,
        data: this.data!
      };
    }

    return {
      status: this.status,
      error: this.error!
    };
  }
}

export class Just<T> extends Response<T, null> {
  constructor(data: T) {
    super('success', data, null);
  }
}

export class Fail<E> extends Response<null, E> {
  constructor(error: E) {
    super('error', null, error);
  }
}
