import { ConResponse } from '../lib/response';
import { ConnectionError } from './error';
import { ConnectionSuccess } from './success';

export type ConnectionResponse = ConResponse<ConnectionSuccess, ConnectionError>;
