import connector from './connector';

/**
 * {sessionSuccess,sessionFail,sessionCancel,success,error}
 * @param {*} callbacks 
 */
export function getSession(callback={}) {
  return connector.getSession(callback);
}

export function killSession() {
  return connector.killSession();
}

export function getAddress() {
  return connector.address;
}

export function sign(signMsg) {
  return connector.sign(signMsg);
}


