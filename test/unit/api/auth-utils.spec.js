// @flow

import _ from 'lodash';
import path from 'path';
import Auth from '../../../src/lib/auth';
// $FlowFixMe
import configExample from '../partials/config/index';
import AppConfig from '../../../src/lib/config';
import {setup} from '../../../src/lib/logger';

import {convertPayloadToBase64, parseConfigFile} from '../../../src/lib/utils';
import {getApiToken, getAuthenticatedMessage} from '../../../src/lib/auth-utils';
import {aesDecrypt, verifyPayload} from '../../../src/lib/crypto-utils';

import type {IAuth} from '../../../types/index';
import type {Config, RemoteUser} from '@verdaccio/types';

setup(configExample.logs);

describe('Auth utilities', () => {
  const parseConfigurationFile = (name) => {
    return path.join(__dirname, `../partials/config/yaml/security/${name}.yaml`);
  };

  const createBase = function(
    template: string,
    username: string,
    password: string,
    secret = '12345',
    methodToSpy: string,
    methodNotBeenCalled: string) {
      const conf = parseConfigFile(parseConfigurationFile(template));
      const secConf= _.merge(configExample, conf);
      secConf.secret = secret;
      const config: Config = new AppConfig(secConf);
      const auth: IAuth = new Auth(config);
      const spy = jest.spyOn(auth, methodToSpy);
      const spyNotCalled = jest.spyOn(auth, methodNotBeenCalled);
      const user: RemoteUser = {
        name: username,
        real_groups: [],
        groups: []
      };
      const token = getApiToken(auth, config, user, password);
      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spyNotCalled).not.toHaveBeenCalled();
      expect(token).toBeDefined();

      return token;
  };

  const verifyJWT = (token: string, user: string, password: string, secret: string) => {
    const payload = verifyPayload(token, secret);
    expect(payload.name).toBe(user);
    expect(payload.groups).toBeDefined();
    expect(payload.real_groups).toBeDefined();
  };

  const verifyAES = (token: string, user: string, password: string, secret: string) => {
    const payload = aesDecrypt(convertPayloadToBase64(token), secret).toString('utf8')
    const content = payload.split(':');

    expect(content[0]).toBe(user);
    expect(content[0]).toBe(password);
  };

  describe('getApiToken test', () => {
    test('should sign token with aes and security missing', () => {
      const token = createBase('security-missing',
        'test', 'test', '1234567', 'aesEncrypt', 'jwtEncrypt');

      verifyAES(token, 'test', 'test', '1234567');
      expect(_.isString(token)).toBeTruthy();
    });

    test('should sign token with aes and security emtpy', () => {
      const token = createBase('security-empty',
        'test', 'test', '123456', 'aesEncrypt', 'jwtEncrypt');

      verifyAES(token, 'test', 'test', '123456');
      expect(_.isString(token)).toBeTruthy();
    });

    test('should sign token with aes', () => {
      const token = createBase('security-basic',
        'test', 'test', '123456', 'aesEncrypt', 'jwtEncrypt');

      verifyAES(token, 'test', 'test', '123456');
      expect(_.isString(token)).toBeTruthy();
    });

    test('should sign token with legacy and jwt disabled', () => {
      const token = createBase('security-no-legacy',
        'test', 'test', 'x8T#ZCx=2t', 'aesEncrypt', 'jwtEncrypt');

      expect(_.isString(token)).toBeTruthy();
      verifyAES(token, 'test', 'test', 'x8T#ZCx=2t');
    });

    test('should sign token with legacy enabled and jwt enabled', () => {
      const token = createBase('security-jwt-legacy-enabled',
        'test', 'test', 'secret', 'jwtEncrypt', 'aesEncrypt');

      verifyJWT(token, 'test', 'test', 'secret');
      expect(_.isString(token)).toBeTruthy();
    });

    test('should sign token with jwt enabled', () => {
      const token = createBase('security-jwt',
        'test', 'test', 'secret', 'jwtEncrypt', 'aesEncrypt');

        expect(_.isString(token)).toBeTruthy();
        verifyJWT(token, 'test', 'test', 'secret');
    });
  });

  describe('getAuthenticatedMessage test', () => {
    test('should sign token with jwt enabled', () => {
      expect(getAuthenticatedMessage('test')).toBe('you are authenticated as \'test\'');
    });
  });
});