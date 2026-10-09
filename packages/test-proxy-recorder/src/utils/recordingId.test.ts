import http from 'node:http';

import { describe, expect, it } from 'vitest';

import { RECORDING_ID_HEADER } from '../constants.js';
import { getRecordingIdFromRequest } from './recordingId.js';

/** A request whose header arrived as the browser sends it: UTF-8 bytes, read by Node as latin1. */
function requestWithHeaderBytes(id: string): http.IncomingMessage {
  return {
    headers: { [RECORDING_ID_HEADER]: Buffer.from(id).toString('latin1') },
  } as unknown as http.IncomingMessage;
}

describe('getRecordingIdFromRequest', () => {
  it('reads a non-ASCII session id as the UTF-8 the browser sent', () => {
    // A describe title such as 'Корзина' is part of the id sent to /__control.
    const id = 'cart__Корзина__adds-an-item';

    expect(getRecordingIdFromRequest(requestWithHeaderBytes(id))).toBe(id);
  });

  it('keeps an ASCII id as it is', () => {
    expect(
      getRecordingIdFromRequest(requestWithHeaderBytes('cart__adds-50%-off')),
    ).toBe('cart__adds-50%-off');
  });

  it('keeps a latin1 value that is not valid UTF-8', () => {
    const request = {
      headers: { [RECORDING_ID_HEADER]: 'café' },
    } as unknown as http.IncomingMessage;

    expect(getRecordingIdFromRequest(request)).toBe('café');
  });
});
