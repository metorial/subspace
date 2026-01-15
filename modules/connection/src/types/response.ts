import { Response } from '../lib/response';
import { ConnectionError } from './error';
import { ConnectionSuccess } from './success';

export type ConnectionResponse = Response<ConnectionSuccess, ConnectionError>;
