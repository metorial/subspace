export abstract class ConResponse<Suc, Err> {
  constructor(
    public readonly status: 'success' | 'error',
    public readonly data: Suc | undefined,
    public readonly error: Err | undefined
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

  static isError<Suc, Err>(res: ConResponse<Suc, Err>): res is Fail<Err> {
    return res.status === 'error';
  }

  static isSuccess<Suc, Err>(res: ConResponse<Suc, Err>): res is Just<Suc> {
    return res.status === 'success';
  }
}

export class Just<T> extends ConResponse<T, undefined> {
  constructor(data: T) {
    super('success', data, undefined);
  }
}

export class Fail<E> extends ConResponse<undefined, E> {
  constructor(error: E) {
    super('error', undefined, error);
  }
}
